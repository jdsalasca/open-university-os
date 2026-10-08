import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

const BASE = process.env.BASE ?? 'http://localhost:5179'
const navegador = await chromium.launchPersistentContext(
  `${process.env.TEMP}/opencode-chrome-profile-aviso-dom-${Date.now()}`,
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
await pagina.goto(`${BASE}/#avisos-admin`, { waitUntil: 'networkidle' })
await pagina.waitForTimeout(2500)
const respuestas = []
pagina.on('response', async (r) => {
  if (r.url().includes('/api/')) respuestas.push(`${r.status()} ${r.request().method()} ${r.url().split('/api/')[1]}`)
})
await pagina.fill('main input[name="title"]', 'sintetico-diagnostico')
await pagina.fill('main textarea[name="body"]', 'cuerpo sintetico')
const hoy = new Date().toISOString().slice(0, 10)
const mas30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)
await pagina.fill('main input[name="publishedFrom"]', hoy)
await pagina.fill('main input[name="publishedThrough"]', mas30)
const botonesAntes = await pagina.$$eval('main button', (els) => els.map((b) => b.textContent.trim().slice(0, 30) + (b.disabled ? ' [disabled]' : '')))
await pagina.click('main button:has-text("Publicar aviso")')
await pagina.waitForTimeout(3000)
const despues = await pagina.evaluate(() => ({
  alertas: [...document.querySelectorAll('[role="alert"]')].map((a) => a.textContent.trim().slice(0, 120)),
  marca: document.body.textContent.includes('sintetico-diagnostico'),
  botones: [...document.querySelectorAll('main button')].map((b) => b.textContent.trim().slice(0, 30) + (b.disabled ? ' [disabled]' : '')),
}))
console.log(JSON.stringify({ botonesAntes, respuestas, despues }, null, 1))
await pagina.screenshot({ path: new URL('./avisos-admin-form.png', import.meta.url).pathname.replace(/^\//, '') })
await navegador.close()
