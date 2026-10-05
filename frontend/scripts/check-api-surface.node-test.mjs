import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

// El fallo silencioso mas comun en un monorepo no es un 500: es que React llama a
// una ruta que Spring ya no expone, y la pantalla degrada sin que nadie se entere.
// Aqui se cruzan las rutas del cliente con los mapeos del backend. Se hace de
// forma estatica porque la CI no levanta el backend como servicio.

const raiz = fileURLToPath(new URL('../../', import.meta.url))
const clientSrc = join(raiz, 'frontend', 'src')
const controllerSrc = join(raiz, 'backend', 'src', 'main', 'java')

const recorrer = (dir, filtro) => {
  if (!statSync(dir).isDirectory()) return []
  return readdirSync(dir).flatMap((entrada) => {
    const full = join(dir, entrada)
    return statSync(full).isDirectory() ? recorrer(full, filtro) : (filtro(full) ? [full] : [])
  })
}

const RUTA = /['"`](\/api\/v1\/[A-Za-z0-9/_-]*)/g

const rutasCliente = () => {
  const encontradas = new Set()
  for (const archivo of recorrer(clientSrc, (f) => f.endsWith('Client.ts'))) {
    for (const coincidencia of readFileSync(archivo, 'utf8').matchAll(RUTA)) {
      encontradas.add(coincidencia[1])
    }
  }
  return [...encontradas].sort()
}

// Un controlador puede declarar la raiz con @RequestMapping y los metodos con
// rutas relativas ("/me"), o al reves. Se compone el prefijo de clase con cada
// mapeo, en ese orden, y si la ruta ya es absoluta se respeta tal cual.
const rutasBackend = () => {
  const encontradas = []
  for (const archivo of recorrer(controllerSrc, (f) => f.endsWith('.java'))) {
    const fuente = readFileSync(archivo, 'utf8')
    const prefijo = fuente.match(/@RequestMapping\(\s*(?:value\s*=\s*)?"([^"]*)"/)?.[1] ?? ''
    for (const coincidencia of fuente.matchAll(
      /@(Get|Post|Put|Patch|Delete)Mapping(?:\(\s*(?:value\s*=\s*)?"([^"]*)"\s*\))?/g,
    )) {
      const relativa = coincidencia[2] ?? ''
      const ruta = relativa.startsWith('/api/')
        ? relativa
        : `${prefijo}${relativa}`.replace(/\/+$/, '') || '/'
      if (ruta.startsWith('/api/')) encontradas.push({ metodo: coincidencia[1].toUpperCase(), ruta })
    }
  }
  return encontradas
}

const rutas = rutasCliente()
const mapeos = rutasBackend()

test('el cliente y el backend comparten rutas', () => {
  assert.ok(rutas.length >= 25, `se esperaban al menos 25 rutas de cliente, hay ${rutas.length}`)
  assert.ok(mapeos.length >= 30, `se esperaban al menos 30 mapeos de backend, hay ${mapeos.length}`)
})

// Una ruta del cliente es un prefijo: el cliente escribe la base y luego anade
// identificadores. Lo que importa es que exista un mapeo que empiece por esa base.
const segmentos = (ruta) => ruta.split('/').filter(Boolean)
const esPrefijo = (base, ruta) => {
  const b = segmentos(base)
  const r = segmentos(ruta)
  return b.length <= r.length && b.every((s, i) => s === r[i] || /^\{[A-Za-z]+\}$/.test(s))
}

test('toda ruta del cliente tiene un mapeo que la publica', () => {
  // Se toma /api/v1/recurso como base: mas especifico detectaria drift real,
  // menos especifico dejaria pasar recursos que ya no existen.
  const sinMapeo = rutas.filter((ruta) => {
    const base = '/' + segmentos(ruta).slice(0, 3).join('/')
    return !mapeos.some((m) => esPrefijo(base, m.ruta) || esPrefijo(m.ruta, base))
  })
  assert.deepEqual(sinMapeo, [], `rutas del cliente sin mapeo en el backend: ${sinMapeo.join(', ')}`)
})

test('todo recurso administrativo del backend lo consume algun cliente', () => {
  const huerfanos = mapeos
    .filter((m) => m.ruta.startsWith('/api/v1/admin/'))
    .filter((m) => !rutas.some((r) => esPrefijo('/' + segmentos(r).slice(0, 3).join('/'), m.ruta)))
  assert.deepEqual(
    huerfanos.map((h) => `${h.metodo} ${h.ruta}`),
    [],
    'el backend expone recursos administrativos que el cliente nunca llama',
  )
})