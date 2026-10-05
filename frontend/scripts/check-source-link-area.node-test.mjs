import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

// Barrido medido en el navegador el 5 de octubre de 2026 sobre once rutas y dos temas: 74
// enlaces con texto quedaron por debajo de 24 px de alto, entre 12 y 21 px, repartidos en cuatro
// rutas. Todos son enlaces de fuente oficial o de referencia. Un enlace de texto de 12 px se
// puede pulsar, pero no con facilidad, y WCAG 2.2 pide 24 px como area tactil minima (2.5.8, AA).
const scss = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')

// Cada entrada nombra el selector del enlace medido y el archivo donde vive. Un solo conjunto
// para los cuatro sitios: son el mismo defecto y asi queda claro que arreglar uno no basta.
const CASOS = [
  { nombre: 'servicios estudiantiles', archivo: '../src/features/students/StudentServicesPage.scss', selector: '.student-service-card-bottom a' },
  { nombre: 'calendario de admisiones', archivo: '../src/features/admissions/AdmissionsCalendarPage.scss', selector: '.admissions-call-timeline a' },
  { nombre: 'guia de espacios', archivo: '../src/features/spaces/SpaceGuidePage.scss', selector: '.spaces-source-link' },
  { nombre: 'directorio de programas', archivo: '../src/features/academics/publicCatalog/PublicProgramDirectory.scss', selector: '.public-program-card h3 a' },
]

for (const { nombre, archivo, selector } of CASOS) {
  test(`el enlace de fuente de ${nombre} alcanza 24 px de alto`, () => {
    // Arrange
    const contenido = scss(archivo)
    const clase = selector.split(/\s+/).pop().replace(/^.*\./, '')
    // Un enlace que el navegador midio por debajo de 24 px tiene que ser detectado por el guard.

    // Act: se buscan los bloques que declaran `display`, no cualquier mencion de la clase. El
    // mismo enlace tiene reglas de color, subrayado y foco, y esas no llevan area tactil.
    const bloques = [...contenido.matchAll(new RegExp('\\.' + clase + '\\s*,\\s*[^\\{]*\\{([^}]*)\\}', 'g')),
      ...contenido.matchAll(new RegExp('\\.' + clase + '\\s*\\{([^}]*)\\}', 'g'))]
      .map(([, cuerpo]) => cuerpo)
    const sinArea = bloques
      .filter((cuerpo) => /display:\s*(?:inline-flex|inline-block|flex|grid|block)/.test(cuerpo))
      .filter((cuerpo) => !/min-height:\s*2[4-9]px/.test(cuerpo))
      .filter((cuerpo) => !/padding-block:\s*(?:3px|[4-9]px|1\d+px)|padding:\s*\S+\s+(?:3px|[4-9]px|1\d+px)/.test(cuerpo))

    // Assert
    assert.deepEqual(sinArea, [], 'el enlace debe declarar min-height de 24 px o padding suficiente')
  })
}
