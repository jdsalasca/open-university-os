import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

const BASE = process.env.BASE ?? 'http://localhost:5179'
const navegador = await chromium.launchPersistentContext(
  `${process.env.TEMP}/opencode-chrome-profile-adm-${Date.now()}`,
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
await pagina.goto(`${BASE}/#admisiones`, { waitUntil: 'networkidle' })
await pagina.waitForTimeout(2500)
const nueva = await pagina.$('main button:has-text("Nueva convocatoria")')
console.log('botón Nueva convocatoria:', !!nueva)
if (nueva) {
  await nueva.click()
  await pagina.waitForTimeout(1200)
const info = await pagina.evaluate(() => {
  const f = document.querySelector('main form[aria-label="Editar convocatoria"]')
  if (!f) return { form: false }
  return f.innerHTML.slice(0, 4000)
})
console.log(info)
}
await navegador.close()
