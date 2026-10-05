import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

// El recorrido real empieza en el skip-link. Se llega a el con Shift+Tab desde el segundo
// elemento, que es como lo recorreria quien ya esta en la marca y quiere volver al inicio del
// recorrido, o se enfoca directamente para comprobar su estado visual.
const navegador = await chromium.launchPersistentContext(
  join(process.env.TEMP, 'opencode-chrome-profile-v17'),
  { executablePath: process.env.CHROMIUM, headless: true, viewport: { width: 1440, height: 900 } },
)
const pagina = await navegador.newPage()
await pagina.goto('http://localhost:5199/#resumen', { waitUntil: 'networkidle' })
await pagina.waitForTimeout(3000)
await pagina.waitForSelector('text=Entrar al preview local', { timeout: 20000 })
await pagina.click('text=Entrar al preview local')
await pagina.waitForSelector('text=Salir del preview local', { timeout: 20000 })
await pagina.goto('http://localhost:5199/#resumen', { waitUntil: 'networkidle' })
await pagina.waitForTimeout(3000)

// Un focus() programatico no activa :focus-visible: el navegador no sabe que es teclado. Se
// enfoca la marca con el raton simulado y luego se llega al skip-link con Shift+Tab, que si
// cuenta como navegacion por teclado.
await pagina.evaluate(() => document.querySelector('.brand-lockup')?.focus())
await pagina.keyboard.press('Shift+Tab')
await pagina.waitForTimeout(400)

const estado = await pagina.evaluate(() => {
  const el = document.activeElement
  const cs = getComputedStyle(el)
  const caja = el.getBoundingClientRect()
  const fondoLuminancia = (color) => {
    const n = color.match(/\d+/g).map(Number)
    const [r, g, b] = n.slice(0, 3).map((v) => {
      const c = v / 255
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const opaco = !/rgba\([^)]*,\s*0\)/.test(cs.backgroundColor)
  const ratio = opaco
    ? ((Math.max(fondoLuminancia(cs.backgroundColor), fondoLuminancia(cs.color)) + 0.05)
      / (Math.min(fondoLuminancia(cs.backgroundColor), fondoLuminancia(cs.color)) + 0.05)).toFixed(2)
    : 'sin fondo'
  return {
    texto: (el.textContent || '').trim(),
    top: Math.round(caja.top),
    left: Math.round(caja.left),
    ancho: Math.round(caja.width),
    alto: Math.round(caja.height),
    fondo: cs.backgroundColor,
    color: cs.color,
    ratio,
    visible: caja.top >= 0 && caja.height > 0,
  }
})
console.log(JSON.stringify(estado, null, 1))
await pagina.screenshot({ path: join(process.env.SALIDA, '01-skip-link-enfocado.png'), clip: { x: 0, y: 0, width: 520, height: 140 } })

// Y al pulsarlo, el foco debe saltar al contenido principal.
await pagina.keyboard.press('Enter')
await pagina.waitForTimeout(500)
const destino = await pagina.evaluate(() => ({
  id: document.activeElement?.id || '(sin id)',
  tag: document.activeElement?.tagName.toLowerCase(),
}))
console.log(`tras Enter -> #${destino.id} (${destino.tag})`)
await navegador.close()
