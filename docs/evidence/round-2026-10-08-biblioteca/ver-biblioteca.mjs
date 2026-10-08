import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

const BASE = process.env.BASE ?? 'http://localhost:5179'
const navegador = await chromium.launchPersistentContext(
  `${process.env.TEMP}/opencode-chrome-profile-biblio-${Date.now()}`,
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
await pagina.goto(`${BASE}/#biblioteca`, { waitUntil: 'networkidle' })
await pagina.waitForTimeout(2500)
const info = await pagina.evaluate(() => ({
  h1: [...document.querySelectorAll('main h1')].map((h) => h.textContent.trim().slice(0, 40)),
  formularios: [...document.querySelectorAll('main form')].map((f) => ({
    etiqueta: f.getAttribute('aria-label') ?? '(sin etiqueta)',
    campos: [...f.querySelectorAll('input, textarea, select')].map((el) =>
      `${el.tagName.toLowerCase()}[name="${el.getAttribute('name') ?? ''}"][type="${el.getAttribute('type') ?? ''}"]${el.required ? '[required]' : ''}`),
    botones: [...f.querySelectorAll('button:not([disabled])')].map((b) => b.textContent.trim().slice(0, 30)),
  })),
}))
console.log(JSON.stringify(info, null, 1))
await navegador.close()
