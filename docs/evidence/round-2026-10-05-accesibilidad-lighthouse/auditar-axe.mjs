// Auditoria de accesibilidad con axe-core sobre las nueve rutas de la aplicacion, en tema claro y
// oscuro, con la sesion de preview iniciada para que las rutas que dependen de permisos rendericen
// su contenido real y no un estado vacio.
//
// Motivo: el 5 de octubre de 2026 Lighthouse encontro en /#accesos un `color-contrast` con ratio
// 1,05:1 que ninguna regla estatica del repo señalaba, porque la causa no estaba en el componente
// sino en la regla puerta de _theme.scss, que reescribe el `color` de todo `main` en tema oscuro y
// solo repinta de oscuro las superficies que figuran en su lista. Una caja de aviso con fondo crema
// literal se queda clara mientras su texto pasa a claro.
//
// Los MCP de navegador no estaban disponibles (el perfil del usuario tenia Chrome abierto), asi que
// el script lanza su propio Chromium y usa el axe-core que ya esta instalado globalmente. No se
// anade ninguna dependencia al repositorio.
//
//   PLAYWRIGHT_CORE=<ruta a playwright-core>  AXE_PATH=<ruta a axe.min.js>  CHROMIUM=<chrome.exe>
//   node docs/evidence/round-2026-10-05-accesibilidad-lighthouse/auditar-axe.mjs [salida.txt]
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)
const axeSource = (await import('node:fs')).readFileSync(process.env.AXE_PATH, 'utf8')

const BASE = process.env.BASE ?? 'http://localhost:5173'
const RUTAS = ['#resumen', '#inicio', '#programas', '#academia', '#admisiones', '#espacios', '#accesos', '#biblioteca', '#noticias']

const navegador = await chromium.launchPersistentContext(
  `${process.env.TEMP}/opencode-chrome-profile-axe-2026-10-05`,
  { executablePath: process.env.CHROMIUM, headless: true, viewport: { width: 1440, height: 900 } },
)
const pagina = await navegador.newPage()

const resultados = []
for (const tema of ['light', 'dark']) {
  await pagina.goto(`${BASE}/#resumen`, { waitUntil: 'networkidle' })
  await pagina.waitForTimeout(2500)
  // La sesion de preview solo se pide una vez: la segunda vuelta reutiliza el mismo contexto.
  const boton = await pagina.$('text=Entrar al preview local')
  if (boton) {
    await boton.click()
    await pagina.waitForSelector('text=Desarrollador local', { timeout: 20000 }).catch(() => {})
    await pagina.waitForTimeout(1500)
  }
  await pagina.evaluate((valor) => document.documentElement.setAttribute('data-theme', valor), tema)

  for (const ruta of RUTAS) {
    await pagina.goto(`${BASE}/${ruta}`, { waitUntil: 'networkidle' })
    await pagina.evaluate((valor) => document.documentElement.setAttribute('data-theme', valor), tema)
    await pagina.waitForTimeout(1200)
    await pagina.addScriptTag({ content: axeSource })
    const violacion = await pagina.evaluate(async () => {
      // eslint-disable-next-line no-undef
      const resultado = await window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
      })
      return resultado.violations.map((v) => ({
        id: v.id,
        impacto: v.impact,
        ayuda: v.help,
        nodos: v.nodes.slice(0, 6).map((n) => ({ objetivo: n.target.join(' '), resumen: (n.failureSummary ?? '').split('\n')[1]?.trim() })),
        total: v.nodes.length,
      }))
    })
    resultados.push({ tema, ruta, violaciones: violacion })
  }
}
await navegador.close()

const total = resultados.reduce((a, r) => a + r.violaciones.length, 0)
const lineas = [
  `axe-core sobre ${RUTAS.length} rutas en tema claro y oscuro, sesion de preview activa`,
  `violaciones: ${total}`,
  '',
]
for (const { tema, ruta, violaciones } of resultados) {
  lineas.push(`${tema} ${ruta}: ${violaciones.length === 0 ? 'sin violaciones' : ''}`)
  for (const v of violaciones) {
    lineas.push(`  [${v.impacto ?? 'sin impacto'}] ${v.id} — ${v.ayuda} (${v.total} nodos)`)
    for (const n of v.nodos) lineas.push(`      ${n.objetivo} :: ${n.resumen ?? ''}`)
  }
}
const salida = process.argv[2]
if (salida) writeFileSync(salida, lineas.join('\n'), 'utf8')
console.log(lineas.join('\n'))
