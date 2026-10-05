import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

const navegador = await chromium.launchPersistentContext(
  join(process.env.TEMP, 'opencode-chrome-profile-v9'),
  { executablePath: process.env.CHROMIUM, headless: true, viewport: { width: 1440, height: 900 } },
)
const pagina = await navegador.newPage()
await pagina.goto('http://localhost:5199/#resumen', { waitUntil: 'networkidle' })
await pagina.waitForTimeout(3000)
await pagina.waitForSelector('text=Entrar al preview local', { timeout: 20000 })
await pagina.click('text=Entrar al preview local')
await pagina.waitForSelector('text=Desarrollador local', { timeout: 20000 })

for (const [archivo, ruta] of [
  ['01-estudiantes-antes.png', '#estudiantes'],
  ['02-espacios-antes.png', '#espacios'],
  ['03-admisiones-antes.png', '#admisiones'],
  ['04-programas-antes.png', '#programas'],
]) {
  await pagina.goto(`http://localhost:5199/${ruta}`, { waitUntil: 'networkidle' })
  await pagina.waitForTimeout(3500)
  await pagina.screenshot({ path: join(process.env.SALIDA, archivo), fullPage: true })
  console.log(`captura ${archivo}`)
}
await navegador.close()
