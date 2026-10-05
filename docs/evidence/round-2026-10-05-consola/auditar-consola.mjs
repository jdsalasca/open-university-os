import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

// Ninguna ronda anterior ha mirado la consola del navegador ni los enlaces internos. React en modo
// desarrollo emite avisos por claves duplicadas, `act` y props, y aparecen como texto pequeno que
// nadie lee; ademas un `href="#ruta"` que no existe en App.tsx lleva a una pagina en blanco.
//
// Aqui se recogen los mensajes de consola y de error de pagina en cada ruta, y todos los enlaces
// internos con su hash, para compararlos despues con las rutas que la aplicacion monta.
const RUTAS = ['#resumen', '#estudiantes', '#biblioteca', '#avisos', '#avisos-admin', '#programas', '#inicio', '#academia', '#admisiones', '#espacios', '#accesos']

const navegador = await chromium.launchPersistentContext(
  join(process.env.TEMP, 'opencode-chrome-profile-v23'),
  { executablePath: process.env.CHROMIUM, headless: true, viewport: { width: 1440, height: 900 } },
)
const pagina = await navegador.newPage()
const porRuta = new Map()
let rutaActual = '(inicio)'

pagina.on('console', (m) => {
  if (m.type() !== 'error' && m.type() !== 'warning') return
  if (!porRuta.has(rutaActual)) porRuta.set(rutaActual, [])
  porRuta.get(rutaActual).push(`[${m.type()}] ${m.text().slice(0, 220)}`)
})
pagina.on('pageerror', (e) => {
  if (!porRuta.has(rutaActual)) porRuta.set(rutaActual, [])
  porRuta.get(rutaActual).push(`[pageerror] ${e.message.slice(0, 220)}`)
})
pagina.on('requestfailed', (r) => {
  if (!porRuta.has(rutaActual)) porRuta.set(rutaActual, [])
  porRuta.get(rutaActual).push(`[request] ${r.failure()?.errorText} ${r.url().slice(0, 120)}`)
})

await pagina.goto('http://localhost:5199/#resumen', { waitUntil: 'networkidle' })
await pagina.waitForTimeout(3000)
await pagina.waitForSelector('text=Entrar al preview local', { timeout: 20000 })
await pagina.click('text=Entrar al preview local')
await pagina.waitForSelector('text=Salir del preview local', { timeout: 20000 })

const enlacesVistos = new Set()
for (const ruta of RUTAS) {
  rutaActual = ruta
  await pagina.goto(`http://localhost:5199/${ruta}`, { waitUntil: 'networkidle' })
  await pagina.waitForTimeout(2800)
  const hashes = await pagina.evaluate(() => {
    const salida = []
    for (const a of document.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href')
      if (!href || !href.startsWith('#')) continue
      salida.push({
        hash: href,
        texto: (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 34),
      })
    }
    return salida
  })
  for (const h of hashes) enlacesVistos.add(`${h.hash}\t${h.texto}`)
}

const lineas = ['Mensajes de consola y errores por ruta', '']
let total = 0
for (const [ruta, mensajes] of porRuta) {
  total += mensajes.length
  lineas.push(`--- ${ruta}: ${mensajes.length}`)
  for (const m of [...new Set(mensajes)].slice(0, 8)) lineas.push(`    ${m}`)
}

lineas.push('')
lineas.push(`TOTAL mensajes de consola y errores: ${total}`)
lineas.push('')
lineas.push('Enlaces internos con hash:')
const hashes = [...enlacesVistos].map((e) => e.split('\t')[0])
for (const h of [...new Set(hashes)].sort()) lineas.push(`  ${h}`)

writeFileSync(join(process.env.SALIDA, 'consola-y-enlaces.txt'), lineas.join('\n'), 'utf8')
console.log(lineas.filter((l) => l.startsWith('TOTAL') || l.startsWith('---')).join('\n'))
console.log('--- hashes distintos ---')
console.log([...new Set(hashes)].sort().join('\n'))
await navegador.close()
