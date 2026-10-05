import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

// Barrido responsive del 5 de octubre de 2026: `.identity-session-status` se recortaba entre 11 y
// 28 px en ocho de las diez rutas. Es el aviso que le dice a la persona que esta mirando datos
// sinteticos y que la sesion no es institucional, asi que truncarlo anula el aviso: la mitad del
// texto "Desarrollador local · preview activo" no llega a leerse.
const app = readFileSync(fileURLToPath(new URL('../src/App.scss', import.meta.url)), 'utf8')
const tsx = readFileSync(fileURLToPath(new URL('../src/App.tsx', import.meta.url)), 'utf8')

const bloque = /\.(identity-session-status)\s*\{([^}]*)\}/.exec(app)
const cuerpo = bloque?.[2] ?? ''

test('el aviso de sesion no se trunca', () => {
  // Assert
  assert.ok(cuerpo, 'debe existir la regla del aviso de sesion')
  assert.doesNotMatch(cuerpo, /text-overflow:\s*ellipsis/, 'los puntos suspensivos ocultan que la sesion es sintetica')
  assert.doesNotMatch(cuerpo, /white-space:\s*nowrap/, 'una sola linea obliga a recortar en pantallas estrechas')
  assert.doesNotMatch(cuerpo, /max-width:\s*\d+px/, 'un ancho maximo fijo en px es la causa del recorte')
})

test('el aviso de sesion sigue siendo un aviso live cuando hay error', () => {
  // Arrange: es el unico lugar donde React anuncia un fallo de identidad, asi que perder el
  // aria-live significaria que el error aparece sin que un lector de pantalla lo diga.
  // Act
  const conEstado = /className=\{`identity-session-status is-\$\{identity\.status\}`\}\s*\n?\s*role=\{identity\.status === 'error' \? 'status' : undefined\}\s*\n?\s*aria-live="polite"/.test(tsx)

  // Assert
  assert.ok(conEstado, 'el aviso debe conservar role y aria-live')
})

test('el aviso de sesion cabe sin recortar en el hueco de la barra superior', () => {
  // Arrange: la barra superior es una fila flex. Si el aviso puede ocupar dos lineas, necesita
  // poder crecer en vertical sin romper la alineacion del resto de controles.
  // Assert: sin `white-space: nowrap` el valor por defecto ya permite el salto de linea, asi que
  // lo que se exige es que no lo vuelva a fijar y que declare su propio interlineado.
  assert.doesNotMatch(cuerpo, /white-space:\s*nowrap/, 'no debe volver a forzar una sola linea')
  assert.match(cuerpo, /line-height:\s*1\.\d+/, 'con interlineado propio, para que dos lineas no se peguen')
  assert.match(cuerpo, /min-width:\s*0/, 'para que ceda ancho al resto de la fila flex en vez de desbordarse')
})
