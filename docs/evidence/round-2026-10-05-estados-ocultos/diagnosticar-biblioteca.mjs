import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

const navegador = await chromium.launchPersistentContext(
  `${process.env.TEMP}/opencode-chrome-profile-estados-2026-10-06`,
  { executablePath: process.env.CHROMIUM, headless: true, viewport: { width: 1280, height: 1000 } },
)
const pagina = await navegador.newPage()
await pagina.goto('http://localhost:5173/#resumen', { waitUntil: 'networkidle' })
await pagina.waitForTimeout(2500)
const boton = await pagina.$('text=Entrar al preview local')
if (boton) {
  await boton.click()
  await pagina.waitForSelector('text=Desarrollador local', { timeout: 20000 }).catch(() => {})
  await pagina.waitForTimeout(1500)
}
const RUTA = process.env.RUTA ?? '#biblioteca'
await pagina.goto(`http://localhost:5173/${RUTA}`, { waitUntil: 'networkidle' })
await pagina.waitForTimeout(3000)
const info = await pagina.evaluate(() => ({
  ruta: location.hash,
  banner: document.body.textContent.includes('Desarrollador local · modo preview'),
  botonEntrar: !![...document.querySelectorAll('button')].find((b) => b.textContent.includes('Entrar al preview local')),
  h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()),
  encabezados: [...document.querySelectorAll('h1,h2,h3')].map((h) => `${h.tagName} ${h.textContent.trim().slice(0, 40)}`),
  main: document.querySelector('main')?.textContent.replace(/\s+/g, ' ').slice(0, 220),
}))
console.log(JSON.stringify(info, null, 1))
await navegador.close()
