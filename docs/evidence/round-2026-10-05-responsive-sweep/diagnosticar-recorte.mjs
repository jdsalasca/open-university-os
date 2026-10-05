import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

// Once rutas den 14-15 recortes en tablet y ningun desborde horizontal. Eso parece
// contradictorio y no lo es: el desborde del documento mide la pagina, y el recorte de cada
// elemento mide su propio contenido. Un contenedor con overflow hidden y un hijo mas ancho
// queda recortado sin ensanchar la pagina. Este script saca la evidencia.
const navegador = await chromium.launchPersistentContext(
  join(process.env.TEMP, 'opencode-chrome-profile-v11'),
  { executablePath: process.env.CHROMIUM, headless: true, viewport: { width: 768, height: 1024 } },
)
const pagina = await navegador.newPage()
await pagina.goto('http://localhost:5199/#resumen', { waitUntil: 'networkidle' })
await pagina.waitForTimeout(3000)
await pagina.waitForSelector('text=Entrar al preview local', { timeout: 20000 })
await pagina.click('text=Entrar al preview local')
await pagina.waitForSelector('text=Desarrollador local', { timeout: 20000 })
await pagina.setViewportSize({ width: 768, height: 1024 })
await pagina.goto('http://localhost:5199/#resumen', { waitUntil: 'networkidle' })
await pagina.waitForTimeout(3500)

const detalle = await pagina.evaluate(() => {
  const salida = []
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el)
    if (cs.overflow !== 'hidden' && cs.overflowX !== 'hidden') continue
    if (el.scrollWidth - el.clientWidth <= 4 || el.clientWidth <= 0) continue
    const padre = el.parentElement
    const padreCs = padre ? getComputedStyle(padre) : null
    salida.push({
      tag: el.tagName.toLowerCase(),
      clase: String(el.className || '(sin clase)').slice(0, 40),
      anchoVisible: el.clientWidth,
      contenido: el.scrollWidth,
      padreTag: padre?.tagName.toLowerCase(),
      padreClase: String(padre?.className || '').slice(0, 40),
      padreOverflow: padreCs?.overflowX,
      padreFlex: padreCs ? `${padreCs.display} / ${padreCs.flexDirection}` : '',
      texto: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
      hijos: [...el.children].slice(0, 4).map((c) => ({
        tag: c.tagName.toLowerCase(),
        clase: String(c.className || '').slice(0, 30),
        ancho: Math.round(c.getBoundingClientRect().width),
      })),
    })
  }
  return salida
})

console.log(`elementos recortados a 768 px: ${detalle.length}`)
for (const d of detalle.slice(0, 5)) {
  console.log(`\n<${d.tag} class="${d.clase}"> visible ${d.anchoVisible}px, contenido ${d.contenido}px`)
  console.log(`  padre <${d.padreTag} class="${d.padreClase}"> ${d.padreFlex} overflow-x=${d.padreOverflow}`)
  console.log(`  texto: "${d.texto}"`)
  d.hijos.forEach((h) => console.log(`    hijo <${h.tag} class="${h.clase}"> ${h.ancho}px`))
}
await pagina.screenshot({ path: join(process.env.SALIDA, '01-tablet-768-sidebar.png'), fullPage: false })
await navegador.close()
