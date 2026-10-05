import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

const navegador = await chromium.launchPersistentContext(
  join(process.env.TEMP, 'opencode-chrome-profile-preview'),
  { executablePath: process.env.CHROMIUM, headless: true, viewport: { width: 1440, height: 900 } },
)
const pagina = await navegador.newPage()
await pagina.goto((process.env.BASE || 'http://localhost:5173') + '/#resumen', { waitUntil: 'domcontentloaded' })
await pagina.waitForTimeout(1500)
await pagina.click('text=Entrar al preview local')
await pagina.waitForSelector('text=Desarrollador local', { timeout: 20000 })
await pagina.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
await pagina.goto((process.env.BASE || 'http://localhost:5173') + '/#academia', { waitUntil: 'networkidle' })
await pagina.waitForTimeout(3000)

const icono = pagina.locator('.academic-operations-note > span').first()
console.log(`color calculado del icono: ${await icono.evaluate((e) => getComputedStyle(e).color)}`)
await icono.screenshot({ path: join(process.env.SALIDA, '09-icono-zoom.png') })

const nota = pagina.locator('.academic-operations-note').first()
await nota.screenshot({ path: join(process.env.SALIDA, '10-nota-zoom.png') })

const entrada = pagina.locator('.academic-create-entry-heading').first()
await entrada.screenshot({ path: join(process.env.SALIDA, '11-heading-zoom.png') })
console.log('capturasAmpliadas listas')
await navegador.close()
