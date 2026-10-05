import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

// Los 89 saltos del recorrido con Tab tienen dos causas. El skip-link ya se corrigio. Quedan los
// 24 saltos hacia los radios del selector de tema y los 18 hacia los nav-item del sidebar: el
// DOM pone el aside antes que el header, asi que al recorrer en orden del documento se baja por
// toda la columna izquierda y despues vuelve a arriba del todo. Es el orden correcto para el
// documento y el incomodo para la pantalla, y el parche clasico es `flex-direction: column-reverse`,
// que ademas rompe el orden del lector de pantalla.
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

// Primeros doce elementos que reciben el foco, en orden, con su posicion en pantalla.
await pagina.evaluate(() => document.querySelector('main')?.focus?.())
const orden = []
for (let i = 0; i < 14; i++) {
  await pagina.keyboard.press('Tab')
  const r = await pagina.evaluate(() => {
    const el = document.activeElement
    if (!el || el === document.body) return null
    const caja = el.getBoundingClientRect()
    return {
      etiqueta: el.getAttribute('aria-label') || (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28) || el.tagName.toLowerCase(),
      tag: el.tagName.toLowerCase(),
      clase: String(el.className || '').slice(0, 30),
      top: Math.round(caja.top),
      left: Math.round(caja.left),
    }
  })
  if (r) orden.push(r)
}

console.log('orden real del recorrido con Tab:')
orden.forEach((o, i) => {
  const salto = i === 0 ? '' : (o.top < orden[i - 1].top ? `  <- RETROCESE ${orden[i - 1].top - o.top} px` : '')
  console.log(`${String(i + 1).padStart(2)}. <${o.tag} class="${o.clase}"> y=${String(o.top).padStart(4)} x=${String(o.left).padStart(4)} "${o.etiqueta}"${salto}`)
})
await navegador.close()
