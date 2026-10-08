// Pasada de humo visual: las once rutas en tema oscuro con sesión de preview, una captura por
// ruta para revisión humana. No afirma nada por sí mismo: es el instrumento para encontrar el
// siguiente defecto real en vez de suponer dónde está.
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

const BASE = process.env.BASE ?? 'http://localhost:5179'
const RUTAS = ['#resumen', '#inicio', '#estudiantes', '#biblioteca', '#avisos', '#avisos-admin', '#programas', '#academia', '#admisiones', '#espacios', '#accesos']
const SALIDA = new URL('./', import.meta.url).pathname.replace(/^\//, '')

const navegador = await chromium.launchPersistentContext(
  `${process.env.TEMP}/opencode-chrome-profile-humo-${process.env.PERFIL ?? 'a'}`,
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
if (!conSesion) throw new Error('sin sesión de preview: las rutas autenticadas saldrían vacías')

for (const ruta of RUTAS) {
  await pagina.goto(`${BASE}/${ruta}`, { waitUntil: 'networkidle' })
  await pagina.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  await pagina.waitForTimeout(1200)
  const nombre = ruta.replace('#', '')
  await pagina.screenshot({ path: `${SALIDA}humo-dark-${nombre}.png` })
  console.log(`captura humo-dark-${nombre}.png`)
}
await navegador.close()
