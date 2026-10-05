// Comprueba que cada ruta que consume el cliente React exista en el backend. Un
// 404 significa que el cliente llama a algo que ya no esta publicado y se rompe
// en silencio; 401 o 403 significan que la ruta existe y el servidor autoriza.
const RUTAS = [
  '/api/v1/branding', '/api/v1/me', '/api/v1/notices', '/api/v1/spaces',
  '/api/v1/academic-structure', '/api/v1/academic-periods',
  '/api/v1/academic-catalog/programs',
  '/api/v1/territorial-catalog/departments',
  '/api/v1/admissions/calls',
  '/api/v1/admin/branding', '/api/v1/admin/branding/assets', '/api/v1/admin/branding/rollback',
  '/api/v1/admin/library', '/api/v1/admin/notices',
  '/api/v1/admin/academic-structure', '/api/v1/admin/academic-structure/audit-events',
  '/api/v1/admin/academic-structure/sites', '/api/v1/admin/academic-structure/units',
  '/api/v1/admin/academic-catalog/drafts', '/api/v1/admin/academic-catalog/import-previews',
  '/api/v1/admin/academic-catalog/imports',
  '/api/v1/admin/academic-offerings',
  '/api/v1/admin/academic-periods',
  '/api/v1/admin/access/assignments', '/api/v1/admin/access/identities',
  '/api/v1/admin/access/role-profiles',
  '/api/v1/admin/admissions/calls',
  '/api/v1/dev/local-preview-session', '/api/v1/dev/room-allocation/proposals',
]

const BASE = 'http://localhost:8080'
const salir = (codigo) => { console.log(JSON.stringify({ codigo })); process.exit(codigo) }

;(async () => {
  const filas = []
  for (const ruta of RUTAS) {
    let estado = 0
    let detalle = ''
    try {
      const r = await fetch(BASE + ruta, { headers: { Accept: 'application/json' } })
      estado = r.status
      const cuerpo = await r.text()
      // Un cuerpo de Spring con "path" indica que la ruta no tiene mapeo.
      detalle = estado === 404 ? cuerpo.slice(0, 90) : ''
    } catch (e) {
      detalle = e.message
    }
    const existe = estado !== 404
    filas.push({ ruta, estado, existe, detalle })
    console.log(`${existe ? 'OK ' : 'FALTA'} ${String(estado).padEnd(4)} ${ruta}${detalle ? '  <- ' + detalle : ''}`)
  }
  const faltantes = filas.filter((f) => !f.existe)
  console.log(`---`)
  console.log(`total ${filas.length}, existentes ${filas.length - faltantes.length}, faltantes ${faltantes.length}`)
  if (faltantes.length) console.log('FALTANTES: ' + faltantes.map((f) => f.ruta).join(', '))
  salir(faltantes.length ? 1 : 0)
})().catch((e) => { console.error('error', e.message); salir(2) })