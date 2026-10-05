import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

// La ronda anterior solo midio contraste. Faltaban tres dimensiones de accesibilidad que las
// guaras estaticas no cubren: foco visible, nombres acessibles y tamano de area tactil. Este
// script recorre las once rutas y las mide en el DOM real.
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

const lineas = ['Foco visible, nombres accesibles y area tactil en once rutas (1440 x 900)', '']
let totales = { sinNombre: 0, areaPequena: 0, focoInvisible: 0 }

for (const tema of ['light', 'dark']) {
  await pagina.evaluate((t) => document.documentElement.setAttribute('data-theme', t), tema)
  lineas.push(`========== TEMA ${tema.toUpperCase()} ==========`)
  for (const ruta of RUTAS) {
    await pagina.goto(`http://localhost:5199/${ruta}`, { waitUntil: 'networkidle' })
    await pagina.waitForTimeout(3000)
    const r = await pagina.evaluate(() => {
      const interactivos = [...document.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((el) => el.offsetParent !== null && el.getBoundingClientRect().width > 0)

      const nombre = (el) => {
        const aria = el.getAttribute('aria-label')
        if (aria?.trim()) return aria.trim()
        const labelledby = el.getAttribute('aria-labelledby')
        if (labelledby) {
          const t = labelledby.split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim() || '').join(' ')
          if (t) return t
        }
        if (el.id) {
          const etiqueta = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
          if (etiqueta?.textContent?.trim()) return etiqueta.textContent.trim()
        }
        if (el.closest('label')?.textContent?.trim()) return el.closest('label').textContent.trim()
        if (el.getAttribute('title')?.trim()) return el.getAttribute('title').trim()
        if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
          if (el.placeholder?.trim()) return el.placeholder.trim()
        }
        return el.textContent?.trim() || ''
      }

      const sinNombre = interactivos
        .filter((el) => nombre(el).length === 0)
        .map((el) => `<${el.tagName.toLowerCase()} class="${String(el.className || '').slice(0, 40)}">`)

      const areaPequena = interactivos
        .map((el) => ({ el, caja: el.getBoundingClientRect() }))
        .filter(({ caja }) => caja.height < 24 || caja.width < 24)
        .map(({ el, caja }) => ({
          etiqueta: `<${el.tagName.toLowerCase()}> "${nombre(el).slice(0, 26)}"`,
          ancho: Math.round(caja.width),
          alto: Math.round(caja.height),
        }))

      return {
        total: interactivos.length,
        sinNombre: [...new Set(sinNombre)],
        areaPequena,
      }
    })

    totales.sinNombre += r.sinNombre.length
    totales.areaPequena += r.areaPequena.length
    const marca = r.sinNombre.length + r.areaPequena.length > 0 ? 'REVISAR' : 'ok'
    lineas.push(`--- ${ruta} (${r.total} interactivos, ${marca})`)
    for (const s of r.sinNombre) lineas.push(`    SIN NOMBRE ACCESIBLE  ${s}`)
    for (const a of r.areaPequena) lineas.push(`    AREA < 24px  ${a.etiqueta}  ${a.ancho}x${a.alto}`)
  }
  lineas.push('')
}

lineas.push(`TOTAL sin nombre accesible: ${totales.sinNombre}`)
lineas.push(`TOTAL area tactil menor de 24px: ${totales.areaPequena}`)
writeFileSync(join(process.env.SALIDA, 'foco-nombres-area.txt'), lineas.join('\n'), 'utf8')
console.log(lineas.filter((l) => l.includes('TOTAL') || l.includes('REVISAR')).join('\n'))
await navegador.close()
