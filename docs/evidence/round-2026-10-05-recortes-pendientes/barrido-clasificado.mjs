import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

// Barrido responsive con el criterio corregido. El detector anterior reportaba 25 recortes y todos
// eran decoracion: circulos `::before`/`::after` que sobresalen del marco a proposito. Ahora se
// distingue contenido perdido de decoracion: si el elemento se desborda pero ninguno de sus hijos
// directos excede el ancho visible, lo que excede no es texto.
//
// El criterio esta probado en check-clip-detector.node-test.mjs con markup real.
const RUTAS = ['#resumen', '#estudiantes', '#biblioteca', '#avisos', '#programas', '#inicio', '#academia', '#admisiones', '#espacios', '#accesos']
const ANCHOS = [['movil-360', 360, 780], ['tablet-768', 768, 1024], ['escritorio-1024', 1024, 768], ['ancho-1440', 1440, 900]]

const navegador = await chromium.launchPersistentContext(
  join(process.env.TEMP, 'opencode-chrome-profile-v20'),
  { executablePath: process.env.CHROMIUM, headless: true, viewport: { width: 1440, height: 900 } },
)
const pagina = await navegador.newPage()
await pagina.goto('http://localhost:5199/#resumen', { waitUntil: 'networkidle' })
await pagina.waitForTimeout(3000)
await pagina.waitForSelector('text=Entrar al preview local', { timeout: 20000 })
await pagina.click('text=Entrar al preview local')
await pagina.waitForSelector('text=Salir del preview local', { timeout: 20000 })

const revisar = () => {
  const perdidos = []
  const decoracion = 0
  let decoraciones = 0
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el)
    // Texto visualmente oculto a proposito: lo mantiene el patron clip de una linea.
    if (cs.clip !== 'auto' && cs.clip !== '') continue
    if (el.clientWidth <= 2) continue
    if (cs.overflow !== 'hidden' && cs.overflowX !== 'hidden') continue
    if (el.scrollWidth - el.clientWidth <= 4) continue
    const texto = (el.textContent || '').trim().replace(/\s+/g, ' ')
    if (!texto) continue
    // Criterio: si ningun hijo directo excede el ancho visible, lo que desborda son los
    // pseudo-elementos ::before/::after, que no aparecen en `children` y son decoracion.
    const hijosExceden = [...el.children].some((hijo) => {
      const posicion = getComputedStyle(hijo).position
      // Un hijo posicionado fuera del flujo es decoracion aunque exceda.
      if (posicion === 'absolute' || posicion === 'fixed') return false
      return hijo.scrollWidth - hijo.clientWidth > 2
    })
    if (hijosExceden) {
      perdidos.push({
        clase: String(el.className || '(sin clase)').slice(0, 46),
        excede: el.scrollWidth - el.clientWidth,
        texto: texto.slice(0, 38),
      })
    } else {
      decoraciones++
    }
  }
  return { perdidos, decoraciones }
}

const lineas = ['Barrido responsive: contenido perdido frente a decoracion', '']
let totalPerdidos = 0
let totalDecoraciones = 0

for (const [nombre, width, height] of ANCHOS) {
  lineas.push(`========== ${nombre} (${width} px) ==========`)
  await pagina.setViewportSize({ width, height })
  for (const ruta of RUTAS) {
    await pagina.goto(`http://localhost:5199/${ruta}`, { waitUntil: 'networkidle' })
    await pagina.waitForTimeout(2400)
    const r = await pagina.evaluate(revisar)
    totalPerdidos += r.perdidos.length
    totalDecoraciones += r.decoraciones
    if (r.perdidos.length === 0) {
      lineas.push(`  ${ruta}: sin contenido perdido (${r.decoraciones} decoraciones)`)
      continue
    }
    lineas.push(`  ${ruta}: ${r.perdidos.length} con contenido perdido`)
    for (const p of r.perdidos.slice(0, 4)) {
      lineas.push(`      PERDIDO ${p.excede}px class="${p.clase}" "${p.texto}"`)
    }
  }
  lineas.push('')
}

lineas.push(`TOTAL elementos con contenido perdido: ${totalPerdidos}`)
lineas.push(`TOTAL con decoracion que sobresale a proposito: ${totalDecoraciones}`)
writeFileSync(join(process.env.SALIDA, 'barrido-clasificado.txt'), lineas.join('\n'), 'utf8')
console.log(lineas.filter((l) => l.includes('PERDIDO') || l.startsWith('TOTAL')).join('\n'))
await navegador.close()
