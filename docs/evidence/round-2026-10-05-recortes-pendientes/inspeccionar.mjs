import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

// Quedan dos recortes del barrido responsive sin revisar: `.identity-preview-surface` (22 px) y
// `.catalog-empty` (103 px). Este script mide los hijos de cada uno para saber si la diferencia es
// decoracion que sobresale a proposito o texto que se pierde.
const navegador = await chromium.launchPersistentContext(
  join(process.env.TEMP, 'opencode-chrome-profile-v19'),
  { executablePath: process.env.CHROMIUM, headless: true, viewport: { width: 1024, height: 768 } },
)
const pagina = await navegador.newPage()
await pagina.goto('http://localhost:5199/#resumen', { waitUntil: 'networkidle' })
await pagina.waitForTimeout(3000)
await pagina.waitForSelector('text=Entrar al preview local', { timeout: 20000 })
await pagina.click('text=Entrar al preview local')
await pagina.waitForSelector('text=Salir del preview local', { timeout: 20000 })
await pagina.setViewportSize({ width: 1024, height: 768 })

for (const [sel, ruta, archivo] of [
  ['.identity-preview-surface', '#inicio', '01-identity-preview-surface.png'],
  ['.catalog-empty', '#programas', '02-catalog-empty.png'],
]) {
  await pagina.goto(`http://localhost:5199/${ruta}`, { waitUntil: 'networkidle' })
  await pagina.waitForTimeout(3200)
  const r = await pagina.evaluate((seltor) => {
    const el = document.querySelector(seltor)
    if (!el) return null
    const caja = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return {
      visible: el.clientWidth,
      contenido: el.scrollWidth,
      excede: el.scrollWidth - el.clientWidth,
      overflow: cs.overflow,
      titulo: (el.querySelector('h1, h2, h3')?.textContent || '').trim().slice(0, 44),
      hijos: [...el.children].map((c) => {
        const ccs = getComputedStyle(c)
        const cc = c.getBoundingClientRect()
        return {
          tag: c.tagName.toLowerCase(),
          clase: String(c.className || '').slice(0, 32),
          posicion: ccs.position,
          ancho: Math.round(cc.width),
          texto: (c.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28),
        }
      }),
    }
  }, sel)
  console.log(`\n${sel} -> ${JSON.stringify(r, null, 1)}`)
  await pagina.screenshot({ path: join(process.env.SALIDA, archivo), fullPage: false })
}
await navegador.close()
