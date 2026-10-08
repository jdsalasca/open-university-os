// Medicion de latencia con carga declarada, que es lo que el objetivo de <50 ms necesita para poder
// afirmarse o descartarse.
//
// La medicion anterior pedia 20 veces cada endpoint en serie y por eso daba numeros que cambiaban un
// factor de dos en el mismo dia:92 ms y 49 ms para el mismo codigo. Eso no es ruido menor, es ruido
// que invalida la conclusion. Aqui se declara lo que se mide:
//
//   - 5 repeticiones independientes del bloque completo, con la base en el mismo estado
//   - 200 peticiones por endpoint por repeticion, en 20 de concurrencia constante
//   - se reporta mediana entre repeticiones, no solo el promedio de una pasada
//   - se descartan la primera repeticion de cada bloque, para no medir el arranque de conexiones
//
// El objetivo documentado es promedio menor a 50 ms en consultas criticas. Este script NO lo declara
// cumplido: lo mide y lo dice, con el numero al lado.
//
//   node docs/evidence/round-2026-10-05-carga/medir-carga.mjs [salida.txt]
import { writeFileSync } from 'node:fs'

const BASE = process.env.BASE ?? 'http://localhost:8080'
const PETICIONES = Number(process.env.PETICIONES ?? 200)
const CONCURRENCIA = Number(process.env.CONCURRENCIA ?? 20)
const REPETICIONES = Number(process.env.REPETICIONES ?? 5)
// Calentamiento opcional antes de medir. La ronda del 6 de octubre vio p95 de 100 a 180 ms con
// medianas de 35 a 42 ms, y hay que saber si esa cola es la JVMinterpretando y compilando justo
// durante la medicion o si es estado estable.
const CALENTAMIENTO = Number(process.env.CALENTAMIENTO ?? 0)
const OBJETIVO_MS = 50

const RUTAS = [
  '/api/v1/me',
  '/api/v1/branding',
  '/api/v1/academic-structure',
  '/api/v1/admin/academic-structure',
  '/api/v1/academic-catalog/programs',
  '/api/v1/admin/academic-catalog/drafts?pageSize=25',
  '/api/v1/academic-periods',
  '/api/v1/admin/academic-periods',
  '/api/v1/notices',
  '/api/v1/admissions/calls',
  '/api/v1/spaces',
  '/api/v1/admin/academic-structure/audit-events?limit=50',
]

async function sesion() {
  const r = await fetch(`${BASE}/api/v1/dev/local-preview-session`, { method: 'POST' })
  if (!r.ok) throw new Error(`no se pudo emitir la sesion: ${r.status}`)
  return (await r.json()).accessToken
}

const percentil = (valores, p) => {
  const ordenados = [...valores].sort((a, b) => a - b)
  return ordenados[Math.min(ordenados.length - 1, Math.floor((p / 100) * ordenados.length))]
}

// Lanza las peticiones en lotes de CONCURRENCIA en vez de una a una: en serie se mide la latencia de
// una peticion solitaria con la base dormida, que no es el caso que interesa.
async function medirRuta(token, ruta, total = PETICIONES) {
  const tiempos = []
  const estados = new Set()
  let cursor = 0
  const workers = Array.from({ length: CONCURRENCIA }, async () => {
    while (cursor < total) {
      cursor += 1
      const inicio = performance.now()
      const r = await fetch(`${BASE}${ruta}`, { headers: { Authorization: `Bearer ${token}` } })
      await r.text()
      tiempos.push(performance.now() - inicio)
      estados.add(r.status)
    }
  })
  await Promise.all(workers)
  const promedio = tiempos.reduce((a, b) => a + b, 0) / tiempos.length
  return {
    estado: [...estados].join('/'),
    promedio: Number(promedio.toFixed(2)),
    mediana: Number(percentil(tiempos, 50).toFixed(2)),
    p95: Number(percentil(tiempos, 95).toFixed(2)),
    p99: Number(percentil(tiempos, 99).toFixed(2)),
    maximo: Number(Math.max(...tiempos).toFixed(2)),
  }
}

