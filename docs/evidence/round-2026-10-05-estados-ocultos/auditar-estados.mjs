// Segunda pasada de axe-core, abriendo los estados que las once rutas no pintan por defecto.
//
// La ronda anterior dio 0 violaciones en las once rutas, pero eso solo cubre lo que se ve al entrar.
// Quedan 63 candidatos estaticos de find-dark-badges.mjs, y casi todos viven detras de un boton:
// los formularios de alta de #academia empiezan plegados, y el panel de oferta y el historial de
// periodos tambien. Aqui se pulsan todos los controles que esconden contenido y se vuelve a medir.
//
//   PLAYWRIGHT_CORE=<ruta>  AXE_PATH=<axe.min.js>  CHROMIUM=<chrome.exe>
//   node docs/evidence/round-2026-10-05-estados-ocultos/auditar-estados.mjs salida.txt
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)
const axeSource = readFileSync(process.env.AXE_PATH, 'utf8')

const BASE = process.env.BASE ?? 'http://localhost:5173'

// El token vive solo en memoria en el navegador, por diseño. Se captura de la respuesta del POST
// para revocar la sesión al terminar y no agotar el cupo del backend.
let tokenSesion = null
const RUTAS = [
  ['#resumen', 'Tu universidad'],
  ['#inicio', 'Centro de identidad visual'],
  ['#estudiantes', 'Servicios para acompañar'],
  ['#biblioteca', 'Biblioteca'],
  ['#avisos', 'Mis avisos'],
  ['#avisos-admin', 'Administrar avisos'],
  ['#programas', 'Mallas curriculares'],
  ['#academia', 'Estructura y periodos'],
  ['#admisiones', 'Pregrado presencial'],
  ['#espacios', 'espacios'],
  ['#accesos', 'Accesos'],
]

const navegador = await chromium.launchPersistentContext(
  `${process.env.TEMP}/opencode-chrome-profile-estados-2026-10-06`,
  { executablePath: process.env.CHROMIUM, headless: true, viewport: { width: 1280, height: 1000 } },
)
const pagina = await navegador.newPage()

pagina.on('response', async (respuesta) => {
  if (!respuesta.url().includes('/api/v1/dev/local-preview-session') || respuesta.request().method() !== 'POST') return
  try {
    tokenSesion = (await respuesta.json()).accessToken ?? null
  } catch {
    tokenSesion = null
  }
})

const correrAxe = () => pagina.evaluate(async () => {
  // eslint-disable-next-line no-undef
  const resultado = await window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
  })
  return resultado.violations.map((v) => ({
    id: v.id,
    impacto: v.impact,
    nodos: v.nodes.slice(0, 8).map((n) => ({
      objetivo: n.target.join(' '),
      resumen: (n.failureSummary ?? '').split('\n')[1]?.trim(),
    })),
    total: v.nodes.length,
  }))
})

// Pulsa todos los controles que esconden contenido y comprueba si sigue Having.
// aria-expanded es la senal de "hay algo detras"; details/summary cubre el resto.
const abrirTodo = () => pagina.evaluate(async () => {
  const dormidos = [...document.querySelectorAll('[aria-expanded="false"], details:not([open])')]
  for (const control of dormidos) {
    control.setAttribute('aria-expanded', 'true')
    if (control.tagName === 'DETAILS') control.setAttribute('open', '')
    else control.click()
  }
  return dormidos.length
})

const resultados = []
for (const tema of ['light', 'dark']) {
  await pagina.goto(`${BASE}/#resumen`, { waitUntil: 'networkidle' })
  await pagina.waitForTimeout(2500)
  // Misma lección que en auditar-axe.mjs: esperar al botón de verdad y comprobar la sesión, o la
  // auditoría mide la portada. Y revocar al terminar para no agotar el cupo del backend.
  const boton = await pagina
    .waitForSelector('text=Entrar al preview local', { timeout: 25000 })
    .catch(() => null)
  if (boton) {
    await boton.click()
    await pagina.waitForSelector('text=Desarrollador local · preview', { timeout: 25000 }).catch(() => {})
    await pagina.waitForTimeout(1500)
  }
  const conSesion = await pagina.evaluate(() => document.body.textContent.includes('Desarrollador local · preview'))
  if (!conSesion) throw new Error('no se pudo emitir la sesion de preview')

  for (const [ruta, texto] of RUTAS) {
    await pagina.goto(`${BASE}/${ruta}`, { waitUntil: 'networkidle' })
    await pagina.evaluate((valor) => document.documentElement.setAttribute('data-theme', valor), tema)
    // Esperar el contenido propio de la ruta y no un tiempo fijo: con el host saturado el chunk
    // perezoso tarda, y medir el esqueleto reporta "sin h1" en páginas que sí lo tienen.
    const listo = await pagina
      .waitForFunction((t) => document.body.textContent.includes(t), texto, { timeout: 20000 })
      .then(() => true)
      .catch(() => false)
    if (!listo) throw new Error(`la ruta ${ruta} no llegó a pintar "${texto}" en 20 s`)

    const abiertos = await abrirTodo()
    await pagina.waitForTimeout(900)
    await pagina.addScriptTag({ content: axeSource })
    const violaciones = await correrAxe()
    resultados.push({ tema, ruta, abiertos, violaciones })
  }
}
await navegador.close()

// Sin esto el cupo de sesiones del backend se agota y las siguientes auditorías miden la portada en
// vez de la ruta.
if (tokenSesion) {
  await fetch(`${BASE}/api/v1/dev/local-preview-session`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenSesion}` },
  })
}

const total = resultados.reduce((a, r) => a + r.violaciones.reduce((s, v) => s + v.total, 0), 0)
const lineas = [
  `axe-core con los estados plegados abiertos: ${RUTAS.length} rutas en claro y oscuro`,
  `nodos en violacion: ${total}`,
  '',
]
for (const { tema, ruta, abiertos, violaciones } of resultados) {
  lineas.push(`${tema} ${ruta}: ${abiertos} controles abiertos, ${violaciones.reduce((s, v) => s + v.total, 0)} nodos`)
  for (const v of violaciones) {
    lineas.push(`  [${v.impacto ?? 'sin impacto'}] ${v.id} (${v.total} nodos)`)
    for (const n of v.nodos) lineas.push(`      ${n.objetivo} :: ${n.resumen ?? ''}`)
  }
}
const salida = process.argv[2]
if (salida) writeFileSync(salida, lineas.join('\n'), 'utf8')
console.log(lineas.slice(0, 2).join('\n'))
