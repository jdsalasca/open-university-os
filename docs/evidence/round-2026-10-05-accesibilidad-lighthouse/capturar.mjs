// Capturas de los estados que la ronda de axe-core corrigio, en tema oscuro y con la sesion de
// preview activa. Sirven para comprobar a ojo que el texto se lee y no solo que el DOM lo declara.
//
//   PLAYWRIGHT_CORE=<ruta a playwright-core>  CHROMIUM=<chrome.exe>
//   node docs/evidence/round-2026-10-05-accesibilidad-lighthouse/capturar.mjs
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

const BASE = process.env.BASE ?? 'http://localhost:5173'
const SALIDA = new URL('./', import.meta.url).pathname.replace(/^\//, '')

const navegador = await chromium.launchPersistentContext(
  `${process.env.TEMP}/opencode-chrome-profile-axe-2026-10-05`,
  { executablePath: process.env.CHROMIUM, headless: true, viewport: { width: 1280, height: 900 } },
)
const pagina = await navegador.newPage()

await pagina.goto(`${BASE}/#resumen`, { waitUntil: 'networkidle' })
await pagina.waitForTimeout(2500)
const boton = await pagina.$('text=Entrar al preview local')
if (boton) {
  await boton.click()
  await pagina.waitForSelector('text=Desarrollador local', { timeout: 20000 }).catch(() => {})
  await pagina.waitForTimeout(1500)
}

// Los tres estados que la auditoria dio por ilegibles, mas la pagina que no tenia <h1>.
const CAPTURAS = [
  ['#academia', 'academia-dark-alta-facultad.png', 'Facultad raiz'],
  ['#accesos', 'accesos-dark-bloqueado.png', 'Accesos y perfiles'],
  ['#biblioteca', 'biblioteca-dark-encabezados.png', 'Biblioteca'],
  ['#inicio', 'inicio-dark-preview.png', 'Centro de identidad visual'],
]

for (const [ruta, archivo, texto] of CAPTURAS) {
  await pagina.goto(`${BASE}/${ruta}`, { waitUntil: 'networkidle' })
  await pagina.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  await pagina.waitForTimeout(1200)
  const destino = await pagina.$(`text=${texto}`)
  if (destino) await destino.scrollIntoViewIfNeeded().catch(() => {})
  await pagina.waitForTimeout(400)
  await pagina.screenshot({ path: `${SALIDA}${archivo}` })
  console.log(`captura ${archivo} en ${ruta}`)
}
await navegador.close()
