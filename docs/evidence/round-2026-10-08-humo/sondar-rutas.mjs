import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

const BASE = process.env.BASE ?? 'http://localhost:5179'
const RUTAS = process.env.RUTAS ? process.env.RUTAS.split(',') : ['#avisos', '#avisos-admin', '#estudiantes']
const navegador = await chromium.launchPersistentContext(
  `${process.env.TEMP}/opencode-chrome-profile-sonda-${Date.now()}`,
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
for (const ruta of RUTAS) {
  await pagina.goto(`${BASE}/${ruta}`, { waitUntil: 'networkidle' })
  await pagina.waitForTimeout(1500)
  const info = await pagina.evaluate(() => ({
    hash: location.hash,
    h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim().slice(0, 50)),
    encabezados: [...document.querySelectorAll('h1,h2,h3')].slice(0, 4).map((h) => `${h.tagName} ${h.textContent.trim().slice(0, 40)}`),
    migas: document.querySelector('.breadcrumbs')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 80),
  }))
  console.log(JSON.stringify(info))
}
await navegador.close()
