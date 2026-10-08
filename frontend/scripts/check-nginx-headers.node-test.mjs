import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

// Medido en la imagen de producción el 8 de octubre de 2026: el documento principal volvía sin
// `X-Content-Type-Options` ni `Referrer-Policy` aunque `nginx.conf` las declaraba. La causa es una
// trampa clásica de nginx: `add_header` dentro de un `location` REEMPLAZA las heredadas, no se suma.
// Como `/` cae en `location = /index.html` (por la directiva `index`), que declara su propio
// `Cache-Control`, las dos de seguridad desaparecían justo en el documento más importante.
//
// Por eso no basta con que existan en el archivo: cada bloque `location` que declare cabeceras debe
// repetir las dos de seguridad, y este guard lo exige.
const conf = readFileSync(fileURLToPath(new URL('../nginx.conf', import.meta.url)), 'utf8')
  // Los comentarios mencionan `location` y llaves; se quitan antes de parsear para que no confundan
  // las expresiones (este guard ya falló una vez por su propio comentario).
  .split('\n').map((l) => l.replace(/#.*$/, '')).join('\n')

function bloquesLocation() {
  const bloques = []
  const re = /location[^{]*\{([^{}]*)\}/g
  let m
  while ((m = re.exec(conf)) !== null) bloques.push(m[1])
  return bloques
}

const SEGURIDAD = ['X-Content-Type-Options', 'Referrer-Policy']

test('every nginx location that sets headers repeats the security headers', () => {
  // Arrange
  const bloques = bloquesLocation()
  assert.ok(bloques.length >= 2, 'nginx.conf must declare location blocks')

  // Act + Assert
  for (const bloque of bloques) {
    if (!/add_header/.test(bloque)) continue
    for (const cabecera of SEGURIDAD) {
      assert.match(
        bloque,
        new RegExp(`add_header\\s+${cabecera}`),
        `location block must repeat ${cabecera} or it silently drops it: ${bloque.trim().slice(0, 60)}`,
      )
    }
  }
})

test('the security headers live at server level too', () => {
  // Arrange: todo lo que está fuera de cualquier bloque location.
  const fuera = conf.replace(/location[^{]*\{[^{}]*\}/g, '')

  // Assert
  for (const cabecera of SEGURIDAD) {
    assert.match(fuera, new RegExp(`add_header\\s+${cabecera}`), `server level must declare ${cabecera}`)
  }
})
