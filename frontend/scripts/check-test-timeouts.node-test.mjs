import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const viteConfig = readFileSync(fileURLToPath(new URL('../vite.config.ts', import.meta.url)), 'utf8')
const setup = readFileSync(fileURLToPath(new URL('../src/test/setup.ts', import.meta.url)), 'utf8')

// En un host cargado los archivos mas pesados tardan 15-35 s, pero Vitest aborta a
// los 5 s por defecto y findBy a 1 s. Medido en esta maquina: cinco corridas
// seguidas dejaron 13 pruebas en rojo, siempre en un archivo distinto y siempre el
// mas lento, mientras la CI alojada pasaba entera. Los tiempos por defecto son
// parametros de la infraestructura, no del producto: basta con declararlos.
test('la suite declara un timeout por test acorde a un host cargado', () => {
  const declared = viteConfig.match(/testTimeout:\s*(\d+)/)?.[1]
  assert.ok(declared, 'vite.config.ts debe declarar testTimeout de forma explicita')
  assert.ok(Number(declared) >= 20000, `testTimeout debe ser de al menos 20000 ms, actual ${declared}`)
})

test('las utilidades asincronas de testing-library tienen margen propio', () => {
  assert.match(setup, /configure\s*\(/, 'el setup debe configurar testing-library')
  const declared = setup.match(/asyncUtilTimeout:\s*(\d+)/)?.[1]
  assert.ok(declared, 'el setup debe declarar asyncUtilTimeout de forma explicita')
  assert.ok(Number(declared) >= 10000, `asyncUtilTimeout debe ser de al menos 10000 ms, actual ${declared}`)
})