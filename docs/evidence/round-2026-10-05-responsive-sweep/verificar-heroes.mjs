import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

// El guard exige overflow visible en tres heroes. Antes de cambiar CSS a ciegas, se mira si el
// texto se ve realmente cortado o si el recorte lo provoca la decoracion ::before/::after
// posicionada fuera del borde, que es lo que overflow hidden debe recortar.
const navegador = await chromium.launchPersistentContext(
  join(process.env.TEMP, 'opencode-chrome-profile-v13'),
  { executablePath: process.env.CHROMIUM, headless: true, viewport: { width: 1440, height: 900 } },
)
const pagina = await navegador.newPage()
await pagina.goto('http://localhost:5199/#resumen', { waitUntil: 'networkidle' })
await pagina.waitForTimeout(3000)
await pagina.waitForSelector('text=Entrar al preview local', { timeout: 20000 })
await pagina.click('text=Entrar al preview local')
await pagina.waitForSelector('text=Salir del preview local', { timeout: 20000 })
await pagina.setViewportSize({ width: 360, height: 780 })

for (const [archivo, ruta, clase] of [
  ['01-espacios-hero-360.png', '#espacios', '.spaces-hero'],
  ['02-admisiones-hero-360.png', '#admisiones', '.admissions-call-card'],
  ['03-accesos-hero-360.png', '#accesos', '.role-access-hero'],
]) {
  await pagina.goto(`http://localhost:5199/${ruta}`, { waitUntil: 'networkidle' })
  await pagina.waitForTimeout(3200)
  const detalle = await pagina.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const deco = [...el.children].map((c) => {
      const cs = getComputedStyle(c)
      const caja = c.getBoundingClientRect()
      return {
        tag: c.tagName.toLowerCase(),
        clase: String(c.className || '').slice(0, 30),
        posicion: cs.position,
        ancho: Math.round(caja.width),
      }
    })
    return {
      visible: el.clientWidth,
      contenido: el.scrollWidth,
      hijos: deco,
      primerTexto: (el.querySelector('h1, h2')?.textContent || '').trim().slice(0, 48),
    }
  }, clase)
  console.log(`${clase}: ${JSON.stringify(detalle)}`)
  await pagina.screenshot({ path: join(process.env.SALIDA, archivo), fullPage: false, timeout: 8000 }).catch(() => {})
}
await navegador.close()
