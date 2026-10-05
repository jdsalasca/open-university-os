import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const srcRoot = fileURLToPath(new URL('../src/', import.meta.url))

const stylesheets = (directory = srcRoot) => readdirSync(directory).flatMap((entry) => {
  const full = join(directory, entry)
  return statSync(full).isDirectory() ? stylesheets(full) : (full.endsWith('.scss') ? [full] : [])
})

const luminance = (channels) => {
  const [r, g, b] = channels.map((value) => {
    const s = value / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a, b) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}
const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

// Superficies claras reales del portal: fondo de pagina y tarjetas.
const SUPERFICIES = ['#f4f4f0', '#ffffff', '#fafaf6']

// Auditoria de 2026-10-05 sobre las seis rutas publicas. Estos son los colores de
// texto que quedaron bajo WCAG AA en tema claro y que se sustituyeron por su
// equivalente accesible conservando el tono. Volver a introducirlos devuelve el
// texto ilegible; la lista viene de docs/evidence/round-2026-10-05-accesibilidad.
const SUSTITUIDOS = ['#85877d', '#989990', '#77786f', '#777970', '#7b7d72', '#797a72']

test('ningun color de texto medido bajo AA vuelve a los estilos', () => {
  const reincidentes = []
  for (const file of stylesheets()) {
    const source = readFileSync(file, 'utf8')
    for (const color of SUSTITUIDOS) {
      if (source.toLowerCase().includes(color)) reincidentes.push(`${file.split('/').pop()}: ${color}`)
    }
  }
  assert.deepEqual(reincidentes, [], `colores bajo AA reintroducidos: ${reincidentes.join(', ')}`)
})

test('los sustitutos alcanzan AA sobre cada superficie clara', () => {
  for (const color of ['#6e7067', '#6f7069', '#6f7067', '#6e7068', '#6e7066', '#6f7068']) {
    for (const surface of SUPERFICIES) {
      const value = ratio(channels(color), channels(surface))
      assert.ok(
        value >= 4.5,
        `${color} sobre ${surface} da ${value.toFixed(2)} y necesita 4,5`,
      )
    }
  }
})