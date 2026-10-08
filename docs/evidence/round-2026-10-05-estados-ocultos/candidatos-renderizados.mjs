// Los 63 candidatos de find-dark-badges.mjs son reglas de componente con fondo claro y color literal
// cuya clase el tema oscuro no repinta. La ronda anterior los declaro "pendientes" porque no se sabe
// si se pintan. Este script responde exactamente eso: tras recorrer las once rutas con todos los
// estados desplegados, comprueba si cada clase candidata aparece en el DOM real.
//
// Un candidato que nunca se renderiza no es un defecto: es codigo para un estado que la plataforma
// no permite todavia. Solo los que aparecen son trabajo pendiente de verdad.
//
//   PLAYWRIGHT_CORE=<ruta>  CHROMIUM=<chrome.exe>
//   node docs/evidence/round-2026-10-05-estados-ocultos/candidatos-renderizados.mjs [salida.txt]
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

const BASE = process.env.BASE ?? 'http://localhost:5173'
const RUTAS = ['#resumen', '#inicio', '#estudiantes', '#biblioteca', '#avisos', '#avisos-admin', '#programas', '#academia', '#admisiones', '#espacios', '#accesos']

// El archivo que genera find-dark-badges.mjs, para no mantener una segunda lista a mano.
const INFORME = new URL('./candidatos-estaticos.txt', import.meta.url).pathname.replace(/^\//, '')
const candidatos = new Map()
for (const linea of readFileSync(INFORME, 'utf8').split('\n')) {
  const selector = linea.trim()
  if (!selector.startsWith('.')) continue
  for (const clase of selector.matchAll(/\.([a-z0-9][a-z0-9-]+)/gi)) {
    candidatos.set(clase[1], { clase: clase[1], selector })
  }
}

const navegador = await chromium.launchPersistentContext(
  `${process.env.TEMP}/opencode-chrome-profile-estados-2026-10-06`,
  { executablePath: process.env.CHROMIUM, headless: true, viewport: { width: 1280, height: 1000 } },
)
const pagina = await navegador.newPage()

const vistas = new Map()
await pagina.goto(`${BASE}/#resumen`, { waitUntil: 'networkidle' })
await pagina.waitForTimeout(2500)
const boton = await pagina.$('text=Entrar al preview local')
if (boton) {
  await boton.click()
  await pagina.waitForSelector('text=Desarrollador local', { timeout: 20000 }).catch(() => {})
  await pagina.waitForTimeout(1500)
}

for (const tema of ['light', 'dark']) {
  for (const ruta of RUTAS) {
    await pagina.goto(`${BASE}/${ruta}`, { waitUntil: 'networkidle' })
    await pagina.evaluate((valor) => document.documentElement.setAttribute('data-theme', valor), tema)
    await pagina.waitForTimeout(900)
    // Todos los estados plegados, para no medir solo la pagina en reposo.
    await pagina.evaluate(() => {
      for (const control of document.querySelectorAll('[aria-expanded="false"], details:not([open])')) {
        control.setAttribute('aria-expanded', 'true')
        if (control.tagName === 'DETAILS') control.setAttribute('open', '')
        else control.click()
      }
    })
    await pagina.waitForTimeout(700)
    const presentes = await pagina.evaluate((clases) => clases.filter((clase) => document.querySelector(`.${clase}`)), [...candidatos.keys()])
    for (const clase of presentes) {
      const donde = vistas.get(clase) ?? []
      donde.push(`${tema} ${ruta}`)
      vistas.set(clase, donde)
    }
  }
}
await navegador.close()

const pintados = [...vistas.entries()]
const lineas = [
  `candidatos estaticos: ${candidatos.size}`,
  `clases que SI se renderizan en alguna ruta: ${pintados.length}`,
  `clases que nunca se pintan: ${candidatos.size - pintados.length}`,
  '',
  'Una clase que nunca aparece en el DOM no es un defecto de contraste: es una regla para un estado',
  'que la plataforma todavia no permite. Solo la lista de abajo es trabajo real.',
  '',
  'renderizadas:',
]
for (const [clase, donde] of [...pintados].sort()) {
  lineas.push(`  .${clase}  <-  ${[...new Set(donde)].join(', ')}`)
}
const salida = process.argv[2]
if (salida) writeFileSync(salida, lineas.join('\n'), 'utf8')
console.log(lineas.slice(0, 3).join('\n'))
