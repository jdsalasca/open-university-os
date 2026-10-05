import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

// Barrido medido en el navegador el 5 de octubre de 2026 en tres anchos (360, 768 y 1024 px)
// sobre diez rutas: 38 recortes reales, siendo los mas graves el nombre de la institucion
// cortado a 156 px, la navegacion del preview a 376 px y el titulo del heroe a 36 px.
//
// El desborde horizontal del documento daba 0 en los cinco anchos probados, asi que el
// documento NO crecia: el contenido se perdia dentro de su propio contenedor. Un detector que
// solo mire scrollWidth del body no encuentra nada.
const scss = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')

test('el nombre de la institucion no se recorta en el sidebar', () => {
  // Arrange
  const app = scss('../src/App.scss')

  // Act: Sass anida `.brand-lockup-copy` dentro de `.sidebar`, asi que el bloque se lee por
  // indice y no por expresion regular: los comentarios de la regla romperian cualquier patron.
  const inicio = app.indexOf('.brand-lockup-copy {')
  const fuerteInicio = app.indexOf('strong {', inicio)
  const fuerte = app.slice(fuerteInicio, app.indexOf('}', fuerteInicio))

  // Assert
  assert.ok(fuerte, 'debe existir la regla del nombre de la institucion')
  assert.doesNotMatch(
    fuerte,
    /text-overflow:\s*ellipsis/,
    'el nombre no debe truncarse con puntos suspensivos: el sidebar tiene ancho para dos lineas',
  )
  assert.match(fuerte, /white-space:\s*normal/, 'el nombre debe poder ocupar dos lineas')
  assert.doesNotMatch(fuerte, /max-width:\s*\d+px/, 'un max-width fijo en px es lo que provoca el recorte')
})

test('la navegacion del preview puede desplazarse en vez de recortar su contenido', () => {
  // Arrange: medido a 1024 px la fila de estados media 676 px de contenido en 383 px visibles.
  // Con `overflow: hidden` el texto se perdia sin dejar señal; con `overflow-x: auto` la persona
  // puede desplazar la fila y leer los estados que no caben.
  const branding = scss('../src/features/branding/VisualIdentityCenter.scss')

  // Act
  const bloque = branding.match(/\.preview-navigation\s*\{([^}]*)\}/)?.[1]

  // Assert
  assert.ok(bloque, 'debe existir la regla de la navegacion del preview')
  assert.match(bloque, /overflow-x:\s*auto/, 'con overflow hidden la fila de estados se pierde sin dejar salida')
  assert.doesNotMatch(bloque, /overflow:\s*hidden/, 'overflow hidden a secas no ofrece ninguna salida')
})

test('el heroe del preview recorta su orbita decorativa sin perder el texto', () => {
  // Arrange: `.preview-orbit` es una figura absoluta que sobresale 10 px a la derecha del marco
  // (medido a 1024 px: la orbita llegaba a 659 px contra un borde visible en 649). Con
  // `overflow: visible` esa figura asoma fuera del heroe; con `overflow: hidden` el titulo
  // tambien se recortaba a 36 px. Ninguna de las dos sirve sola: hay que recortar la orbita por
  // su propia cuenta y dejar el heroe intacto.
  const branding = scss('../src/features/branding/VisualIdentityCenter.scss')

  // Act
  const hero = branding.match(/\.preview-hero\s*\{([^}]*)\}/)?.[1]
  const orbita = branding.match(/\.preview-orbit\s*\{([^}]*)\}/)?.[1]

  // Assert
  assert.ok(hero, 'debe existir la regla del heroe del preview')
  assert.match(hero, /overflow:\s*hidden/, 'el heroe debe seguir conteniendo su decoracion')
  assert.ok(orbita, 'debe existir la regla de la orbita decorativa')
  // Medido a 1024 px: con `right: -10px` la orbita llegaba a 659 px y el heroe se terminaba en
  // 649, así que 10 px de la figura quedaban fuera del marco. La salida es alinear la figura
  // dentro del borde: no hace falta ningun recorte adicional y el titulo queda intacto.
  assert.doesNotMatch(orbita, /right:\s*-\d+px/, 'la orbita no debe salirse del marco del heroe')
})

test('los heroes con decoracion absolute conservan su recorte a proposito', () => {
  // Arrange: los heroes de espacios, admisiones y accesos llevan una figura decorativa
  // posicionada fuera del borde (::before/::after con right negativo). Medido a 360 px, el
  // ancho del contenido excede al visible por 46, 48 y 48 px, y esa diferencia es **exactamente**
  // el ancho de la decoracion que sobresale, no el texto. Cambiar overflow a visible dejaria
  // circles asomando fuera del marco.
  const objetivos = [
    ['espacios', '../src/features/spaces/SpaceGuidePage.scss', /\.spaces-hero\s*\{([^}]*)\}/],
    ['admisiones', '../src/features/admissions/AdmissionsCalendarPage.scss', /\.admissions-call-card\s*\{([^}]*)\}/],
    ['accesos', '../src/features/access/RoleAccessPage.scss', /\.role-access-hero\s*\{([^}]*)\}/],
  ]

  // Act + Assert
  for (const [nombre, archivo, patron] of objetivos) {
    const contenido = scss(archivo)
    const bloque = contenido.match(patron)?.[1]
    assert.ok(bloque, `debe existir el heroe de ${nombre}`)
    assert.match(bloque, /overflow:\s*hidden/, `${nombre} debe seguir recortando su decoracion`)
    assert.match(
      contenido,
      /(::before|::after)[\s\S]{0,220}?(position:\s*absolute|right:\s*-\d+px)/,
      `${nombre} debe declarar la decoracion absoluta que justifica el recorte`,
    )
  }
})
