// Verifica que el bearer del preview local no abre puertas de mas. El perfil
// local-preview emite una identidad con permisos allowlisted. Una fuga seria una
// ruta que devuelve 2xx aunque ese perfil no deba poder usarla. Un 403 significa
// que la ruta existe y el permiso falta; un 404 que no existe; un 400 que exige
// parametros. Ninguno de esos tres es una fuga.
const BASE = 'http://localhost:8080'

const sesion = await (await fetch(`${BASE}/api/v1/dev/local-preview-session`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
})).json()
const token = sesion.accessToken ?? sesion.token ?? sesion.bearer
if (!token) { console.log('NO SE PUDO OBTENER TOKEN:', JSON.stringify(sesion).slice(0, 200)); process.exit(2) }
const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' }

// Publicas: abiertas por diseno para cualquiera, con o sin sesion.
const PUBLICAS = new Set([
  '/api/v1/branding', '/api/v1/spaces', '/api/v1/academic-structure', '/api/v1/academic-periods',
  '/api/v1/academic-catalog/programs', '/api/v1/territorial-catalog/departments',
  '/api/v1/admissions/calls', '/actuator/health',
])

// Administrativas dentro del allowlist de preview: deben responder con datos.
const PREVIEW = new Set([
  '/api/v1/me', '/api/v1/notices',
  '/api/v1/admin/branding', '/api/v1/admin/notices',
  '/api/v1/admin/academic-structure', '/api/v1/admin/academic-structure/audit-events',
  '/api/v1/admin/academic-catalog/drafts', '/api/v1/admin/academic-periods',
  '/api/v1/admin/access/role-profiles', '/api/v1/admin/admissions/calls',
  '/v3/api-docs',
])

// Administrativas fuera de ese allowlist: deben seguir cerradas.
const CERRADAS = [
  '/api/v1/admin/branding/assets', '/api/v1/admin/branding/rollback',
  '/api/v1/admin/academic-structure/sites', '/api/v1/admin/academic-structure/units',
  '/api/v1/admin/academic-catalog/import-previews', '/api/v1/admin/academic-catalog/imports',
  '/api/v1/dev/room-allocation/proposals',
]

const pedir = async (ruta) => {
  try { const r = await fetch(BASE + ruta, { headers }); await r.text(); return r.status } catch { return 0 }
}

const filas = []
for (const ruta of [...PUBLICAS].sort()) {
  const estado = await pedir(ruta)
  const ok = estado < 400
  filas.push({ ruta, clase: 'publica', estado, ok })
  console.log(`${ok ? 'OK  ' : 'FALLA'} publica  ${String(estado).padEnd(4)} ${ruta}`)
}
for (const ruta of [...PREVIEW].sort()) {
  const estado = await pedir(ruta)
  const ok = estado === 200
  filas.push({ ruta, clase: 'preview', estado, ok })
  console.log(`${ok ? 'OK  ' : 'FALLA'} preview   ${String(estado).padEnd(4)} ${ruta}`)
}
for (const ruta of CERRADAS.sort()) {
  const estado = await pedir(ruta)
  // 401, 403 y 404 son cierres legitimos; solo un 2xx seria una fuga.
  const ok = !(estado >= 200 && estado < 400)
  filas.push({ ruta, clase: 'cerrada', estado, ok })
  console.log(`${ok ? 'OK  ' : 'FUGA '} cerrada   ${String(estado).padEnd(4)} ${ruta}`)
}

const fugas = filas.filter((f) => !f.ok)
const fallos = filas.filter((f) => !f.ok && f.clase !== 'cerrada')
console.log('---')
console.log(`total ${filas.length}, fugas ${fugas.filter((f) => f.clase === 'cerrada').length}, inesperados ${fallos.length}`)
if (fugas.length) console.log('A REVISAR: ' + fugas.map((f) => `${f.clase} ${f.ruta} -> ${f.estado}`).join(', '))

await fetch(`${BASE}/api/v1/dev/local-preview-session`, { method: 'DELETE', headers })
process.exit(fugas.length ? 1 : 0)