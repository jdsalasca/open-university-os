import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

const navegador = await chromium.launchPersistentContext(
  `${process.env.TEMP}/opencode-chrome-profile-foco-diag-${process.env.PERFIL ?? 'a'}`,
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
const enlace = await pagina.$('nav a:has-text("Estructura")')
await enlace.focus()
await pagina.keyboard.press('Enter')
await pagina.waitForTimeout(1500)
const info = await pagina.evaluate(() => {
  const main = document.querySelector('main')
  const estilo = getComputedStyle(main)
  return {
    esMain: document.activeElement === main,
    coincideFocus: main.matches(':focus'),
    coincideFocusVisible: main.matches(':focus-visible'),
    outline: estilo.outline,
    boxShadow: estilo.boxShadow,
    mainRect: main.getBoundingClientRect().toJSON(),
    activeTag: document.activeElement.tagName,
    h1DentroDeMain: main.querySelectorAll('h1').length,
    h1Textos: [...main.querySelectorAll('h1')].map((h) => h.textContent.trim().slice(0, 40)),
    h1Tabindex: [...main.querySelectorAll('h1')].map((h) => h.getAttribute('tabindex')),
  }
})
console.log(JSON.stringify(info, null, 1))
await navegador.close()
