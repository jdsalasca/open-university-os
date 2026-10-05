import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

// Las rondas anteriores midieron contraste, nombres y area tactil a 1440 px. Faltaba la
// responsive: si el objetivo de latencia y los presupuestos de bundle ya se miden, el
// comportamiento en pantallas reales tambien. Se recorre cada ruta en cinco anchos y se
// registra el desborde horizontal y cualquier elemento que se salga del viewport.
const ANCHOS = [
  { nombre: 'movil-360', width: 360, height: 780 },
  { nombre: 'movil-390', width: 390, height: 844 },
  { nombre: 'tablet-768', width: 768, height: 1024 },
  { nombre: 'tablet-1024', width: 1024, height: 768 },
  { nombre: 'escritorio-1440', width: 1440, height: 900 },
]
const RUTAS = ['#resumen', '#estudiantes', '#biblioteca', '#avisos', '#programas', '#inicio', '#academia', '#admisiones', '#espacios', '#accesos']

const navegador = await chromium.launchPersistentContext(
  join(process.env.TEMP, 'opencode-chrome-profile-v10'),
  { executablePath: process.env.CHROMIUM, headless: true, viewport: { width: 1440, height: 900 } },
)
const pagina = await navegador.newPage()
await pagina.setViewportSize({ width: 1440, height: 900 })
await pagina.goto('http://localhost:5199/#resumen', { waitUntil: 'networkidle' })
await pagina.waitForTimeout(3000)
await pagina.waitForSelector('text=Entrar al preview local', { timeout: 20000 })
await pagina.click('text=Entrar al preview local')
await pagina.waitForSelector('text=Desarrollador local', { timeout: 20000 })

const lineas = ['Desborde horizontal y elementos fuera de viewport por ruta y ancho', '']
let totalFallos = 0

for (const { nombre, width, height } of ANCHOS) {
  lineas.push(`========== ${nombre} (${width} x ${height}) ==========`)
  await pagina.setViewportSize({ width, height })
  for (const ruta of RUTAS) {
    await pagina.goto(`http://localhost:5199/${ruta}`, { waitUntil: 'networkidle' })
    await pagina.waitForTimeout(2600)
    const r = await pagina.evaluate((limite) => {
      const doc = document.documentElement
      const desborde = doc.scrollWidth - doc.clientWidth
      const culpables = []
      if (desborde > 0) {
        for (const el of document.querySelectorAll('body *')) {
          const caja = el.getBoundingClientRect()
          if (caja.width === 0 || caja.height === 0) continue
          if (caja.right > limite + 1) {
            culpables.push({
              tag: el.tagName.toLowerCase(),
              clase: String(el.className || '(sin clase)').slice(0, 44),
              derecha: Math.round(caja.right),
            })
          }
          if (culpables.length >= 4) break
        }
      }
      return { desborde, culpables }
    }, width)

    if (r.desborde > 0) {
      totalFallos++
      lineas.push(`  ${ruta}: desborde ${r.desborde} px`)
      for (const c of r.culpables) lineas.push(`      <${c.tag} class="${c.clase}"> llega a ${c.derecha} px`)
    } else {
      lineas.push(`  ${ruta}: ok`)
    }
  }
  lineas.push('')
}

lineas.push(`TOTAL rutas con desborde horizontal: ${totalFallos}`)
writeFileSync(join(process.env.SALIDA, 'responsive.txt'), lineas.join('\n'), 'utf8')
console.log(lineas.filter((l) => l.includes('desborde') || l.startsWith('TOTAL')).join('\n'))
await navegador.close()
