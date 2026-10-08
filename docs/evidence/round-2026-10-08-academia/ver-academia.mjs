import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

const BASE = process.env.BASE ?? 'http://localhost:5179'
const navegador = await chromium.launchPersistentContext(
  `${process.env.TEMP}/opencode-chrome-profile-acad-${Date.now()}`,
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
await pagina.goto(`${BASE}/#academia`, { waitUntil: 'networkidle' })
await pagina.waitForTimeout(3000)
await pagina.click('main button:has-text("Crear lugar")')
await pagina.waitForTimeout(1500)
const info = await pagina.evaluate(() => {
  const forms = [...document.querySelectorAll('main form')]
  const f = forms.find((x) => /crear lugar/i.test(x.textContent)) ?? forms[forms.length - 1]
  return f ? f.outerHTML.slice(0, 3000) : null
})
console.log(info)
await navegador.close()
