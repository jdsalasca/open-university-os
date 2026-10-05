import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

// El script anterior de accesibilidad anunciaba "foco visible" en el titulo pero NUNCA lo midio:
// solo contaba nombres y area tactil. Aqui se recorre la pagina con Tab de verdad, que es como
// la recorre una persona sin raton, y se compara el elemento enfocado con el mismo elemento sin
// enfocar. Un outline puede estar presente y ser invisible por color; un box-shadow puede ser la
// unica senal. Solo la comparacion dice si hay alguna diferencia perceptible.
const RUTAS = ['#resumen', '#estudiantes', '#biblioteca', '#avisos', '#programas', '#inicio', '#academia', '#admisiones', '#espacios', '#accesos']
const PROPIEDADES = ['outlineStyle', 'outlineWidth', 'outlineColor', 'outlineOffset',
  'boxShadow', 'borderColor', 'borderWidth', 'backgroundColor', 'color', 'textDecorationLine']

const navegador = await chromium.launchPersistentContext(
  join(process.env.TEMP, 'opencode-chrome-profile-v15'),
  { executablePath: process.env.CHROMIUM, headless: true, viewport: { width: 1440, height: 900 } },
)
const pagina = await navegador.newPage()
await pagina.goto('http://localhost:5199/#resumen', { waitUntil: 'networkidle' })
await pagina.waitForTimeout(3000)
await pagina.waitForSelector('text=Entrar al preview local', { timeout: 20000 })
await pagina.click('text=Entrar al preview local')
await pagina.waitForSelector('text=Salir del preview local', { timeout: 20000 })

const lineas = ['Recorrido con Tab: elementos que reciben el foco sin diferencia perceptible', '']
let total = 0
let recorridos = 0

for (const ruta of RUTAS) {
  await pagina.goto(`http://localhost:5199/${ruta}`, { waitUntil: 'networkidle' })
  await pagina.waitForTimeout(2800)
  await pagina.evaluate(() => document.querySelector('main')?.focus?.())

  const sinDiferencia = []
  let visitados = 0

  for (let paso = 0; paso < 60; paso++) {
    await pagina.keyboard.press('Tab')
    const r = await pagina.evaluate((props) => {
      const el = document.activeElement
      if (!el || el === document.body || el === document.documentElement) return null
      const caja = el.getBoundingClientRect()
      if (caja.width === 0 || caja.height === 0) return null
      const firmaDe = () => {
        const cs = getComputedStyle(el)
        return props.map((p) => cs[p]).join('|')
      }
      const enfocada = firmaDe()
      const etiqueta = el.getAttribute('aria-label')
        || (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 34)
        || el.tagName.toLowerCase()
      // Se quita el foco del propio elemento sin perder el nodo y se vuelve a firma.
      el.blur()
      const suelta = firmaDe()
      el.focus({ preventScroll: true })
      return {
        enfocada,
        suelta,
        etiqueta,
        tag: el.tagName.toLowerCase(),
        clase: String(el.className || '').slice(0, 40),
      }
    }, PROPIEDADES)

    if (r) {
      visitados++
      recorridos++
      if (r.enfocada === r.suelta) sinDiferencia.push(r)
    }
  }

  const unicos = [...new Map(sinDiferencia.map((i) => [i.etiqueta + i.clase, i])).values()]
  total += unicos.length
  lineas.push(`--- ${ruta}: ${visitados} con foco, ${unicos.length} sin diferencia perceptible`)
  for (const i of unicos.slice(0, 8)) lineas.push(`    <${i.tag} class="${i.clase}"> "${i.etiqueta}"`)
}

lineas.push('')
lineas.push(`TOTAL elementos recorridos con Tab: ${recorridos}`)
lineas.push(`TOTAL sin diferencia perceptible al enfocar: ${total}`)
writeFileSync(join(process.env.SALIDA, 'foco-tecla.txt'), lineas.join('\n'), 'utf8')
console.log(lineas.filter((l) => l.startsWith('---') || l.startsWith('TOTAL')).join('\n'))
await navegador.close()
