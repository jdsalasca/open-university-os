import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

const navegador = await chromium.launchPersistentContext(
  join(process.env.TEMP, 'opencode-chrome-profile-v7'),
  { executablePath: process.env.CHROMIUM, headless: true, viewport: { width: 1440, height: 900 } },
)
const pagina = await navegador.newPage()
await pagina.goto('http://localhost:5199/#resumen', { waitUntil: 'networkidle' })
await pagina.waitForTimeout(3000)
await pagina.waitForSelector('text=Entrar al preview local', { timeout: 20000 })
await pagina.click('text=Entrar al preview local')
await pagina.waitForSelector('text=Desarrollador local', { timeout: 20000 })
await pagina.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
await pagina.goto('http://localhost:5199/#academia', { waitUntil: 'networkidle' })
await pagina.waitForTimeout(4000)

// Los siete glifos con la clase compartida, ampliados para ver el glifo real.
const chips = pagina.locator('.academic-operation-icon')
const total = await chips.count()
console.log(`glifos con academic-operation-icon en el DOM: ${total}`)
for (let i = 0; i < Math.min(total, 3); i++) {
  await chips.nth(i).screenshot({ path: join(process.env.SALIDA, `04-chip-academico-${i + 1}.png`) })
}
console.log(`color calculado del primero: ${await chips.first().evaluate((e) => getComputedStyle(e).color)}`)
console.log(`fondo calculado del primero: ${await chips.first().evaluate((e) => getComputedStyle(e).backgroundColor)}`)
await pagina.screenshot({ path: join(process.env.SALIDA, '05-academia-dark-consolidado.png'), fullPage: true })
await navegador.close()
