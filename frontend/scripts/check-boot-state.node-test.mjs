import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const htmlPath = fileURLToPath(new URL('../index.html', import.meta.url))
const html = readFileSync(htmlPath, 'utf8')
const scss = readFileSync(fileURLToPath(new URL('../src/index.scss', import.meta.url)), 'utf8')

// Medido el 5 de octubre de 2026 con la red limitada a 25 kB/s: /#resumen queda
// en blanco hasta que descargan los ~280 kB del bundle y monta React. El repositorio
// exige que toda pantalla tenga estado de carga, y el shell no puede depender del
// propio JavaScript que todavia no ha llegado.
test('el documento declara un estado de carga antes de que monte la aplicacion', () => {
  const raiz = html.match(/<div id="root"[^>]*>([\s\S]*?)<\/div>/)?.[1]
  assert.ok(raiz, 'debe existir el contenedor root con contenido inicial')
  assert.notEqual(raiz.trim(), '', 'root no puede arrancar vacio')
})

test('el estado de carga inicial es anunciable y legible sin estilos', () => {
  const raiz = html.match(/<div id="root"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? ''
  assert.match(raiz, /role="status"/, 'debe anunciarse con role=status')
  assert.match(raiz, /aria-live="polite"/, 'no debe interrumpir con assertive')
  // El texto va visible y no solo en aria-label: hasta que llega el CSS del
  // bundle este bloque se ve sin estilo, y hace falta algo legible en pantalla.
  assert.match(raiz, /Cargando la plataforma universitaria/,
    'el mensaje debe ser texto real, no un atributo accesible invisible')
  assert.doesNotMatch(raiz, /aria-hidden="true"/, 'ninguna parte del mensaje puede ocultarse')
})

test('el estado de carga inicial no depende del estilo en linea', () => {
  const raiz = html.match(/<div id="root"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? ''
  assert.doesNotMatch(raiz, /style="/, 'el repositorio prohibe estilos en linea')
})

test('el estado de carga inicial tiene regla SCSS propia', () => {
  assert.match(scss, /\.app-boot\b/, 'debe existir la clase en los estilos del proyecto')
})

test('la aplicacion monta despues del marcador inicial', () => {
  assert.match(html, /<script type="module" src="\/src\/main\.tsx">/,
    'el marcador se limpia al montar React, no antes')
})