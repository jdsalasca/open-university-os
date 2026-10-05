import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { compile } from 'sass'

const appStylesheetPath = fileURLToPath(new URL('../src/App.scss', import.meta.url))
const compiledApp = compile(appStylesheetPath).css
const appSource = readFileSync(appStylesheetPath, 'utf8')

// La barra superior muestra ruta, estado, un chip decorativo, el selector de tema y
// el boton de sesion. Medido en Chromium a 768 px, ese conjunto desbordaba el
// viewport (scrollWidth 786-817 px) y empuja contenido fuera de pantalla en tablet.
// El chip repite el contexto que ya da el breadcrumb, asi que es lo prescindible.
test('el chip decorativo de la barra superior se oculta en pantallas medianas', () => {
  const mediaQuery = appSource.match(/@media \(max-width: 1120px\) \{([\s\S]*?)\n\}/)?.[1]
  assert.ok(mediaQuery, 'debe existir el tramo de hasta 1120 px')

  assert.match(
    mediaQuery,
    /\.revision-chip[^{]*\{[^}]*display:\s*none/,
    'el chip decorativo debe ocultarse como maximo 1120 px',
  )
})

test('la barra superior no declara un ancho minimo que impida encogerse', () => {
  const topbarRule = compiledApp.match(/\.topbar\s*\{([^}]*)\}/)?.[1]
  assert.ok(topbarRule, 'debe existir la regla de la barra superior')
  assert.doesNotMatch(topbarRule, /min-width:\s*\d/, 'la barra superior debe poder encogerse')
})

test('el selector de tema conserva sus tres opciones a tamano reducido', () => {
  const appStylesheet = readFileSync(appStylesheetPath, 'utf8')
  const narrowQuery = appStylesheet.match(/@media \(max-width: 650px\) \{([\s\S]*?)\n\}/)?.[1]
  assert.ok(narrowQuery, 'debe existir el tramo de hasta 650 px')
  assert.match(narrowQuery, /\.theme-selector\s*\{/, 'el selector debe seguir presente en movil')
  assert.match(narrowQuery, /\.theme-selector-choice\s*\{/, 'las opciones deben mantener su tamano tactile')
})

// La guia de espacios declara cuatro columnas en el panel de busqueda. Medido a
// 768 px el panel exigia unos 692 px dentro de un area util de 648 px, y el
// contador de resultados empujaba el documento a 817 px de ancho. El tramo de dos
// columnas debe activarse antes de 768 px, no despues.
test('el copy de la marca se oculta con especificidad suficiente en tablet', () => {
  // La regla base es .brand-lockup .brand-lockup-copy { display: grid }, con dos
  // clases. Un .brand-lockup-copy { display: none } de una sola clase pierde por
  // especificidad aunque el media query vaya despues: el texto seguia ocupando
  // 66 px y empujaba el monogram a -24 px dentro del carril de 68 px.
  const collapsed = appSource.match(/@media \(max-width: 850px\) \{([\s\S]*?)\n\}/)?.[1]
  assert.ok(collapsed, 'debe existir el tramo de sidebar colapsado')
  assert.match(
    collapsed,
    /\.brand-lockup\s+\.brand-lockup-copy[^{]*\{[^}]*display:\s*none/,
    'el copy debe ocultarse con un selector de dos clases para ganarle a la regla base',
  )
})

test('la marca del sidebar colapsado no se desborda del carril de 68 px', () => {
  // Medido a 768 px: el sidebar colapsa a 68 px, pero .brand-lockup conservaba
  // 115 px de ancho y su monograma quedaba en -24..14 px, cortado por el borde.
  const collapsed = appSource.match(/@media \(max-width: 850px\) \{([\s\S]*?)\n\}/)?.[1]
  assert.ok(collapsed, 'debe existir el tramo de sidebar colapsado')
  assert.match(
    collapsed,
    /\.brand-lockup\s*\{[^}]*width:\s*100%/,
    'la marca debe ocupar el ancho disponible del carril, no desbordarlo',
  )
})

test('el panel de busqueda de espacios baja a dos columnas antes de 768 px', () => {
  const spacesPath = fileURLToPath(new URL('../src/features/spaces/SpaceGuidePage.scss', import.meta.url))
  const spacesSource = readFileSync(spacesPath, 'utf8')

  // Un tramo max-width:X se activa en cualquier viewport de hasta X px, asi que
  // para entrar en tablet de 768 px el corte debe quedar en 768 px o por encima.
  const twoColumnQuery = [...spacesSource.matchAll(/@media \(max-width: (\d+)px\) \{([\s\S]*?)\n\}/g)]
    .find(([, width, body]) =>
      Number(width) >= 768 && /\.spaces-search-panel\s*\{[^}]*grid-template-columns:\s*repeat\(2/.test(body))

  assert.ok(twoColumnQuery, 'debe existir un tramo de dos columnas activo a 768 px o menos')
  const width = Number(twoColumnQuery[1])
  assert.ok(width >= 768, `el tramo de dos columnas debe alcanzar 768 px, actual ${width}`)
  assert.match(
    twoColumnQuery[2],
    /\.spaces-search-field,\s*\.spaces-result-count\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/,
    'el contador de resultados debe ocupar la fila completa para no desbordar',
  )
})