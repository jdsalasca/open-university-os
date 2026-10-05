import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

// Barrido de las nueve rutas reales de App.tsx. Las seis de la ronda anterior estaban
// limpias; faltan estudiantes, biblioteca, avisos y accesos, que ninguna ronda ha medido.
const RUTAS = ['#resumen', '#estudiantes', '#biblioteca', '#avisos', '#avisos-admin', '#programas', '#inicio', '#academia', '#admisiones', '#espacios', '#accesos']

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
await pagina.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))

const lineas = ['Barrido de contraste en tema oscuro, nueve rutas + subrutas de App.tsx', '']
let totalFallos = 0

for (const ruta of RUTAS) {
  await pagina.goto(`http://localhost:5199/${ruta}`, { waitUntil: 'networkidle' })
  await pagina.waitForTimeout(3200)
  const fallos = await pagina.evaluate(() => {
    const luminancia = (color) => {
      const n = color.match(/\d+/g).map(Number)
      const [r, g, b] = n.slice(0, 3).map((v) => {
        const c = v / 255
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const ratio = (a, b) => {
      const [hi, lo] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
      return Number(((hi + 0.05) / (lo + 0.05)).toFixed(2))
    }
    const salida = []
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el)
      const bg = cs.backgroundColor
      if (!bg || bg === 'rgba(0, 0, 0, 0)') continue
      const texto = (el.textContent || '').trim()
      if (!texto || texto.length > 60) continue
      const r = ratio(bg, cs.color)
      if (r >= 4.5) continue
      salida.push({
        r,
        tag: el.tagName.toLowerCase(),
        clase: String(el.className || '(sin clase)').slice(0, 46),
        bg,
        color: cs.color,
        texto: texto.replace(/\s+/g, ' ').slice(0, 34),
      })
    }
    return salida
  })
  totalFallos += fallos.length
  lineas.push(`### ${ruta}: ${fallos.length} elementos con texto bajo AA`)
  for (const f of fallos.slice(0, 10)) {
    lineas.push(`  ${String(f.r).padEnd(5)} <${f.tag} class="${f.clase}"> bg=${f.bg} texto=${f.color}`)
    lineas.push(`        "${f.texto}"`)
  }
  lineas.push('')
}

lineas.push(`TOTAL: ${totalFallos}`)
writeFileSync(join(process.env.SALIDA, 'barrido-nueve-rutas.txt'), lineas.join('\n'), 'utf8')
console.log(lineas.filter((l) => l.startsWith('###') || l.startsWith('TOTAL')).join('\n'))
await navegador.close()
