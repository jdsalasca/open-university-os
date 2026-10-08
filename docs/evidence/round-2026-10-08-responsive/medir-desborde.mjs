// Desborde horizontal por ruta y ancho: document.documentElement.scrollWidth contra el viewport.
// Barato, sistemático y sin opiniones: si algo excede, hay scroll lateral en un móvil real.
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

const BASE = process.env.BASE ?? 'http://localhost:5179'
const RUTAS = ['#resumen', '#inicio', '#estudiantes', '#biblioteca', '#avisos', '#avisos-admin', '#programas', '#academia', '#admisiones', '#espacios', '#accesos']
const ANCHOS = [360, 768]

const navegador = await chromium.launchPersistentContext(
  `${process.env.TEMP}/opencode-chrome-profile-overflow-${Date.now()}`,
  { executablePath: process.env.CHROMIUM, headless: true, viewport: { width: 1280, height: 900 } },
)
const pagina = await navegador.newPage()
await pagina.goto(`${BASE}/#resumen`, { waitUntil: 'networkidle' })
await pagina.waitForTimeout(2500)
const boton = await pagina.waitForSelector('text=Entrar al preview local', { timeout: 25000 }).catch(() => null)
if (boton) {
  await boton.click()
  await pagina.waitForSelector('text=Desarrollador local · preview', { timeout: 25000 }).catch(() => {})
  await pagina.waitForTimeout(1500)
}
const conSesion = await pagina.evaluate(() => document.body.textContent.includes('Desarrollador local · preview'))
if (!conSesion) throw new Error('sin sesión de preview')

const filas = []
for (const ancho of ANCHOS) {
  await pagina.setViewportSize({ width: ancho, height: 900 })
  for (const ruta of RUTAS) {
    await pagina.goto(`${BASE}/${ruta}`, { waitUntil: 'networkidle' })
    await pagina.waitForTimeout(1000)
    const m = await pagina.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      cliente: document.documentElement.clientWidth,
      // El peor hijo directo: dónde está el exceso, si lo hay.
      peor: (() => {
        let top = null
        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect()
          if (r.right > (top?.right ?? 0)) top = { right: Math.round(r.right), sel: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '') }
        }
        return top
      })(),
    }))
    const exceso = m.scroll - m.cliente
    filas.push({ ancho, ruta, exceso, peor: m.peor })
    console.log(`${ancho}px ${ruta}: exceso ${exceso}px ${exceso > 0 ? '<-- ' + JSON.stringify(m.peor) : ''}`)
  }
}
await navegador.close()

const mal = filas.filter((f) => f.exceso > 0)
const lineas = [
  `Desborde horizontal por ruta en ${ANCHOS.join(' y ')}px, con sesión de preview`,
  `Combinaciones con scroll lateral: ${mal.length} de ${filas.length}`,
  '',
  ...filas.map((f) => `${f.ancho}px ${f.ruta}: exceso ${f.exceso}px${f.exceso > 0 ? ` :: ${JSON.stringify(f.peor)}` : ''}`),
]
const salida = process.argv[2]
if (salida) writeFileSync(salida, lineas.join('\n'), 'utf8')
if (mal.length > 0) process.exitCode = 1
