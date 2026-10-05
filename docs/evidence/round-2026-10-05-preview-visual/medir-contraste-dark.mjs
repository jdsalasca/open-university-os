// Mide el contraste real de la consola academica en tema oscuro. La impresion visual
// sugeria paneles claros con campos oscuros encima; este script lo comprueba con numeros
// en lugar de confiar en la captura.
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

const navegador = await chromium.launchPersistentContext(
  join(process.env.TEMP, 'opencode-chrome-profile-preview'),
  { executablePath: process.env.CHROMIUM, headless: true, viewport: { width: 1440, height: 900 } },
)
const pagina = await navegador.newPage()
await pagina.goto((process.env.BASE || 'http://localhost:5173') + '/#resumen', { waitUntil: 'domcontentloaded' })
await pagina.waitForTimeout(1500)
await pagina.click('text=Entrar al preview local')
await pagina.waitForSelector('text=Desarrollador local', { timeout: 20000 })
await pagina.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
await pagina.goto((process.env.BASE || 'http://localhost:5173') + '/#academia', { waitUntil: 'domcontentloaded' })
await pagina.waitForTimeout(4000)

const resultado = await pagina.evaluate(() => {
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
  const filas = []
  const vistos = new Set()
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el)
    const bg = cs.backgroundColor
    if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') continue
    const texto = (el.textContent || '').trim()
    if (!texto || texto.length > 40) continue
    const clave = `${el.tagName}|${bg}|${cs.color}`
    if (vistos.has(clave)) continue
    vistos.add(clave)
    filas.push({
      etiqueta: el.tagName.toLowerCase(),
      selector: (() => { try { return el.matches(':where(body)') ? 'body' : el.tagName.toLowerCase() + Array.from(document.styleSheets).length } catch { return '?' } })(),
      clase: String(el.className || '').slice(0, 60),
      bg,
      color: cs.color,
      ratio: ratio(bg, cs.color),
      texto: texto.replace(/\s+/g, ' ').slice(0, 44),
    })
  }
  return { fondoPagina: getComputedStyle(document.body).backgroundColor, filas }
})

const lineas = [`fondo de pagina en tema oscuro: ${resultado.fondoPagina}`, '']
const fallos = resultado.filas.filter((f) => f.ratio < 4.5).sort((a, b) => a.ratio - b.ratio)
lineas.push(`elementos con texto medido: ${resultado.filas.length}`)
lineas.push(`elementos por debajo de AA (4.5): ${fallos.length}`, '')
for (const f of fallos) {
  lineas.push(`FALLA ${f.ratio}  <${f.etiqueta} class="${f.clase}">  bg=${f.bg}  texto=${f.color}`)
  lineas.push(`       "${f.texto}"`)
}
writeFileSync(join(process.env.SALIDA, 'contraste-dark-academia.txt'), lineas.join('\n'), 'utf8')
console.log(lineas.slice(0, 30).join('\n'))
await navegador.close()
