import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

// 38 recortes reales en tres anchos. Los tres mas graves se ven a simple vista: el nombre de la
// institucion cortado a 156 px, la navegacion del preview a 376 px y el titulo del heroe a 36 px.
const navegador = await chromium.launchPersistentContext(
  join(process.env.TEMP, 'opencode-chrome-profile-v12'),
  { executablePath: process.env.CHROMIUM, headless: true, viewport: { width: 1024, height: 768 } },
)
const pagina = await navegador.newPage()
await pagina.goto('http://localhost:5199/#resumen', { waitUntil: 'networkidle' })
await pagina.waitForTimeout(3000)
await pagina.waitForSelector('text=Entrar al preview local', { timeout: 20000 })
await pagina.click('text=Entrar al preview local')
await pagina.waitForSelector('text=Desarrollador local', { timeout: 20000 })

for (const [archivo, ruta, ancho] of [
  ['01-nombre-institucion-1024.png', '#resumen', 1024],
  ['02-preview-nav-1024.png', '#inicio', 1024],
  ['03-hero-1024.png', '#inicio', 1024],
  ['04-nombre-institucion-360.png', '#resumen', 360],
]) {
  await pagina.setViewportSize({ width: ancho, height: ancho < 500 ? 780 : 768 })
  await pagina.goto(`http://localhost:5199/${ruta}`, { waitUntil: 'networkidle' })
  await pagina.waitForTimeout(3000)
  await pagina.screenshot({ path: join(process.env.SALIDA, archivo), fullPage: false })
  console.log(`captura ${archivo}`)
}
await navegador.close()
