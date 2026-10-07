import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

// El aviso de sesion sintetica es cromo de sesion, no contenido de la ruta. Antes vivia como primer hijo
// de `main`, delante del titulo de cada pagina. Eso tenia dos consecuencias reales, ambas medidas en el
// navegador: un lector de pantalla anunciaba el aviso en vez del titulo al entrar en la pagina, y el
// `main` empezaba por un landmark `complementary` que no pertenece a ninguna ruta.
//
// El aviso sigue montandose en el shell (header/nav/main), justo entre la barra superior y el contenido,
// y conserva su aria-live y su etiqueta. Lo que cambia es su padre: `.workspace`, no `main`.
const tsx = readFileSync(fileURLToPath(new URL('../src/App.tsx', import.meta.url)), 'utf8')

function bloqueMain() {
  const inicio = tsx.indexOf('<main')
  if (inicio < 0) return null
  // El `main` de App.tsx es el unico de la aplicacion; termina con su etiqueta de cierre.
  const fin = tsx.indexOf('</main>', inicio)
  if (fin < 0) return null
  return tsx.slice(inicio, fin)
}

test('session chrome lives in the shell, not inside the page content', () => {
  // Arrange
  const main = bloqueMain()
  assert.ok(main, 'App must render a main region')

  // Assert: el aviso de sesion no es contenido de pagina. Su contrato de anuncio (aria-live, etiqueta)
  // ya lo cubre `check-live-region-role`; aqui solo importa el padre.
  assert.doesNotMatch(main, /local-preview-session-banner/, 'the session banner must not be a child of main')
})
