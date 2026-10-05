import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

// El detector anterior reportaba 203 anomalias y todas eran el patron de texto visualmente
// oculto: `clip: rect(0,0,0,0)` con 1 px de ancho, que es como la aplicacion esconde las
// etiquetas del sidebar colapsado y los radios del selector de tema. Un detector que cuenta eso
// da 203 falsos positivos y no sirve de nada. Este excluye el patron de verdad.
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

const revisar = () => {
  const recortes = []
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el)
    // Texto visualmente oculto a proposito: lo mantiene el patron clip de una linea.
    if (cs.clip !== 'auto' && cs.clip !== '') continue
    if (el.clientWidth <= 2) continue
    if (cs.overflow !== 'hidden' && cs.overflowX !== 'hidden') continue
    if (el.scrollWidth - el.clientWidth <= 4) continue
    const texto = (el.textContent || '').trim().replace(/\s+/g, ' ')
    if (!texto) continue
    recortes.push({
      clase: String(el.className || '(sin clase)').slice(0, 44),
      excede: el.scrollWidth - el.clientWidth,
      texto: texto.slice(0, 36),
    })
  }
  return recortes
}

let total = 0
for (const [nombre, width] of [['movil-360', 360], ['tablet-768', 768], ['escritorio-1024', 1024]]) {
  await pagina.setViewportSize({ width, height: width < 500 ? 780 : 1024 })
  console.log(`\n=== ${nombre} (${width} px) ===`)
  for (const ruta of RUTAS) {
    await pagina.goto(`http://localhost:5199/${ruta}`, { waitUntil: 'networkidle' })
    await pagina.waitForTimeout(2400)
    const recortes = await pagina.evaluate(revisar)
    if (recortes.length === 0) {
      console.log(`  ${ruta}: ok`)
      continue
    }
    total += recortes.length
    console.log(`  ${ruta}: ${recortes.length} recortes reales`)
    for (const c of recortes.slice(0, 3)) {
      console.log(`      RECORTA ${c.excede}px class="${c.clase}" "${c.texto}"`)
    }
  }
}
console.log(`\nTOTAL recortes reales: ${total}`)
await navegador.close()
