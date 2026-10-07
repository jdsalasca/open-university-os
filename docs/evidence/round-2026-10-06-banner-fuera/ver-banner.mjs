import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

const BASE = process.env.BASE ?? 'http://localhost:5173'
const navegador = await chromium.launchPersistentContext(
  `${process.env.TEMP}/opencode-chrome-profile-banner-${process.env.PERFIL ?? 'a'}`,
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
const conSesion = await pagina.evaluate(() => document.body.textContent.includes('Desarrollador local · preview'))
if (!conSesion) throw new Error('no se pudo emitir la sesion de preview')
await pagina.goto(`${BASE}/#academia`, { waitUntil: 'networkidle' })
await pagina.waitForTimeout(2000)
await pagina.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
await pagina.waitForTimeout(600)
const info = await pagina.evaluate(() => {
  const banner = document.querySelector('.local-preview-session-banner')
  if (!banner) return { presente: false }
  const estilo = getComputedStyle(banner)
  const padre = banner.parentElement
  return {
    presente: true,
    color: estilo.color,
    fondo: estilo.backgroundColor,
    padre: padre ? `${padre.tagName.toLowerCase()}.${String(padre.className).split(' ')[0]}` : 'sin padre',
    rect: banner.getBoundingClientRect().toJSON(),
  }
})
console.log(JSON.stringify(info, null, 1))
await pagina.screenshot({
  path: new URL('./banner-dark.png', import.meta.url).pathname.replace(/^\//, ''),
  clip: { x: 254, y: 0, width: 770, height: 260 },
})
await navegador.close()
