import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

const navegador = await chromium.launchPersistentContext(
  join(process.env.TEMP, 'opencode-chrome-profile-v8'),
  { executablePath: process.env.CHROMIUM, headless: true, viewport: { width: 1440, height: 900 } },
)
const pagina = await navegador.newPage()
await pagina.goto('http://localhost:5199/#resumen', { waitUntil: 'networkidle' })
await pagina.waitForTimeout(3000)
await pagina.waitForSelector('text=Entrar al preview local', { timeout: 20000 })
await pagina.click('text=Entrar al preview local')
await pagina.waitForSelector('text=Desarrollador local', { timeout: 20000 })

for (const ruta of ['#estudiantes', '#espacios', '#admisiones', '#programas']) {
  await pagina.goto(`http://localhost:5199/${ruta}`, { waitUntil: 'networkidle' })
  await pagina.waitForTimeout(3200)
  const pequenos = await pagina.evaluate(() => {
    const salida = []
    for (const el of document.querySelectorAll('a[href]')) {
      if (el.offsetParent === null) continue
      const caja = el.getBoundingClientRect()
      if (caja.height >= 24) continue
      salida.push({
        clase: String(el.className || '(sin clase)').slice(0, 48),
        texto: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 34),
        ancho: Math.round(caja.width),
        alto: Math.round(caja.height),
      })
    }
    return [...new Map(salida.map((s) => [s.clase + s.texto, s])).values()]
  })
  console.log(`\n### ${ruta}: ${pequenos.length} enlaces por debajo de 24 px`)
  for (const p of pequenos.slice(0, 9)) console.log(`  ${p.ancho}x${p.alto}  class="${p.clase}"  "${p.texto}"`)
}
await navegador.close()
