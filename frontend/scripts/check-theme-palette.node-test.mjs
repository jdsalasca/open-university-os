import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const themePath = fileURLToPath(new URL('../src/styles/_theme.scss', import.meta.url))
const theme = readFileSync(themePath, 'utf8')
const srcRoot = fileURLToPath(new URL('../src/', import.meta.url))

const stylesheets = (dir = srcRoot) => readdirSync(dir).flatMap((entry) => {
  const full = join(dir, entry)
  return statSync(full).isDirectory() ? stylesheets(full) : (full.endsWith('.scss') ? [full] : [])
})

const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const luminance = (c) => {
  const [r, g, b] = c.map((value) => {
    const s = value / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a, b) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

// El tema claro declara un solo token: el que los componentes consumen. Declarar
// una paleta completa sin consumidores seria sobreingenieria y ademas cabria en
// el presupuesto de CSS de entrada, que esta medido.
const bloqueClaro = theme.match(/^:root\s*\{([\s\S]*?)\n\}/m)?.[1]
const bloqueOscuro = theme.match(/:root\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/)?.[1]

const token = (bloque, nombre) => bloque?.match(new RegExp(`${nombre}:\\s*(#[0-9a-fA-F]{6})`))?.[1]?.toLowerCase()

const SUPERFICIES = ['#f4f4f0', '#ffffff', '#fafaf6']

test('el tema claro declara el token de texto secundario que consumen los componentes', () => {
  assert.ok(bloqueClaro, 'debe existir el bloque :root del tema claro')
  assert.ok(token(bloqueClaro, '--ui-text-muted'), '--ui-text-muted debe estar declarado en claro')
})

test('el texto secundario claro alcanza AA sobre las superficies claras', () => {
  for (const superficie of SUPERFICIES) {
    const value = ratio(channels(token(bloqueClaro, '--ui-text-muted')), channels(superficie))
    assert.ok(value >= 4.5, `--ui-text-muted sobre ${superficie} da ${value.toFixed(2)} y necesita 4,5`)
  }
})

test('el tema oscuro conserva su paleta completa y accesible', () => {
  assert.ok(bloqueOscuro, 'debe existir el bloque de tema oscuro')
  for (const t of ['--ui-canvas', '--ui-surface', '--ui-surface-subtle', '--ui-text-primary', '--ui-text-secondary', '--ui-text-muted']) {
    assert.ok(token(bloqueOscuro, t), `${t} debe estar declarado en el tema oscuro`)
  }
  for (const texto of ['--ui-text-primary', '--ui-text-secondary', '--ui-text-muted']) {
    for (const superficie of ['--ui-canvas', '--ui-surface', '--ui-surface-subtle']) {
      const value = ratio(channels(token(bloqueOscuro, texto)), channels(token(bloqueOscuro, superficie)))
      assert.ok(value >= 4.5, `${texto} sobre ${superficie} da ${value.toFixed(2)} y necesita 4,5`)
    }
  }
})

test('el tema oscuro gana cuando el atributo esta activo', () => {
  // Si el selector oscuro tuviera menos especificidad que :root, el tema claro
  // pisaria los valores al alternar.
  assert.match(theme, /:root\[data-theme='dark'\]/, 'el tema oscuro debe seleccionarse por atributo')
  assert.match(theme, /@media \(prefers-color-scheme: dark\)/, 'debe respetarse la preferencia del sistema')
})

// El literal vive en _theme.scss, que es la fuente. Buscarlo ahi seria exigir
// que el token se defina a si mismo.
const estilos = () => stylesheets().filter((file) => !file.endsWith(join('styles', '_theme.scss')))

test('el gris secundario del tema claro es una unica fuente, no un literal repetido', () => {
  const repetidos = estilos()
    .flatMap((file) => {
      const directos = (readFileSync(file, 'utf8').toLowerCase()
        .replaceAll(new RegExp(`var\\([^)]*#6b6d63[^)]*\\)`, 'gi'), '')
        .match(/#6b6d63/g) ?? []).length
      return directos > 0 ? [`${file.split(/[\\/]/).pop()}: ${directos}`] : []
    })
  assert.deepEqual(repetidos, [], 'usa var(--ui-text-muted) en lugar del literal #6b6d63')
})

// Un literal es legitimo como valor de reserva de var(): el elemento cae al color
// si el token no existe. Lo que no vale es fijar el color en la regla.
const comoValorDirecto = (source, color) => source
  .replaceAll(new RegExp(`var\\([^)]*${color}[^)]*\\)`, 'gi'), '')
  .includes(color)

test('los seis grises medidos no quedan fijados en los estilos', () => {
  const sueltos = estilos().filter((file) => {
    const source = readFileSync(file, 'utf8').toLowerCase()
    return ['#6e7068', '#6e7069', '#6f7069', '#6e7067', '#6e7066', '#6b6d63']
      .some((c) => comoValorDirecto(source, c))
  })
  assert.deepEqual(sueltos.map((f) => f.split(/[\\/]/).pop()), [], 'los grises deben venir del token')
})

test('el token se usa de verdad en los componentes', () => {
  const usos = estilos().reduce((total, file) => total + (readFileSync(file, 'utf8').match(/var\(--ui-text-muted\)/g)?.length ?? 0), 0)
  assert.ok(usos >= 30, `el token debe sustituir a los literales medidos, hay ${usos} usos`)
})