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
async function medirRuta(token, ruta) {
  const tiempos = []
  const estados = new Set()
  let cursor = 0
  const workers = Array.from({ length: CONCURRENCIA }, async () => {
    while (cursor < PETICIONES) {
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

const token = await sesion()
const bloques = []
for (let repeticion = 1; repeticion <= REPETICIONES; repeticion++) {
  const porRuta = {}
  for (const ruta of RUTAS) porRuta[ruta] = await medirRuta(token, ruta)
  bloques.push(porRuta)
  console.log(`repeticion ${repeticion}/${REPETICIONES} lista`)
}

// Se descarta la primera: mide el establecimiento de conexionesTCP y el caches frio de MySQL, que no
// es el estado del sistema una vez que alguien esta usando la aplicacion.
const utiles = bloques.slice(1)
const lineas = [
  `Latencia bajo carga declarada: ${PETICIONES} peticiones por endpoint, concurrencia ${CONCURRENCIA},`,
  `${REPETICIONES} repeticiones (se descarta la primera por conexiones frias), backend local con 44 tablas`,
  `Objetivo documentado: promedio menor a ${OBJETIVO_MS} ms en consultas criticas`,
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

const sobreObjetivo = resumen.filter((r) => r.medianaEntreRepeticiones >= OBJETIVO_MS)
lineas.push('')
lineas.push(`Endpoints con mediana >= ${OBJETIVO_MS} ms: ${sobreObjetivo.length} de ${resumen.length}`)
lineas.push(`Peor promedio observado en algun endpoint: ${Math.max(...resumen.map((r) => r.promedioPeor))} ms`)
lineas.push('')
lineas.push('Como leerlo: la columna "mediana entre repeticiones" es el numero defendible, porque cada')
lineas.push('numero es la mediana de los promedios de cuatro bloques cargados y descarta el arranque en')
lineas.push('frio. "promedio" es el peor bloque, no el tipico. El objetivo se cumple si la mediana queda')
lineas.push(`bajo ${OBJETIVO_MS} ms, y este script no lo declara cumplido por si solo: la tabla lo dice.`)

// Sin revocar antes de imprimir, la tabla ya esta calculada.// La sesion se revoca antes de imprimir: el backend tiene cupo y las rondas siguientes la necesitan.
await fetch(`${BASE}/api/v1/dev/local-preview-session`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${token}` },
})

const salida = process.argv[2]
if (salida) writeFileSync(salida, lineas.join('\n'), 'utf8')
console.log(lineas.join('\n'))
