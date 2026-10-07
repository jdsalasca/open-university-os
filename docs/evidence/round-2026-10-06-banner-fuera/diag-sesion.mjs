import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

const navegador = await chromium.launchPersistentContext(
  `${process.env.TEMP}/opencode-chrome-profile-banner-diag`,
  { executablePath: process.env.CHROMIUM, headless: true, viewport: { width: 1280, height: 900 } },
)
const pagina = await navegador.newPage()
const respuesta = await pagina.goto('http://localhost:5173/#resumen', { waitUntil: 'domcontentloaded' })
console.log('http:', respuesta?.status(), 'url final:', pagina.url())
await pagina.waitForTimeout(4000)
const info = await pagina.evaluate(() => ({
  titulo: document.title.slice(0, 60),
  botones: [...document.querySelectorAll('button')].map((b) => b.textContent.trim().slice(0, 40)),
  cuerpo: document.body.textContent.replace(/\s+/g, ' ').slice(0, 200),
}))
console.log(JSON.stringify(info, null, 1))
await navegador.close()
