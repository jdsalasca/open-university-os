import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

const BASE = process.env.BASE ?? 'http://localhost:5179'
const SALIDA = new URL('./', import.meta.url).pathname.replace(/^\//, '')
const navegador = await chromium.launchPersistentContext(
  `${process.env.TEMP}/opencode-chrome-profile-movil-${Date.now()}`,
  { executablePath: process.env.CHROMIUM, headless: true, viewport: { width: 360, height: 800 } },
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
for (const [ruta, archivo] of [['#avisos', 'movil-360-avisos.png'], ['#academia', 'movil-360-academia.png'], ['#estudiantes', 'movil-360-estudiantes.png']]) {
  await pagina.goto(`${BASE}/${ruta}`, { waitUntil: 'networkidle' })
  await pagina.waitForTimeout(1200)
  await pagina.screenshot({ path: `${SALIDA}${archivo}`, fullPage: false })
  console.log(`captura ${archivo}`)
}
await navegador.close()
