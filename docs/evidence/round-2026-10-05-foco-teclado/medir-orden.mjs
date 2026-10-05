import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

// Que el foco sea visible no basta: si Tab recorre en un orden distinto al visual, la persona
// ve el anillo saltar de un lado a otro de la pantalla. Se recorre con Tab, se registra el orden
// real y se compara con el orden de lectura (arriba a abajo, izquierda a derecha). Un salto hacia
// atras es un defecto; un salto hacia adelante de menos de una linea es normal.
const RUTAS = ['#resumen', '#estudiantes', '#biblioteca', '#avisos', '#programas', '#inicio', '#academia', '#admisiones', '#espacios', '#accesos']

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

const lineas = ['Orden de tabulacion frente al orden visual (retrocesos y saltos de mas de una linea)', '']
let totalProblemas = 0

for (const ruta of RUTAS) {
  await pagina.goto(`http://localhost:5199/${ruta}`, { waitUntil: 'networkidle' })
  await pagina.waitForTimeout(2800)
  await pagina.evaluate(() => document.querySelector('main')?.focus?.())

  const pasos = []
  for (let paso = 0; paso < 70; paso++) {
    await pagina.keyboard.press('Tab')
    const r = await pagina.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body || el === document.documentElement) return null
      const caja = el.getBoundingClientRect()
      if (caja.width === 0 || caja.height === 0) return null
      // Posicion visual: se ordena por franjas de linea y luego por columna.
      const linea = Math.round(caja.top / 24)
      return {
        etiqueta: el.getAttribute('aria-label')
          || (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30)
          || el.tagName.toLowerCase(),
        tag: el.tagName.toLowerCase(),
        clase: String(el.className || '').slice(0, 34),
        top: Math.round(caja.top),
        left: Math.round(caja.left),
        linea,
      }
    })
    if (r) pasos.push(r)
  }

  const problemas = []
  for (let i = 1; i < pasos.length; i++) {
    const antes = pasos[i - 1]
    const ahora = pasos[i]
    const deltaLineas = ahora.linea - antes.linea
    // Retroceso visible: sube mas de una franja de linea.
    if (deltaLineas < -1) {
      problemas.push({ tipo: 'retroceso', desde: antes, hacia: ahora, delta: deltaLineas })
    } else if (deltaLineas === 0 && ahora.left < antes.left - 40) {
      problemas.push({ tipo: 'salto a la izquierda', desde: antes, hacia: ahora, delta: ahora.left - antes.left })
    }
  }

  totalProblemas += problemas.length
  lineas.push(`--- ${ruta}: ${pasos.length} pasos de Tab, ${problemas.length} saltos**) `.replace('**', '').trim())
  for (const p of problemas.slice(0, 6)) {
    lineas.push(`    ${p.tipo} (${p.delta})`)
    lineas.push(`      desde <${p.desde.tag} class="${p.desde.clase}"> "${p.desde.etiqueta}"`)
    lineas.push(`      hacia  <${p.hacia.tag} class="${p.hacia.clase}"> "${p.hacia.etiqueta}"`)
  }
}

lineas.push('')
lineas.push(`TOTAL saltos fuera del orden visual: ${totalProblemas}`)
writeFileSync(join(process.env.SALIDA, 'orden-tabulacion.txt'), lineas.join('\n'), 'utf8')
console.log(lineas.filter((l) => l.startsWith('---') || l.startsWith('TOTAL')).join('\n'))
await navegador.close()