// Utilizacion del host durante la medicion. El 6 de octubre de 2026 dos configuraciones medidas con
// minutos de diferencia dieron resultados contradictorios: pool de 512 m con menos pausas de GC pero
// peor latencia, y el mismo heap por defecto dando 0 de 12 endpoints en una pasada y 4 de 12 en otra.
// La causa era la maquina: 113 procesos node de otras sesiones y el procesador al 100 %. Sin esto, una
// medicion hecha sobre un host saturado se parece a una medicion del codigo, y no lo es.
//
// NO se usa `process.cpuUsage()`: esa llamada mide el consumo de ESTE proceso de Node, que casi no
// hace trabajo, y devuelve 0 % con el host al 100 %. En Windows tampoco hay `os.loadavg()`. La lectura
// correcta es la del sistema, via WMI, y si no se puede leer se dice que no se pudo leer en vez de
// inventar un cero.
async function usoDeCpu() {
  const comando = '(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average'
  for (const interprete of ['powershell.exe', 'pwsh.exe']) {
    try {
      const { execFileSync } = await import('node:child_process')
      const salida = execFileSync(interprete, ['-NoProfile', '-Command', comando], {
        encoding: 'utf8',
        timeout: 20000,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      const valor = Number.parseFloat(salida.trim())
      if (Number.isFinite(valor)) return valor
    } catch {
      // se intenta el siguiente interprete
    }
  }
  return null
}

const token = await sesion()
const cargaInicial = await usoDeCpu()

try {
  if (CALENTAMIENTO > 0) {
    const inicioCalentamiento = Date.now()
    for (const ruta of RUTAS) await medirRuta(token, ruta, CALENTAMIENTO)
    console.log(`calentamiento de ${CALENTAMIENTO} peticiones x ${RUTAS.length} endpoints en ${((Date.now() - inicioCalentamiento) / 1000).toFixed(1)} s`)
  }

  const bloques = []
  for (let repeticion = 1; repeticion <= REPETICIONES; repeticion++) {
    const porRuta = {}
    for (const ruta of RUTAS) porRuta[ruta] = await medirRuta(token, ruta)
    bloques.push(porRuta)
    console.log(`repeticion ${repeticion}/${REPETICIONES} lista`)
  }
  const cargaFinal = await usoDeCpu()
  const cargaMedia = cargaInicial !== null && cargaFinal !== null ? Math.round((cargaInicial + cargaFinal) / 2) : null

  // Se descarta la primera: mide el establecimiento de conexionesTCP y el caches frio de MySQL, que no
  // es el estado del sistema una vez que alguien esta usando la aplicacion.
  const utiles = bloques.slice(1)
  const lineas = [
    `Latencia bajo carga declarada: ${PETICIONES} peticiones por endpoint, concurrencia ${CONCURRENCIA},`,
    `${REPETICIONES} repeticiones (se descarta la primera por conexiones frias), backend local con 44 tablas`,
    CALENTAMIENTO > 0 ? `Calentamiento previo: ${CALENTAMIENTO} peticiones por endpoint` : 'Sin calentamiento previo',
    cargaMedia === null
      ? 'Utilizacion del host: NO MEDIBLE en esta plataforma, así que estos numeros no se pueden separar del ruido de la maquina'
      : `Utilizacion del host durante la medicion: ${cargaMedia}% (${cargaInicial}% al inicio, ${cargaFinal}% al final)`,
    cargaMedia !== null && cargaMedia >= 80
      ? `AVISO: el host estaba al ${cargaMedia}%. Estos numeros miden la maquina, no el codigo: no los uses.`
      : `Objetivo documentado: promedio menor a ${OBJETIVO_MS} ms en consultas criticas`,
    '',
    'endpoint | estado | mediana entre repeticiones | promedio | p95 | p99 | maximo',
    '--- | ---: | ---: | ---: | ---: | ---: | ---:',
  ]
  const resumen = []
  for (const ruta of RUTAS) {
    const muestras = utiles.map((b) => b[ruta]).filter(Boolean)
    const porRuta = {
      ruta,
      estado: muestras[0]?.estado ?? 'sin datos',
      medianaEntreRepeticiones: Number(percentil(muestras.map((m) => m.promedio), 50).toFixed(2)),
      promedioPeor: Number(Math.max(...muestras.map((m) => m.promedio)).toFixed(2)),
      p95: Number(Math.max(...muestras.map((m) => m.p95)).toFixed(2)),
      p99: Number(Math.max(...muestras.map((m) => m.p99)).toFixed(2)),
      maximo: Number(Math.max(...muestras.map((m) => m.maximo)).toFixed(2)),
    }
    resumen.push(porRuta)
    lineas.push([
      porRuta.ruta,
      porRuta.estado,
      porRuta.medianaEntreRepeticiones,
      porRuta.promedioPeor,
      porRuta.p95,
      porRuta.p99,
      porRuta.maximo,
    ].join(' | '))
  }
} finally {
  await fetch(`${BASE}/api/v1/dev/local-preview-session`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {})
}

const salida = process.argv[2]
if (salida) writeFileSync(salida, lineas.join('\n'), 'utf8')
console.log(lineas.join('\n'))
