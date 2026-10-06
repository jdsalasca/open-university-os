import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

const navegador = await chromium.launchPersistentContext(
  `${process.env.TEMP}/opencode-chrome-profile-foco-crop`,
  { executablePath: process.env.CHROMIUM, headless: true, viewport: { width: 1280, height: 900 } },
)
const pagina = await navegador.newPage()
await pagina.goto('http://localhost:5173/#resumen', { waitUntil: 'networkidle' })
await pagina.waitForTimeout(2500)
const boton = await pagina.waitForSelector('text=Entrar al preview local', { timeout: 25000 }).catch(() => null)
if (boton) {
  await boton.click()
  await pagina.waitForSelector('text=Desarrollador local · preview', { timeout: 25000 }).catch(() => {})
  await pagina.waitForTimeout(1500)
}
const enlace = await pagina.$('nav a:has-text("Espacios")')
await enlace.focus()
await pagina.keyboard.press('Enter')
await pagina.waitForTimeout(1500)
await pagina.screenshot({
  path: new URL('./anillo-titulo.png', import.meta.url).pathname.replace(/^\//, ''),
  clip: { x: 254, y: 150, width: 700, height: 190 },
})
await navegador.close()
