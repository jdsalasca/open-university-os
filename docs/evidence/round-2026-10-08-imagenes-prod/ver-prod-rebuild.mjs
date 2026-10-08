import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

const BASE = process.env.BASE ?? 'http://localhost:5198'
const navegador = await chromium.launchPersistentContext(
  `${process.env.TEMP}/opencode-chrome-profile-prodrebuild-${Date.now()}`,
  { executablePath: process.env.CHROMIUM, headless: true, viewport: { width: 1280, height: 900 } },
)
const pagina = await navegador.newPage()
// La imagen prod no trae perfil local-preview: se verifica la vista pública sin sesión.
await pagina.goto(`${BASE}/#avisos`, { waitUntil: 'networkidle' })
await pagina.waitForTimeout(2500)
const info = await pagina.evaluate(() => ({
  h1: [...document.querySelectorAll('main h1')].map((h) => h.textContent.trim().slice(0, 40)),
  encabezados: [...document.querySelectorAll('main h1, main h2')].slice(0, 3).map((h) => `${h.tagName} ${h.textContent.trim().slice(0, 40)}`),
  banner: !!document.querySelector('.local-preview-session-banner'),
  main: (document.querySelector('main')?.textContent ?? '').replace(/\s+/g, ' ').slice(0, 220),
  titulo: document.title.slice(0, 40),
}))
console.log(JSON.stringify(info, null, 1))
await navegador.close()
