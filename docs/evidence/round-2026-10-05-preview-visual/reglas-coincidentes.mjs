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

const salida = await pagina.evaluate(() => {
  const el = document.querySelector('.academic-operations-note > span')
  if (!el) return { error: 'no encontrado' }
  const efectivo = getComputedStyle(el).color
  const coincidencias = []
  for (const hoja of document.styleSheets) {
    let lista
    try { lista = hoja.cssRules } catch { continue }
    const recorrer = (reglas) => {
      for (const r of reglas) {
        if (r.cssRules) { recorrer(r.cssRules); continue }
        if (!r.selectorText) continue
        let casa = false
        try { casa = el.matches(r.selectorText) } catch { continue }
        if (!casa) continue
        coincidencias.push({
          selector: r.selectorText.slice(0, 130),
          color: r.style.getPropertyValue('color') || '(sin color)',
          bg: r.style.getPropertyValue('background') || r.style.getPropertyValue('background-color') || '(sin fondo)',
          colorResuelto: r.style.color ? r.style.color : '',
        })
      }
    }
    recorrer(lista)
  }
  return {
    efectivo,
    total: document.styleSheets.length,
    texto: el.textContent,
    outer: el.outerHTML.slice(0, 160),
    padre: el.parentElement.outerHTML.slice(0, 120),
    coincidencias,
  }
})

console.log(`hojas: ${salida.total}`)
console.log(`span: ${salida.texto} | color efectivo ${salida.efectivo}`)
console.log(`html: ${salida.outer}`)
console.log(`reglas que matchean: ${salida.coincidencias.length}`)
for (const c of salida.coincidencias) console.log(`  color=${c.color.padEnd(30)} bg=${c.bg.padEnd(14)} ${c.selector}`)
await navegador.close()
