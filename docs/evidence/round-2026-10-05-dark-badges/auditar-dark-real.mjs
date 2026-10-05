// Recorre la consola academica en tema oscuro y lista TODO elemento con texto propio cuyo
// fondo y color no alcanzan AA. Sirve para contrastar el analisis estatico: los candidatos de
// find-dark-badges.mjs pueden ser falsos positivos si el tema los cubre por otra via.
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

const navegador = await chromium.launchPersistentContext(
  `${process.env.TEMP}/opencode-chrome-profile-v5`,
  { executablePath: process.env.CHROMIUM, headless: true, viewport: { width: 1440, height: 900 } },
)
const pagina = await navegador.newPage()
await pagina.goto('http://localhost:5199/#resumen', { waitUntil: 'networkidle' })
await pagina.waitForTimeout(3500)
await pagina.waitForSelector('text=Entrar al preview local', { timeout: 20000 })
await pagina.click('text=Entrar al preview local')
await pagina.waitForSelector('text=Desarrollador local', { timeout: 20000 })
await pagina.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))

const rutas = ['#academia', '#inicio', '#espacios', '#admisiones', '#programas', '#branding']
for (const ruta of rutas) {
  await pagina.goto(`http://localhost:5199/${ruta}`, { waitUntil: 'networkidle' })
  await pagina.waitForTimeout(3500)
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
        clase: String(el.className || '(sin clase)').slice(0, 46),
        tag: el.tagName.toLowerCase(),
        bg,
        color: cs.color,
        texto: texto.replace(/\s+/g, ' ').slice(0, 34),
      })
    }
    return salida
  })
  console.log(`\n### ${ruta}: ${fallos.length} elementos con texto bajo AA`)
  for (const f of fallos.slice(0, 8)) {
    console.log(`  ${String(f.r).padEnd(5)} <${f.tag} class="${f.clase}"> bg=${f.bg} texto=${f.color}`)
    console.log(`        "${f.texto}"`)
  }
}
await navegador.close()
