import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

const BASE = process.env.BASE ?? 'http://localhost:5179'
const SALIDA = new URL('./', import.meta.url).pathname.replace(/^\//, '')
const navegador = await chromium.launchPersistentContext(
  `${process.env.TEMP}/opencode-chrome-profile-avisos-${Date.now()}`,
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
await pagina.goto(`${BASE}/#avisos`, { waitUntil: 'networkidle' })
await pagina.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
await pagina.waitForTimeout(1200)
await pagina.screenshot({ path: `${SALIDA}avisos-dark-h1.png` })
console.log('captura avisos-dark-h1.png')
await navegador.close()
