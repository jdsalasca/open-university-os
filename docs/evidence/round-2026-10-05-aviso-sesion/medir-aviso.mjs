import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

// El aviso de sesion se recortaba en ocho de las diez rutas. Se comprueba en cuatro anchos que
// el texto completo se ve, midiendo el contenido contra lo visible en cada caso.
const RUTAS = ['#resumen', '#academia', '#programas', '#espacios']
const ANCHOS = [['movil-390', 390, 844], ['tablet-768', 768, 1024], ['escritorio-1024', 1024, 768], ['ancho-1440', 1440, 900]]

const navegador = await chromium.launchPersistentContext(
  join(process.env.TEMP, 'opencode-chrome-profile-v18'),
  { executablePath: process.env.CHROMIUM, headless: true, viewport: { width: 1440, height: 900 } },
)
const pagina = await navegador.newPage()
await pagina.goto('http://localhost:5199/#resumen', { waitUntil: 'networkidle' })
await pagina.waitForTimeout(3000)
await pagina.waitForSelector('text=Entrar al preview local', { timeout: 20000 })
await pagina.click('text=Entrar al preview local')
await pagina.waitForSelector('text=Salir del preview local', { timeout: 20000 })

const lineas = ['Aviso de sesion: texto completo visible, por ruta y ancho', '']
let recortes = 0

for (const [nombre, width, height] of ANCHOS) {
  lineas.push(`========== ${nombre} (${width} px) ==========`)
  await pagina.setViewportSize({ width, height })
  for (const ruta of RUTAS) {
    await pagina.goto(`http://localhost:5199/${ruta}`, { waitUntil: 'networkidle' })
    await pagina.waitForTimeout(2600)
    const r = await pagina.evaluate(() => {
      const el = document.querySelector('.identity-session-status')
      if (!el) return null
      const caja = el.getBoundingClientRect()
      return {
        texto: (el.textContent || '').trim(),
        visible: el.clientWidth,
        contenido: el.scrollWidth,
        alto: Math.round(caja.height),
        lineas: Math.round(caja.height / 14),
      }
    })
    if (!r) {
      lineas.push(`  ${ruta}: sin aviso (sesion institucional)`)
      continue
    }
    const excede = r.contenido - r.visible
    if (excede > 2) recortes++
    lineas.push(`  ${ruta}: "${r.texto}" | ${r.visible} px visibles de ${r.contenido} | alto ${r.alto} px`
      + (excede > 2 ? `  <- RECORTA ${excede} px` : '  ok'))
  }
  lineas.push('')
}

lineas.push(`TOTAL avisos recortados: ${recortes}`)
writeFileSync(join(process.env.SALIDA, 'aviso-sesion.txt'), lineas.join('\n'), 'utf8')
console.log(lineas.filter((l) => l.includes('ok') || l.includes('RECORTA') || l.startsWith('TOTAL')).join('\n'))

// Una captura del aviso ya sin recorte, ampliado.
await pagina.setViewportSize({ width: 1440, height: 900 })
await pagina.goto('http://localhost:5199/#resumen', { waitUntil: 'networkidle' })
await pagina.waitForTimeout(2600)
await pagina.locator('.identity-session-controls').first()
  .screenshot({ path: join(process.env.SALIDA, '01-aviso-sesion.png'), timeout: 8000 })
  .catch(() => {})
console.log('captura lista')
await navegador.close()
