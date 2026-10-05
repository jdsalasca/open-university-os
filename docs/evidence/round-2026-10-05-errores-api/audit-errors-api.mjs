// Provoca errores reales en la API y audita las respuestas. Un controlador puede
// devolver mensajes claros o filtrar la maquinaria interna: nombre de clase Java,
// ruta del servidor, consulta SQL o traza. Este recorrido busca ambas cosas.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const BASE = 'http://localhost:8080'
const token = readFileSync(process.env.TEMP + '\\preview-token.txt', 'utf8').trim()
const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

// Fugas de detalle interno que nunca deben viajar al cliente.
const FUGAS = [
  ['clase java', /\b(co\.edu\.uptc|java\.|jakarta\.|org\.springframework|org\.hibernate)\b/],
  ['traza', /\n\s+at\s+[\w.$]+\(|StackTrace|Throwable|Caused by:/],
  ['sql', /\b(SELECT|INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM|JdbcTemplate|Hibernate:\s)/i],
  ['ruta del servidor', /\/home\/[a-z]+\/|\/Users\/[a-z]+\/|[A-Z]:\\\\|universiry\\src|backend[\\/]src/i],
  ['puerto o url interna', /localhost:\d+|127\.0\.0\.1:\d+/],
  ['nombre de excepcion', /\b[A-Z][A-Za-z]*Exception\b|\bNullPointer\b|\bIllegalArgument\b/],
  ['nombre de propiedad java', /\bgetClass\b|\bbean\b|\bfield\b|@com\./],
]

const CASOS = [
  ['404 recurso inexistente', 'GET', '/api/v1/academic-catalog/curricula/00000000-0000-0000-0000-000000000000', null],
  ['400 cuerpo vacio', 'POST', '/api/v1/admin/academic-structure/sites', {}],
  ['400 tipo incorrecto', 'POST', '/api/v1/admin/academic-structure/sites', { type: 12345, name: 'x', validFrom: 'no-es-fecha', reference: '' }],
  ['400 uuid invalido', 'GET', '/api/v1/admin/academic-structure/units/no-es-uuid/order', null],
  ['400 codigo territorial raro', 'GET', '/api/v1/territorial-catalog/departments/ZZ/entities', null],
  ['400 codigo territorial largo', 'GET', '/api/v1/territorial-catalog/departments/123456/entities', null],
  ['401 sin token', 'GET', '/api/v1/me', null, true],
  ['404 metodo no permitido', 'PATCH', '/api/v1/admin/academic-structure/sites', {}],
  ['400 query mal formada', 'GET', '/api/v1/admin/academic-structure/audit-events?limit=abc', null],
  ['400 limite fuera de rango', 'GET', '/api/v1/admin/academic-structure/audit-events?limit=99999', null],
]

const filas = []
for (const [nombre, metodo, ruta, cuerpo, sinToken] of CASOS) {
  const cabeceras = sinToken ? { 'Content-Type': 'application/json' } : auth
  let estado = 0
  let texto = ''
  try {
    const r = await fetch(BASE + ruta, {
      method: metodo,
      headers: cabeceras,
      ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
    })
    estado = r.status
    texto = await r.text()
  } catch (e) {
    texto = e.message
  }
  const fugas = FUGAS.filter(([, patron]) => patron.test(texto)).map(([etiqueta]) => etiqueta)
  filas.push({ nombre, metodo, ruta, estado, fugas, largo: texto.length, muestra: texto.slice(0, 160) })
  console.log(`${String(estado).padEnd(4)} ${fugas.length ? 'FUGA: ' + fugas.join(',') : 'limpio'} ${nombre}`)
  if (fugas.length) console.log(`       ${texto.slice(0, 220)}`)
}

const conFuga = filas.filter((f) => f.fugas.length)
const cinco = filas.filter((f) => f.estado >= 500)
console.log('---')
console.log(`casos ${filas.length}, con fuga ${conFuga.length}, respuestas 5xx ${cinco.length}`)
writeFileSync(fileURLToPath(new URL('./error-audit.json', import.meta.url)), JSON.stringify(filas, null, 1))
process.exit(conFuga.length ? 1 : 0)