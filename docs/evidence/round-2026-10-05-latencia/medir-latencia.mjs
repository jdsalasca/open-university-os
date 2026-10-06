import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'

const require = createRequire(import.meta.url)

// Latencia real de los endpoints que la aplicacion usa, con la base local poblada (44 tablas) y una
// sesion de preview real. El objetivo documentado es un promedio menor a 50 ms en consultas criticas.
//
// Cada endpoint se pide 20 veces y se reporta el promedio y los percentiles, porque un promedio
// sozinho oculta la cola: una peticion de 400 ms dentro de 20plicas de 30 ms sigue dando 45 ms de
// promedio y se siente lenta.

const BASE = 'http://localhost:8080'
const PETICIONES = 20

async function sesion() {
  const r = await fetch(`${BASE}/api/v1/dev/local-preview-session`, { method: 'POST' })
  if (!r.ok) throw new Error(`no se pudo emitir la sesion: ${r.status}`)
  return (await r.json()).accessToken
}

function percentil(valores, p) {
  const ordenados = [...valores].sort((a, b) => a - b)
  const indice = Math.min(ordenados.length - 1, Math.floor((p / 100) * ordenados.length))
  return ordenados[indice]
}

async function medir(token, ruta) {
  const tiempos = []
  let estado = 0
  for (let i = 0; i < PETICIONES; i++) {
    const inicio = performance.now()
    const r = await fetch(`${BASE}${ruta}`, { headers: { Authorization: `Bearer ${token}` } })
    await r.text()
    tiempos.push(performance.now() - inicio)
    estado = r.status
  }
  const promedio = tiempos.reduce((a, b) => a + b, 0) / tiempos.length
  return {
    ruta,
    estado,
    promedio: Number(promedio.toFixed(2)),
    mediana: Number(percentil(tiempos, 50).toFixed(2)),
    p95: Number(percentil(tiempos, 95).toFixed(2)),
    maximo: Number(Math.max(...tiempos).toFixed(2)),
  }
}

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

const token = await sesion()
const filas = []
for (const ruta of RUTAS) {
  try {
    filas.push(await medir(token, ruta))
  } catch (e) {
    filas.push({ ruta, estado: 'error', promedio: NaN, mediana: NaN, p95: NaN, maximo: NaN, detalle: String(e) })
  }
}

// Se revoca la sesion: el limite de sesiones activas del backend es corto y dejarla abierta
//haria que se agote en las siguientes rondas.
await fetch(`${BASE}/api/v1/dev/local-preview-session`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })

const lineas = [
  `Latencia de ${PETICIONES} peticiones por endpoint, backend local con 44 tablas y sesion de preview`,
  '',
  'endpoint | estado | promedio | mediana | p95 | maximo | bajo 50 ms',
  '--- | ---: | ---: | ---: | ---: | ---: | ---',
]
let sobreElObjetivo = 0
for (const f of filas) {
  const ok = f.promedio < 50
  if (!ok && Number.isFinite(f.promedio)) sobreElObjetivo++
  lineas.push(`${f.ruta} | ${f.estado} | ${f.promedio} | ${f.mediana} | ${f.p95} | ${f.maximo} | ${ok ? 'si' : 'NO'}`)
}
lineas.push('')
lineas.push(`Endpoints con promedio >= 50 ms: ${sobreElObjetivo} de ${filas.length}`)
const globalPromedio = filas.filter((f) => Number.isFinite(f.promedio))
  .reduce((a, f) => a + f.promedio, 0) / filas.length
lineas.push(`Promedio de la sesion completa (${filas.length} endpoints en serie): ${globalPromedio.toFixed(2)} ms`)

// Con un argumento se escribe tambien a ese archivo: el texto pegado en consola no sobrevive.
const salida = process.argv[2]
if (salida) writeFileSync(salida, lineas.join('\n'), 'utf8')
console.log(lineas.join('\n'))
