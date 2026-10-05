import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

const navegador = await chromium.launchPersistentContext(
  join(process.env.TEMP, 'opencode-chrome-profile-v6'),
  { executablePath: process.env.CHROMIUM, headless: true, viewport: { width: 1440, height: 900 } },
)
const pagina = await navegador.newPage()
await pagina.goto('http://localhost:5199/#resumen', { waitUntil: 'networkidle' })
await pagina.waitForTimeout(3000)
await pagina.waitForSelector('text=Entrar al preview local', { timeout: 20000 })
await pagina.click('text=Entrar al preview local')
await pagina.waitForSelector('text=Desarrollador local', { timeout: 20000 })
await pagina.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))

for (const [archivo, ruta] of [
  ['01-programas-dark.png', '#programas'],
  ['02-espacios-dark.png', '#espacios'],
]) {
  await pagina.goto(`http://localhost:5199/${ruta}`, { waitUntil: 'networkidle' })
  await pagina.waitForTimeout(4000)
  await pagina.screenshot({ path: join(process.env.SALIDA, archivo), fullPage: true })
  console.log(`captura ${archivo}`)
}

// El detalle del chip que quedaba en 4,35 tras el primer intento.
await pagina.goto('http://localhost:5199/#programas', { waitUntil: 'networkidle' })
await pagina.waitForTimeout(4000)
const chip = pagina.locator('.catalog-note-icon').first()
if (await chip.count()) {
  await chip.screenshot({ path: join(process.env.SALIDA, '03-chip-note-icon.png') })
  console.log('chip capturado')
}
await navegador.close()
