import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

// Medido en el navegador el 6 de octubre de 2026: tras navegar, el foco se quedaba en el enlace del
// menu en 6 de 8 rutas, y cuando se movio a `main` no se veia nada. Dos motivos, ambos medidos:
//
//  1. `main` mide 4310 px y arranca en y=0, debajo de la barra superior, asi que un indicador en su
//     borde superior queda tapado.
//  2. Un contorno completo alrededor de la region se leia como un error de maquetacion en la captura.
//
// Ademas `main` empieza por el aviso de sesion sintetica, asi que un lector de pantalla anunciaba ese
// aviso en vez del titulo de la pagina. Por eso el foco aterriza en el `h1` y no en la region: es lo
// que recomienda WAI-ARIA para navegacion de una sola pagina y resuelve los tres puntos.

const app = readFileSync(fileURLToPath(new URL('../src/App.scss', import.meta.url)), 'utf8')
const tsx = readFileSync(fileURLToPath(new URL('../src/App.tsx', import.meta.url)), 'utf8')

test('the page title shows a visible focus indicator when the route changes', () => {
  // Arrange
  const regla = /\.workspace main h1:focus-visible\s*\{([^}]*)\}/.exec(app)?.[1]

  // Act + Assert
  assert.ok(regla, 'the page title must declare a focus-visible style')
  assert.match(regla, /outline:\s*3px solid/, 'the indicator must be a visible ring')
  assert.match(regla, /var\(--ui-focus/, 'the indicator must follow the theme focus token')
  assert.doesNotMatch(app, /\.workspace main:focus-visible\s*\{/, 'the indicator must not live on the whole region')
})

test('focus lands on the page title, with the region as fallback', () => {
  // Arrange
  const main = /<main[^>]*>/.exec(tsx)?.[0]

  // Act + Assert
  assert.ok(main, 'the main region must be rendered by App')
  assert.match(main, /tabIndex=\{-1\}/, 'main keeps programmatic focus as the fallback target')
  assert.match(main, /ref=\{mainRef\}/, 'main must expose a ref so the effect can reach it')

  const efecto = /useEffect\(\(\) => \{[\s\S]*?\}, \[view\]\)/.exec(tsx)?.[0]
  assert.ok(efecto, 'the focus effect must be bound to the view so it runs on route changes')
  assert.match(efecto, /querySelector\('h1'\)/, 'the effect must look for the page title')
  assert.match(efecto, /setAttribute\('tabindex', '-1'\)/, 'the title must become programmatically focusable')
  assert.match(efecto, /titulo\.focus\(\)/, 'the effect must focus the title')
  assert.match(efecto, /principal\.focus\(\)/, 'a route without a title must fall back to the region')
  assert.match(efecto, /new MutationObserver/, 'the title must be awaited, because route chunks load on demand')
  assert.match(efecto, /firstView\.current = false/, 'the first render must not steal focus')
})
