import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

// El recorrido arranca en el primer elemento enfocable real del documento, no saltando al main:
// `document.querySelector('main').focus()` lleva el cursor al final y Tab da la vuelta, mezclando
// el sidebar con el contenido en un orden que no es el que vive la persona.
const navegador = await chromium.launchPersistentContext(
  join(process.env.TEMP, 'opencode-chrome-profile-v16'),
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

// Se enfoca el body y se va hacia atras con Shift+Tab hasta llegar al principio, o se empieza
// leyendo el DOM: el primer elemento enfocable es lo que recibe el foco al abrir la pagina.
const orden = []
for (let i = 0; i < 16; i++) {
  const r = await pagina.evaluate((indice) => {
    const todos = [...document.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter((el) => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0)
    const el = todos[indice]
    if (!el) return null
    const caja = el.getBoundingClientRect()
    return {
      etiqueta: el.getAttribute('aria-label') || (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30) || el.tagName.toLowerCase(),
      tag: el.tagName.toLowerCase(),
      clase: String(el.className || '').slice(0, 32),
      top: Math.round(caja.top),
      left: Math.round(caja.left),
    }
  }, i)
  if (r) orden.push(r)
}

console.log('orden del DOM, que es el orden en que Tab recorre:')
orden.forEach((o, i) => {
  const marca = i === 0 ? '' : (o.top < orden[i - 1].top - 24 ? `  <- RETROCESE ${orden[i - 1].top - o.top} px` : '')
  console.log(`${String(i + 1).padStart(2)}. <${o.tag} class="${o.clase}"> y=${String(o.top).padStart(4)} x=${String(o.left).padStart(4)} "${o.etiqueta}"${marca}`)
})
await navegador.close()
