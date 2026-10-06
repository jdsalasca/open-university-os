// Comprobacion independiente de axe-core: para cada clase candidata que sí se renderiza, mide el
// contraste real del texto contra el fondo computado, subiendo por los ancestros hasta encontrar uno
// opaco. axe-core puede pasar un elemento por texto grande o por no tener texto propio, y aqui se
// ve el numero, no el veredicto.
//
//   PLAYWRIGHT_CORE=<ruta>  CHROMIUM=<chrome.exe>
//   node docs/evidence/round-2026-10-05-estados-ocultos/medir-contraste.mjs [salida.txt]
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

const BASE = process.env.BASE ?? 'http://localhost:5173'
const RUTAS = ['#resumen', '#inicio', '#programas', '#academia', '#admisiones', '#espacios', '#accesos', '#biblioteca', '#noticias']

const INFORME = new URL('./renderizadas-2026-10-06.txt', import.meta.url).pathname.replace(/^\//, '')
const clases = [...readFileSync(INFORME, 'utf8').split('\n')]
  .map((linea) => linea.trim().match(/^\.([a-z0-9][a-z0-9-]+)/i)?.[1])
  .filter(Boolean)

const navegador = await chromium.launchPersistentContext(
  `${process.env.TEMP}/opencode-chrome-profile-estados-2026-10-06`,
  { executablePath: process.env.CHROMIUM, headless: true, viewport: { width: 1280, height: 1000 } },
)
const pagina = await navegador.newPage()

const medir = (objetivo) => pagina.evaluate((clases) => {
  const canal = (valor) => {
    const m = valor.match(/\d+(\.\d+)?/g)
    return m ? m.slice(0, 3).map(Number) : null
  }
  const luminancia = (rgb) => {
    const [r, g, b] = rgb.map((v) => {
      const s = v / 255
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const opaco = (color) => {
    const rgb = canal(color)
    if (!rgb) return null
    const alfa = Number(color.match(/rgba?\([^)]*,\s*([\d.]+)\)/)?.[1] ?? '1')
    return alfa >= 0.95 ? rgb : null
  }
  const fondoDe = (nodo) => {
    for (let actual = nodo; actual; actual = actual.parentElement) {
      const estilo = getComputedStyle(actual)
      const rgb = opaco(estilo.backgroundColor)
      if (rgb) return { rgb, desde: actual.className || actual.tagName }
    }
    return { rgb: [255, 255, 255], desde: 'raiz' }
  }

  const salida = []
  for (const clase of clases) {
    for (const nodo of document.querySelectorAll(`.${clase}`)) {
      const estilo = getComputedStyle(nodo)
      const texto = [...nodo.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent.trim())
        .join('')
      if (!texto) continue
      const fondo = fondoDe(nodo)
      const fg = canal(estilo.color)
      if (!fg) continue
      const [alto, bajo] = [luminancia(fg), luminancia(fondo.rgb)].sort((a, b) => b - a)
      const ratio = (alto + 0.05) / (bajo + 0.05)
      const px = Number.parseFloat(estilo.fontSize)
      const peso = Number.parseInt(estilo.fontWeight, 10) || 400
      // WCAG AA: 4.5 para texto normal, 3 para texto grande (>=24px, o >=18.66px en negrita).
      const grande = px >= 24 || (px >= 18.66 && peso >= 700)
      const exigido = grande ? 3 : 4.5
      if (ratio < exigido) {
        salida.push({
          clase,
          texto: texto.slice(0, 40),
          ratio: ratio.toFixed(2),
          exigido,
          color: estilo.color,
          fondo: `rgb(${fondo.rgb.join(', ')})`,
          fondoDesde: String(fondo.desde).slice(0, 40),
          px,
        })
      }
    }
  }
  return salida
}, clases)

const hallazgos = []
for (const tema of ['light', 'dark']) {
  await pagina.goto(`${BASE}/#resumen`, { waitUntil: 'networkidle' })
  await pagina.waitForTimeout(2500)
  const boton = await pagina.$('text=Entrar al preview local')
  if (boton) {
    await boton.click()
    await pagina.waitForSelector('text=Desarrollador local', { timeout: 20000 }).catch(() => {})
    await pagina.waitForTimeout(1500)
  }
  for (const ruta of RUTAS) {
    await pagina.goto(`${BASE}/${ruta}`, { waitUntil: 'networkidle' })
    await pagina.evaluate((valor) => document.documentElement.setAttribute('data-theme', valor), tema)
    await pagina.waitForTimeout(900)
    await pagina.evaluate(() => {
      for (const control of document.querySelectorAll('[aria-expanded="false"], details:not([open])')) {
        control.setAttribute('aria-expanded', 'true')
        if (control.tagName === 'DETAILS') control.setAttribute('open', '')
        else control.click()
      }
    })
    await pagina.waitForTimeout(700)
    for (const h of await medir()) hallazgos.push({ tema, ruta, ...h })
  }
}
await navegador.close()

const lineas = [
  `contraste medido del texto propio de las ${clases.length} clases candidatas que sí se renderizan`,
  `muestra por debajo de AA: ${hallazgos.length}`,
  '',
]
for (const h of hallazgos) {
  lineas.push(`${h.tema} ${h.ruta}  .${h.clase}  ratio ${h.ratio} (exigido ${h.exigido})`)
  lineas.push(`    texto "${h.texto}" · ${h.color} sobre ${h.fondo} desde ${h.fondoDesde} · ${h.px}px`)
}
const salida = process.argv[2]
if (salida) writeFileSync(salida, lineas.join('\n'), 'utf8')
console.log(lineas.slice(0, 2).join('\n'))
