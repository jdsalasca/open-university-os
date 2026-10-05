import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

// El desborde horizontal da 0 en todas partes, pero un elemento puede quedar ilegible sin
// desbordar: texto cortado, contenido a 4 px de ancho, o un control tactil que en movil se
// queda en 20 px. Este script mide lo que el desborde no ve.
const RUTAS = ['#resumen', '#estudiantes', '#biblioteca', '#avisos', '#programas', '#inicio', '#academia', '#admisiones', '#espacios', '#accesos']

const navegador = await chromium.launchPersistentContext(
  join(process.env.TEMP, 'opencode-chrome-profile-v11'),
  { executablePath: process.env.CHROMIUM, headless: true, viewport: { width: 1440, height: 900 } },
)
const pagina = await navegador.newPage()
await pagina.goto('http://localhost:5199/#resumen', { waitUntil: 'networkidle' })
await pagina.waitForTimeout(3000)
await pagina.waitForSelector('text=Entrar al preview local', { timeout: 20000 })
await pagina.click('text=Entrar al preview local')
await pagina.waitForSelector('text=Desarrollador local', { timeout: 20000 })

const lineas = ['Anomalias que el desborde horizontal no ve, por ruta y ancho', '']
let total = 0

for (const [nombre, width] of [['movil-360', 360], ['tablet-768', 768]]) {
  lineas.push(`========== ${nombre} (${width} px) ==========`)
  await pagina.setViewportSize({ width, height: width < 500 ? 780 : 1024 })
  for (const ruta of RUTAS) {
    await pagina.goto(`http://localhost:5199/${ruta}`, { waitUntil: 'networkidle' })
    await pagina.waitForTimeout(2600)
    const r = await pagina.evaluate(() => {
      const cortes = []
      const pequenos = []
      for (const el of document.querySelectorAll('body *')) {
        const caja = el.getBoundingClientRect()
        if (caja.width === 0 || caja.height === 0) continue
        const cs = getComputedStyle(el)
        if (cs.overflow === 'hidden' || cs.overflowX === 'hidden') {
          // Contenido que no cabe: el navegador lo recorta y el texto se pierde.
          if (el.scrollWidth - el.clientWidth > 4 && el.clientWidth > 0) {
            const texto = (el.textContent || '').trim().replace(/\s+/g, ' ')
            if (texto) {
              cortes.push({
                clase: String(el.className || '(sin clase)').slice(0, 44),
                excede: el.scrollWidth - el.clientWidth,
                texto: texto.slice(0, 34),
              })
            }
          }
        }
        const esControl = el.matches('a[href], button:not([disabled]), input:not([disabled]), select, [tabindex]:not([tabindex="-1"])')
        if (esControl && caja.height < 24 && caja.height > 0 && el.offsetParent !== null) {
          const etiqueta = el.getAttribute('aria-label') || (el.textContent || '').trim() || el.tagName.toLowerCase()
          pequenos.push({
            etiqueta: `${etiqueta.replace(/\s+/g, ' ').slice(0, 30)}`,
            alto: Math.round(caja.height),
            tag: el.tagName.toLowerCase(),
          })
        }
      }
      return {
        cortes: [...new Map(cortes.map((c) => [c.clase + c.texto, c])).values()],
        pequenos: [...new Map(pequenos.map((p) => [p.etiqueta + p.alto, p])).values()],
      }
    })
    const n = r.cortes.length + r.pequenos.length
    total += n
    if (n === 0) {
      lineas.push(`  ${ruta}: ok`)
      continue
    }
    lineas.push(`  ${ruta}: ${r.cortes.length} recortes, ${r.pequenos.length} controles pequenos`)
    for (const c of r.cortes.slice(0, 3)) lineas.push(`      RECORTA ${c.excede}px  class="${c.clase}"  "${c.texto}"`)
    for (const p of r.pequenos.slice(0, 4)) lineas.push(`      CONTROL ${p.alto}px  <${p.tag}> "${p.etiqueta}"`)
  }
  lineas.push('')
}

lineas.push(`TOTAL anomalias: ${total}`)
writeFileSync(join(process.env.SALIDA, 'anomalias-responsive.txt'), lineas.join('\n'), 'utf8')
console.log(lineas.filter((l) => l.includes('RECORTA') || l.includes('CONTROL') || l.includes('recortes') || l.startsWith('TOTAL')).join('\n'))
await navegador.close()
