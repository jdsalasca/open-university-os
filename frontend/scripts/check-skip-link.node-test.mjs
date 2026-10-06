// `.skip-link` es el enlace que permite saltar al contenido principal. Recorriendo la pagina con
// Tab el 5 de octubre de 2026 se vio que quedaba 30 lineas mas arriba del elemento anterior: la
// persona veia el anillo saltar hacia atras en cada vuelta, porque el enlace sigue ocupando
// lugar en el flujo del sidebar aunque este apartado con `top: -50px`.
//
// La convencion es que exista en el DOM pero solo aparezca cuando recibe el foco. Aqui se exige
// que salga del flujo y que tenga fondo y contraste propios: si se limitara a mover el `top`, al
// recibir el foco apareceria sobre el sidebar oscuro con el texto del tema oscuro, ilegible.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const app = readFileSync(fileURLToPath(new URL('../src/App.scss', import.meta.url)), 'utf8')
const tsx = readFileSync(fileURLToPath(new URL('../src/App.tsx', import.meta.url)), 'utf8')

// Sass anida `&:focus-visible` dentro de la regla, asi que se lee el bloque entero.
const inicio = app.indexOf('.skip-link {')
const bloqueEntero = app.slice(inicio, app.indexOf('\n}', inicio) + 2)
const base = /^\.skip-link\s*\{([\s\S]*?)\n\s*\}/.exec(bloqueEntero)?.[1] ?? ''
const alEnfocar = /&:focus-visible\s*\{([^}]*)\}/.exec(bloqueEntero)?.[1] ?? ''
const inicioMovil = app.indexOf('@media (max-width: 650px)')
const finMovil = app.indexOf('@media (max-width: 320px)', inicioMovil)
const bloqueMovil = inicioMovil >= 0 && finMovil > inicioMovil ? app.slice(inicioMovil, finMovil) : ''
const reglaMovil = /\.skip-link\s*\{([^}]*)\}/.exec(bloqueMovil)?.[1] ?? ''

test('el enlace para saltar al contenido sale del flujo y solo se ve al recibir el foco', () => {
  // Assert
  assert.match(base, /position:\s*absolute/, 'fuera del flujo: no debe ocupar sitio en el sidebar')
  assert.match(base, /top:\s*-\d+px/, 'la regla base lo aparta de la pantalla')
  assert.ok(alEnfocar, 'debe existir la regla que lo devuelve al enfocar')
  assert.match(alEnfocar, /top:\s*\d+px/, 'al enfocarse vuelve a la pantalla')
})

test('en movil el enlace de salto se oculta respecto al viewport, no junto a la barra inferior', () => {
  // Arrange
  assert.ok(reglaMovil, 'el breakpoint móvil necesita una regla propia para el enlace')

  // Assert
  assert.match(reglaMovil, /position:\s*fixed/, 'su posicion no debe depender del sidebar fijado abajo')
  assert.match(reglaMovil, /top:\s*-\d+px/, 'sin foco debe permanecer por encima del viewport')
})

test('el enlace de salto es legible sobre el sidebar cuando aparece', () => {
  // Arrange: el sidebar es oscuro. Un enlace sin fondo propio se dibujar��a en gris claro sobre
  // ese fondo y no se leeria justo en el momento en que la persona lo necesita.
  // Assert
  assert.match(base, /background:\s*var\(--ui-surface/, 'necesita fondo propio para contrastar')
  assert.match(base, /color:\s*var\(--ui-text-primary/, 'el texto debe venir del tema')
  assert.match(base, /padding-block|padding:\s*\S+\s+\d+px/, 'con relleno para alcanzar 24 px de alto')
  assert.match(base, /z-index:\s*\d+/, 'debe quedar por encima del sidebar al aparecer')
})

test('el enlace de salto recibe foco antes que la navegacion', () => {
  // Arrange: en el DOM el skip-link va antes de la marca y del nav, que es lo correcto. El
  // defecto era visual, no de orden del documento.
  // Act
  const indiceSkip = tsx.indexOf('skip-link')
  const indiceNav = tsx.indexOf('<nav className="primary-nav"')

  // Assert
  assert.ok(indiceSkip > 0 && indiceNav > 0, 'deben existir ambos en App.tsx')
  assert.ok(indiceSkip < indiceNav, 'el enlace de salto debe ir antes de la navegacion en el DOM')
  assert.match(tsx, /onClick=\{\(\) => document\.getElementById\(mainContentId\)\?\.focus\(\)\}/,
    'al pulsarlo, el foco debe saltar al contenido principal, no solo cambiar el hash')
})
