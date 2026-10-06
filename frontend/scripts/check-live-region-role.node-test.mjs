import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

// axe-core, 5 de octubre de 2026: `aria-allowed-role` en los dos `<aside>` que anuncian la sesion
// sintetica. El rol implicito de `<aside>` es `complementary`, y `status` no está permitido ahi:
// declararlo borra el punto de referencia del landmark y el anuncio deja de ser un landmark. El aviso
// de sesion vive en un banner que se lee al entrar, asi que perder el landmark no aporta nada.
//
// La forma correcta es la que ya usa `check-session-status` para el estado de sesion: `aria-live`
// con `aria-atomic`, sin pisar el rol del elemento.
const PAGINAS = [
  ['src/App.tsx', 'local-preview-session-banner'],
  ['src/features/workspace/WorkspaceHomePage.tsx', 'workspace-home-preview-notice'],
]

for (const [ruta, clase] of PAGINAS) {
  test(`${clase} se anuncia con aria-live sin pisar el rol de su landmark`, () => {
    // Arrange
    const fuente = readFileSync(fileURLToPath(new URL(`../${ruta}`, import.meta.url)), 'utf8')

    // Act
    const etiqueta = new RegExp(`<aside[^>]*className="${clase}"[^>]*>`, 's').exec(fuente)?.[0]

    // Assert
    assert.ok(etiqueta, `el banner ${clase} debe seguir siendo un <aside>`)
    assert.doesNotMatch(etiqueta, /role=/, `${clase} no debe declarar role: pisa el rol complementary`)
    assert.match(etiqueta, /aria-live="polite"/, `${clase} debe anunciar sus cambios con aria-live`)
    assert.match(etiqueta, /aria-atomic="true"/, `${clase} debe leerse entero en cada anuncio`)
    // Al quitar `role="status"` el `<aside>` vuelve a ser landmark, asi que necesita nombre propio:
    // `landmark-unique` de axe-core.
    assert.match(etiqueta, /aria-label="[^"]+"/, `${clase} debe nombrar su landmark para distinguirlo`)
  })
}

test('cada region de capacidades anunciadas se distingue por el lugar', () => {
  // Arrange
  const fuente = readFileSync(
    fileURLToPath(new URL('../src/features/spaces/SpaceGuidePage.tsx', import.meta.url)), 'utf8')

  // Act
  const etiquetas = [...fuente.matchAll(/aria-label=\{`Capacidades([^`]*)`\}/g)].map((m) => m[1])

  // Assert
  assert.equal(etiquetas.length, 1, 'debe quedar una sola etiqueta dinamica de capacidades')
  assert.match(etiquetas[0], /\$\{locationName\}/, 'la etiqueta debe incluir el nombre del lugar')
})
