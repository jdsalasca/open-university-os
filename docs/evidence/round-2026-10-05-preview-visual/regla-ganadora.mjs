// Pregunta al navegador que regla gana para el `color` de los iconos que quedaron
// invisibles en tema oscuro, en lugar de deducirlo leyendo cascadas a mano.
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

const navegador = await chromium.launchPersistentContext(
  `${process.env.TEMP}/opencode-chrome-profile-preview`,
  { executablePath: process.env.CHROMIUM, headless: true, viewport: { width: 1440, height: 900 } },
)
const pagina = await navegador.newPage()
await pagina.goto('http://localhost:5173/#resumen', { waitUntil: 'domcontentloaded' })
await pagina.waitForTimeout(1500)
await pagina.click('text=Entrar al preview local')
await pagina.waitForSelector('text=Desarrollador local', { timeout: 20000 })
await pagina.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
await pagina.goto('http://localhost:5173/#academia', { waitUntil: 'domcontentloaded' })
await pagina.waitForTimeout(4000)

const reglas = await pagina.evaluate(() => {
  const objetivos = []
  for (const padre of ['.academic-operations-note', '.academic-create-entry-heading']) {
    const el = document.querySelector(`${padre} > span`)
    if (el) objetivos.push({ padre, el })
  }
  const salida = []
  for (const { padre, el } of objetivos) {
    const efectivo = getComputedStyle(el).color
    const candidatas = []
    for (const hoja of document.styleSheets) {
      let lista
      try { lista = hoja.cssRules } catch { continue }
      const recorrer = (reglas, origen) => {
        for (const r of reglas) {
          if (r.cssRules) { recorrer(r.cssRules, `${origen} ${r.conditionText || r.name || ''}`); continue }
          if (!r.selectorText || !r.style?.color) continue
          try {
            if (el.matches(r.selectorText)) {
              candidatas.push({ selector: r.selectorText.slice(0, 110), color: r.style.color })
            }
          } catch { /* selector no válido */ }
        }
      }
      recorrer(lista, hoja.href ? hoja.href.split('/').pop() : 'inline')
    }
    salida.push({
      padre,
      efectivo,
      candidatas: candidatas.filter((c) => c.color !== effective || true).slice(0, 8),
    })
  }
  return salida
})

for (const r of reglas) {
  console.log(`\n### ${r.padre} -> color efectivo ${r.efectivo}`)
  for (const c of r.candidatas) console.log(`   ${c.color.padEnd(26)} ${c.selector}`)
}
await navegador.close()
