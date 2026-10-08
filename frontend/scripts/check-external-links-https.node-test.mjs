import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

// Auditoría del 7 de octubre de 2026: 262 URLs externas reales, 250 verdes, 12 señaladas y las 12
// descartadas como fixtures de test o límite de tasa del auditor. Cero enlaces muertos de cara al
// usuario. Lo que sí protege este guard hacia adelante: que ningún enlace de producción use `http://`
// sin cifrar. Los tests usan `http://localhost` y señuelos `.example` a propósito; aquí no cuentan.
const raiz = fileURLToPath(new URL('../src', import.meta.url))

const recorrer = (dir) => {
  if (!statSync(dir).isDirectory()) return []
  return readdirSync(dir).flatMap((entrada) => {
    const ruta = join(dir, entrada)
    return statSync(ruta).isDirectory() ? recorrer(ruta) : [ruta]
  })
}

const PERMITIDOS = [
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//,
  /^http:\/\/backend(:\d+)?\//,
]

function enlacesInseguros() {
  const hallazgos = []
  for (const archivo of recorrer(raiz)) {
    if (!/\.(ts|tsx)$/.test(archivo) || /\.test\./.test(archivo)) continue
    const lineas = readFileSync(archivo, 'utf8').split('\n')
    lineas.forEach((linea, i) => {
      for (const m of linea.matchAll(/http:\/\/[A-Za-z0-9._~:/?#@!$&'()*+,;=%-]+/g)) {
        if (!PERMITIDOS.some((p) => p.test(m[0]))) {
          hallazgos.push(`${archivo.split('src')[1]}:${i + 1}: ${m[0].slice(0, 80)}`)
        }
      }
    })
  }
  return hallazgos
}

test('production external links use https', () => {
  // Arrange + Act
  const inseguros = enlacesInseguros()

  // Assert
  assert.deepEqual(inseguros, [], `enlaces http:// sin cifrar en producción: ${inseguros.join(', ')}`)
})
