import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

// Auditoria del navegador el 5 de octubre de 2026: once rutas, once hashes distintos en los
// enlaces internos y cero enlaces rotos. Eso es una linea base, no una proteccion: un
// `href="#inventado"` en cualquier componente lleva a una pagina en blanco, porque `App.tsx`
// devuelve la portada para cualquier hash que no reconozca.
//
// Este guard se Adelantaza: no espera al navegador, comprueba que todo hash enlazado desde el codigo
// sea una ruta que la aplicacion sabe montar.
const raiz = fileURLToPath(new URL('..', import.meta.url))
const app = readFileSync(join(raiz, 'src/App.tsx'), 'utf8')

// Las rutas se derivan de la propia funcion de resolucion de `App.tsx`, no de una lista escrita a
// mano: si anadir una ruta al navigador tambien la anade aqui, y si no, el guard avisa.
const resolver = /function readApplicationView\(\):[\s\S]*?\n\}/.exec(app)?.[0] ?? ''
const hashesMontados = new Set(
  [...resolver.matchAll(/location\.hash === '#([a-z-]+)'/g)].map((m) => `#${m[1]}`),
)

function archivosConEnlaces(dir) {
  const salida = []
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) salida.push(...archivosConEnlaces(ruta))
    else if (/\.tsx?$/.test(nombre) && !nombre.endsWith('.test.tsx') && !nombre.endsWith('.test.ts')) {
      salida.push(ruta)
    }
  }
  return salida
}

test('App.tsx declara las once rutas que la aplicacion monta', () => {
  // Assert: sin esta base el guard no tendria contra que comparar.
  assert.ok(hashesMontados.size >= 11, `se esperaban al menos 11 rutas y hay ${hashesMontados.size}`)
  assert.ok(hashesMontados.has('#resumen'), '#resumen es la portada')
})

test('ningun enlace interno apunta a una ruta que la aplicacion no monta', () => {
  // Arrange
  const rotos = []

  // Act
  for (const archivo of archivosConEnlaces(join(raiz, 'src'))) {
    const fuente = readFileSync(archivo, 'utf8')
    const relativo = archivo.replace(raiz, '')
    // Cubre `href="#ruta"` en JSX y `href: '#ruta'` en los arrays de navegacion, que es como los
    // declara App.tsx. El patron anterior solo veía la primera forma y se dejaba pasar la segunda.
    for (const m of fuente.matchAll(/href[=:]\s*\{?\s*[`'"]#([a-z-]+)[`'"]/g)) {
      const hash = `#${m[1]}`
      // Los enlaces a un ancla de la propia pagina no pasan por el enrutador.
      if (hashesMontados.has(hash)) continue
      rotos.push(`${relativo} -> ${hash}`)
    }
  }

  // Assert
  assert.deepEqual(
    [...new Set(rotos)],
    [],
    'un hash que App.tsx no reconoce devuelve la portada: el enlace lleva a una pagina en blanco',
  )
})
