import assert from 'node:assert/strict'
import { test } from 'node:test'

// El detector responsive reportaba 25 recortes y, al medir uno por uno, todos eran decoracion:
// los circulos `::before`/`::after` que sobresalen del marco a proposito. Ningun hijo real se
// perdia. El criterio que faltaba es simple: si el elemento se desborda pero ninguno de sus hijos
// directos excede el ancho visible, lo que excede no es contenido, son pseudo-elementos.
//
// La funcion vive en el script de medicion y aqui se prueba con markup real para que no vuelva a
// contar circulos decorativos como texto perdido.
function excedePorPseudoElementos(datos) {
  const { visible, contenido, hijos } = datos
  if (contenido - visible <= 2) return false
  // Un hijo posicionado fuera del flujo es decoracion aunque exceda: los heroes llevan la figura
  // dentro del contenedor y por eso `overflow: hidden` sigue siendo lo correcto.
  return !hijos.some((hijo) => !hijo.posicionado && hijo.scrollWidth - hijo.visible > 2)
}

test('un desborde sin hijos que excedan viene de pseudo-elementos, no de contenido', () => {
  // Arrange: el caso real de `.catalog-empty`, con circulos de 220 px en ::before y ::after.
  const datos = {
    visible: 736,
    contenido: 839,
    hijos: [
      { visible: 73, scrollWidth: 73, posicionado: false },
      { visible: 136, scrollWidth: 136, posicionado: false },
      { visible: 441, scrollWidth: 441, posicionado: false },
      { visible: 460, scrollWidth: 460, posicionado: false },
    ],
  }

  // Act + Assert
  assert.ok(excedePorPseudoElementos(datos), 'los circulos decorativos no son contenido perdido')
})

test('un hijo en el flujo que excede si es contenido perdido', () => {
  // Arrange: el caso real de `.identity-session-status` antes del arreglo.
  const datos = {
    visible: 240,
    contenido: 268,
    hijos: [{ visible: 240, scrollWidth: 268, posicionado: false }],
  }

  // Act + Assert
  assert.ok(!excedePorPseudoElementos(datos), 'un hijo que excede es texto que se pierde')
})

test('un hijo absoluto que excede sigue siendo decoracion', () => {
  // Arrange: `.spaces-hero` y `.role-access-hero` declaran su figura decorativa como hijo
  // absoluto dentro del marco. Su `overflow: hidden` es correcto y el detector anterior lo contaba
  // como texto perdido.
  const datos = {
    visible: 334,
    contenido: 380,
    hijos: [
      { visible: 292, scrollWidth: 292, posicionado: false },
      { visible: 145, scrollWidth: 145, posicionado: true },
    ],
  }

  // Act + Assert
  assert.ok(excedePorPseudoElementos(datos), 'la figura absoluta que sobresale es decoracion')
})

test('sin desborde no hay nada que clasificar', () => {
  assert.ok(!excedePorPseudoElementos({ visible: 100, contenido: 100, hijos: [] }))
  assert.ok(!excedePorPseudoElementos({ visible: 100, contenido: 101, hijos: [] }), 'un margen de 1 px no cuenta')
})

test('el caso sin hijos tambien se considera decoracion', () => {
  // Un contenedor vacio con decoracion de fondo no pierde texto: no tiene texto.
  assert.ok(excedePorPseudoElementos({ visible: 200, contenido: 260, hijos: [] }))
})
