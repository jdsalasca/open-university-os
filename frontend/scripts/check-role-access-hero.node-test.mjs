import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

// Barrido responsive del 5 de octubre de 2026 a 360 px: el titulo "Accesos y perfiles" media 78 px
// visibles de 98 px de contenido, es decir, se cortaba. La causa es que el heroe mantiene dos
// columnas en movil y la segunda, ocupada por la marca decorativa de 76 px, roba el ancho del
// texto. En un ancho de una sola columna la marca no compite con el titulo.
const scss = readFileSync(fileURLToPath(new URL('../src/features/access/RoleAccessPage.scss', import.meta.url)), 'utf8')

const movil = /\@media \(max-width: 600px\) \{([\s\S]*)\n\}/.exec(scss)?.[1] ?? ''

test('en movil el heroe de accesos deja de competir con la marca por el ancho', () => {
  // Assert
  assert.ok(movil, 'debe existir la regla de movil')
  assert.match(
    movil,
    /\.role-access-hero\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*;/,
    'una sola columna: el titulo no comparte ancho con la marca decorativa',
  )
})

test('la marca decorativa se oculta en movil antes que el titulo', () => {
  // Assert
  assert.match(
    movil,
    /\.role-access-hero-mark\s*\{[^}]*display:\s*none/,
    'en un ancho de una sola columna la marca no aporta nada y roba espacio',
  )
})

test('el titulo del heroe no lleva recorte propio', () => {
  // Arrange: un recorte en el h1 taparia el problema en vez de resolverlo.
  const base = /\.role-access-hero\s*\{([\s\S]*?)\n\}/.exec(scss)?.[1] ?? ''
  const h1 = /\.role-access-hero h1\s*\{([^}]*)\}/.exec(scss)?.[1] ?? ''

  // Assert
  assert.ok(base || h1, 'debe existir la regla del heroe')
  assert.doesNotMatch(h1, /text-overflow:\s*ellipsis/, 'el titulo no debe truncarse con puntos suspensivos')
  assert.doesNotMatch(h1, /white-space:\s*nowrap/, 'el titulo debe poder ocupar dos lineas')
  assert.doesNotMatch(h1, /overflow:\s*hidden/, 'ni ocultarse por recorte')
})
