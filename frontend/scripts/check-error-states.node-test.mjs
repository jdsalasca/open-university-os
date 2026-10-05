import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

// Auditoria del 5 de octubre de 2026 con el backend detenido: las seis rutas
// publicas responden sin pantallas rotas y sin mensajes tecnicos. Este archivo
// protege el patron que separa los dos casos reales de fallo.
const REINTENTO = /Reintentar|Reintento|Volver a intentarlo|Intentar de nuevo/

const fuente = (ruta) => readFileSync(fileURLToPath(new URL(ruta, import.meta.url)), 'utf8')

// Fallo que detiene la pantalla: no hay nada que mostrar sin la API. Se anuncia
// con role=alert porque interrumpe a quien esta leyendo.
const BLOQUEANTES = {
  espacios: '../src/features/spaces/SpaceGuidePage.tsx',
  catalogos: '../src/features/academics/AcademicCatalogPage.tsx',
  academicos: '../src/features/academics/AcademicOperationsPage.tsx',
}

for (const [nombre, ruta] of Object.entries(BLOQUEANTES)) {
  test(`${nombre} interrumpe con role=alert cuando la carga falla`, () => {
    assert.match(fuente(ruta), /role="alert"/, 'un fallo bloqueante debe anunciarse con role=alert')
  })

  test(`${nombre} ofrece una accion de reintento`, () => {
    assert.match(fuente(ruta), REINTENTO, 'un fallo de red necesita una salida, no un callejon')
  })

  test(`${nombre} explica el fallo y encamina la accion`, () => {
    const codigo = fuente(ruta)
    assert.match(codigo, /conexi[oó]n|vuelve a intentarlo|momento|intentarlo/i,
      'el mensaje debe decir que ocurrio y que hacer')
  })
}

// Fallo que degrada sin detener: la vista sigue siendo util con informacion de
// respaldo, asi que role=status (polite) es lo correcto y role=alert seria
// interrumpir sin motivo.
const DEGRADANTES = {
  admisiones: {
    ruta: '../src/features/admissions/AdmissionsExperience.tsx',
    respaldo: /Se conserva la informaci[oó]n p[uú]blica de referencia/,
  },
}

for (const [nombre, { ruta, respaldo }] of Object.entries(DEGRADANTES)) {
  test(`${nombre} degrada con role=status en vez de interrumpir`, () => {
    const codigo = fuente(ruta)
    assert.match(codigo, /role="status"/, 'una degradacion se anuncia sin interrumpir')
    assert.match(codigo, respaldo, 'debe decir que se conserva la informacion de referencia')
    assert.match(codigo, REINTENTO, 'debe permitir reintentar la consulta versionada')
  })
}

test('ninguna vista filtra detalle de infraestructura en su mensaje de error', () => {
  const todos = [...Object.values(BLOQUEANTES), ...Object.values(DEGRADANTES).map((d) => d.ruta)]
    .map(fuente).join('\n')
  for (const tecnico of [/org\.springframework/, /java\.lang\./, /ECONNREFUSED/, /fetch failed/i, /localhost:\d+/, /\$\{.*\.message\}/]) {
    assert.doesNotMatch(todos, tecnico, 'el codigo de vista no debe construir mensajes con detalle del servidor')
  }
})