// Separa "lento por consultas" de "lento por bytes". La medicion bajo carga dio 114 ms de mediana en
// /api/v1/spaces, que no toca MySQL: lee un snapshot ya cargado en memoria. La suspicion es que el
// costo esta en serializar y enviar el cuerpo, no en la base.
//
//   node docs/evidence/round-2026-10-05-carga/medir-payload.mjs [salida.txt]
import { writeFileSync } from 'node:fs'

const BASE = process.env.BASE ?? 'http://localhost:8080'
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

const sesion = await fetch(`${BASE}/api/v1/dev/local-preview-session`, { method: 'POST' })
if (!sesion.ok) throw new Error(`no se pudo emitir la sesion: ${sesion.status}`)
const token = (await sesion.json()).accessToken

const filas = []
for (const ruta of RUTAS) {
  const r = await fetch(`${BASE}${ruta}`, { headers: { Authorization: `Bearer ${token}` } })
  const cuerpo = await r.text()
  filas.push({ ruta, estado: r.status, bytes: Buffer.byteLength(cuerpo, 'utf8') })
}
await fetch(`${BASE}/api/v1/dev/local-preview-session`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${token}` },
})

const lineas = [
  'Tamano del cuerpo de cada respuesta (una peticion por endpoint, sin carga)',
  '',
  'endpoint | estado | bytes | kB',
  '--- | ---: | ---: | ---:',
]
for (const f of filas) {
  lineas.push(`${f.ruta} | ${f.estado} | ${f.bytes} | ${(f.bytes / 1024).toFixed(1)}`)
}
const mayor = [...filas].sort((a, b) => b.bytes - a.bytes)[0]
lineas.push('')
lineas.push(`Mayor cuerpo: ${mayor.ruta} con ${(mayor.bytes / 1024).toFixed(1)} kB`)
lineas.push('')
lineas.push('Un cuerpo grande no se arregla con un indice: se arregla paginando o reduciendo lo que')
lineas.push('via. Ese es el siguiente trabajo, distinto del de las consultas.')

const salida = process.argv[2]
if (salida) writeFileSync(salida, lineas.join('\n'), 'utf8')
console.log(lineas.join('\n'))
