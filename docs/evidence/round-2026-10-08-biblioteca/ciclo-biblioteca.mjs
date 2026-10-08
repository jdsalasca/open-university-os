// Ciclo de biblioteca de punta a punta con sesión de preview: registrar título, elegirlo en el
// catálogo, registrar un ejemplar con código de barras sintético y recuperarlo por ese código.
// Todo el contenido va marcado como sintético. La sesión se revoca al terminar.
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

const BASE = process.env.BASE ?? 'http://localhost:5179'
const MARCA = `sintetico-${Date.now().toString(36)}`
const CODIGO = `SINT-${Date.now().toString(36).toUpperCase()}`

const navegador = await chromium.launchPersistentContext(
  `${process.env.TEMP}/opencode-chrome-profile-biblio-ciclo-${Date.now()}`,
  { executablePath: process.env.CHROMIUM, headless: true, viewport: { width: 1280, height: 900 } },
)
const pagina = await navegador.newPage()

let tokenSesion = null
pagina.on('response', async (respuesta) => {
  if (!respuesta.url().includes('/api/v1/dev/local-preview-session') || respuesta.request().method() !== 'POST') return
  try {
    tokenSesion = (await respuesta.json()).accessToken ?? null
  } catch {
    tokenSesion = null
  }
})

await pagina.goto(`${BASE}/#resumen`, { waitUntil: 'networkidle' })
await pagina.waitForTimeout(2500)
const boton = await pagina.waitForSelector('text=Entrar al preview local', { timeout: 25000 }).catch(() => null)
if (boton) {
  await boton.click()
  await pagina.waitForSelector('text=Desarrollador local · preview', { timeout: 25000 }).catch(() => {})
  await pagina.waitForTimeout(1500)
}
const conSesion = await pagina.evaluate(() => document.body.textContent.includes('Desarrollador local · preview'))
if (!conSesion) throw new Error('sin sesión de preview')

const pasos = []
const paso = async (nombre, fn) => {
  try {
    const detalle = await fn()
    pasos.push({ nombre, ok: true, detalle })
    console.log(`OK   ${nombre} :: ${detalle}`)
  } catch (e) {
    pasos.push({ nombre, ok: false, detalle: String(e.message ?? e).slice(0, 160) })
    console.log(`FALLA ${nombre} :: ${String(e.message ?? e).slice(0, 160)}`)
  }
}

await pagina.goto(`${BASE}/#biblioteca`, { waitUntil: 'networkidle' })
await pagina.waitForTimeout(2500)

await paso('registrar un título sintético', async () => {
  const form = await pagina.$('form:has(input[name="title"])')
  if (!form) throw new Error('no se ve el formulario de título')
  await pagina.fill('form:has(input[name="title"]) input[name="title"]', `Título sintético ${MARCA}`)
  await pagina.fill('form:has(input[name="title"]) input[name="author"]', 'Autora Sintética')
  await pagina.fill('form:has(input[name="title"]) input[name="edition"]', '1')
  await pagina.fill('form:has(input[name="title"]) input[name="reference"]', `REF-${MARCA}`)
  await pagina.click('form:has(input[name="title"]) button[type="submit"]')
  await pagina.waitForTimeout(2500)
  const visible = await pagina.evaluate((m) => document.body.textContent.includes(m), `Título sintético ${MARCA}`)
  if (!visible) throw new Error('el título no aparece tras registrarlo')
  return 'título visible en el catálogo'
})

await paso('registrar un ejemplar del título', async () => {
  const opciones = await pagina.$$eval('select[aria-label="Seleccionar título"] option',
    (els) => els.map((e) => ({ valor: e.value, texto: e.textContent.trim() })))
  const mio = opciones.find((o) => o.texto.includes(MARCA))
  if (!mio) throw new Error(`el título no está en el selector (${opciones.length} opciones)`)
  await pagina.selectOption('select[aria-label="Seleccionar título"]', mio.valor)
  await pagina.waitForTimeout(2000)
  const form = await pagina.$('form:has(input[name="barcode"])')
  if (!form) throw new Error('no apareció el formulario de ejemplar al elegir el título')
  await pagina.fill('form:has(input[name="barcode"]) input[name="barcode"]', CODIGO)
  const ubicacion = await pagina.$('form:has(input[name="barcode"]) input[name="location"]')
  if (ubicacion) await ubicacion.fill('Estante sintético')
  const ref = await pagina.$('form:has(input[name="barcode"]) input[name="reference"]')
  if (ref) await ref.fill(`REF-${MARCA}`)
  await pagina.click('form:has(input[name="barcode"]) button[type="submit"]')
  await pagina.waitForTimeout(2500)
  const visible = await pagina.evaluate((c) => document.body.textContent.includes(c), CODIGO)
  if (!visible) throw new Error('el código de barras no aparece tras registrar el ejemplar')
  return `ejemplar ${CODIGO} visible en la lista`
})

await paso('recuperar el ejemplar por su código de barras', async () => {
  const buscador = await pagina.$('form:has-text("Buscar ejemplar") input, input[aria-label*="arras" i]')
  const campo = buscador ?? await pagina.$('main input:not([name="title"]):not([name="author"]):not([name="edition"]):not([name="reference"]):not([name="barcode"]):not([name="location"])')
  if (!campo) throw new Error('no se encontró el buscador de ejemplares')
  await campo.fill(CODIGO)
  const buscar = await pagina.$('form:has-text("Buscar ejemplar") button[type="submit"], form:has-text("Buscar ejemplar") button')
  if (buscar) await buscar.click()
  await pagina.waitForTimeout(2500)
  const visible = await pagina.evaluate((c) => document.body.textContent.includes(c), CODIGO)
  if (!visible) throw new Error('el ejemplar no se recupera por su código')
  return `ejemplar ${CODIGO} recuperado por búsqueda`
})

await navegador.close()
if (tokenSesion) {
  await fetch(`${BASE}/api/v1/dev/local-preview-session`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenSesion}` },
  })
}

const mal = pasos.filter((p) => !p.ok)
const lineas = [
  'Ciclo de biblioteca con sesión de preview: título, ejemplar y búsqueda por código',
  `Pasos verdes: ${pasos.length - mal.length} de ${pasos.length}`,
  '',
  ...pasos.map((p) => `${p.ok ? 'OK  ' : 'FALLA'} ${p.nombre} :: ${p.detalle}`),
]
const salida = process.argv[2]
if (salida) writeFileSync(salida, lineas.join('\n'), 'utf8')
if (mal.length > 0) process.exitCode = 1
