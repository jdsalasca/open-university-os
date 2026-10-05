import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const spacesPath = fileURLToPath(new URL('../src/features/spaces/SpaceGuidePage.scss', import.meta.url))
const spaces = readFileSync(spacesPath, 'utf8')
const spacesViewPath = fileURLToPath(new URL('../src/features/spaces/SpaceGuidePage.tsx', import.meta.url))
const spacesView = readFileSync(spacesViewPath, 'utf8')

// Medido a 1440 px el 5 de octubre de 2026: los enlaces de mapa y de fuente de
// cada tarjeta median 12 px de alto con tipografia de 9 px. WCAG 2.2 pide 24 px
// como area tactil minima (2.5.8, nivel AA). Con 6 px de padding a cada lado el
// alto pasa de 12 a 24, y el margen compensatorio evita mover el resto del diseno.
test('los enlaces de la ficha tienen area tactil de 24 px sin desplazar el diseno', () => {
  const rule = spaces.match(/\.spaces-map-link,\s*\.spaces-source-link\s*\{([^}]*)\}/)?.[1]
  assert.ok(rule, 'deve existir la regla compartida de los enlaces de ficha'.replace('deve', 'debe'))
  assert.match(rule, /padding-block:\s*(\d+)px/, 'necesita padding block')
  const padding = Number(rule.match(/padding-block:\s*(\d+)px/)[1])
  assert.ok(padding >= 6, `6 px a cada lado llevan el alto de 12 a 24 px, actual ${padding}`)
  assert.match(rule, /margin-block:\s*-\d+px/, 'el margen negativo compensa el padding para no mover el layout')
  assert.match(rule, /display:\s*inline-block/, 'inline-block permite que el padding vertical se aplique')
})

// El contenedor del buscador mide 43 px, pero el input dentro solo 15 px: el clic en
// los lados del campo no enfocaba el control.
test('el campo de busqueda ocupa toda la altura de su contenedor', () => {
  const rule = spaces.match(/\.spaces-search-control input\s*\{([^}]*)\}/)?.[1]
  assert.ok(rule, 'debe existir la regla del input del buscador')
  assert.match(rule, /align-self:\s*stretch/, 'el input debe estirarse para cubrir la altura del campo')
})

// El input del buscador se etiqueta con un <label> envolvente. El auditor lo
// aceptaba como nombre accesible, y al estirar el input el clic en cualquier punto
// del campo lo enfoca, que era el defecto.
test('el campo de busqueda se etiqueta con un label envolvente', () => {
  assert.match(spacesView, /<label className="spaces-search-field">/, 'el buscador necesita label envolvente')
  const bloque = spacesView.match(/<label className="spaces-search-field">([\s\S]*?)<\/label>/)?.[1]
  assert.ok(bloque, 'el label debe envolver su control')
  assert.match(bloque, /<input/, 'el input de texto va dentro del label')
  assert.match(bloque, /type="search"/, 'el buscador se declara como campo de busqueda')
})