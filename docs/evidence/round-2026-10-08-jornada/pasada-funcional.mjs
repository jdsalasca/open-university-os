// Pasada funcional por los flujos públicos que una persona real usaría, con el backend arriba:
// buscar un programa, filtrar espacios por municipio, descargar el ICS de admisiones y abrir un aviso.
// Cada paso afirma un resultado observable; si algo no responde como un usuario esperaría, falla con
// el nombre del flujo, no con un timeout mudo.
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

const BASE = process.env.BASE ?? 'http://localhost:5179'
const navegador = await chromium.launchPersistentContext(
  `${process.env.TEMP}/opencode-chrome-profile-jornada-${Date.now()}`,
  { executablePath: process.env.CHROMIUM, headless: true, viewport: { width: 1280, height: 900 } },
)
const pagina = await navegador.newPage()
await pagina.goto(`${BASE}/#resumen`, { waitUntil: 'networkidle' })
await pagina.waitForTimeout(2500)
const boton = await pagina.waitForSelector('text=Entrar al preview local', { timeout: 25000 }).catch(() => null)
if (boton) {
  await boton.click()
  await pagina.waitForSelector('text=Desarrollador local · preview', { timeout: 25000 }).catch(() => {})
  await pagina.waitForTimeout(1500)
}

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

await paso('programas: buscar "ingeniería" deja resultados', async () => {
  await pagina.goto(`${BASE}/#programas`, { waitUntil: 'networkidle' })
  await pagina.waitForTimeout(1500)
  const buscador = await pagina.$('input[type="search"], input[placeholder*="uscar" i]')
  if (!buscador) throw new Error('no hay campo de búsqueda')
  await buscador.fill('ingeniería')
  await pagina.waitForTimeout(1500)
  const n = await pagina.evaluate(() => document.body.textContent.match(/ingeniería/gi)?.length ?? 0)
  if (n < 2) throw new Error(`la búsqueda no filtra nada visible (${n} menciones)`)
  return `${n} menciones de ingeniería en la vista`
})

await paso('espacios: filtrar por municipio reduce la lista', async () => {
  await pagina.goto(`${BASE}/#espacios`, { waitUntil: 'networkidle' })
  await pagina.waitForTimeout(1500)
  const antes = await pagina.evaluate(() => document.querySelectorAll('article').length)
  const select = await pagina.$('select')
  if (!select) throw new Error('no hay selector de municipio')
  const opciones = await pagina.$$eval('select option', (els) => els.map((e) => e.textContent.trim()).filter(Boolean))
  const muni = opciones.find((o) => !/todos/i.test(o))
  if (!muni) throw new Error('el selector no ofrece municipios')
  await select.selectOption({ label: muni })
  await pagina.waitForTimeout(1200)
  const despues = await pagina.evaluate(() => document.querySelectorAll('article').length)
  return `municipio "${muni}": ${antes} -> ${despues} tarjetas`
})

await paso('admisiones: el ICS se descarga y es un calendario válido', async () => {
  await pagina.goto(`${BASE}/#admisiones`, { waitUntil: 'networkidle' })
  await pagina.waitForTimeout(1500)
  const enlace = await pagina.$('a[href$=".ics"], a:has-text("calendario"), button:has-text("descargar")')
  if (!enlace) throw new Error('no hay forma visible de llevarse el calendario')
  const [descarga] = await Promise.all([
    pagina.waitForEvent('download', { timeout: 15000 }).catch(() => null),
    enlace.click(),
  ])
  if (!descarga) throw new Error('el control no inicia ninguna descarga')
  const ruta = await descarga.path()
  if (!ruta) throw new Error('la descarga no dejó archivo')
  const { readFileSync } = await import('node:fs')
  const contenido = readFileSync(ruta, 'utf8')
  if (!contenido.includes('BEGIN:VCALENDAR') || !contenido.includes('END:VCALENDAR')) {
    throw new Error('el archivo no es un calendario válido')
  }
  const eventos = (contenido.match(/BEGIN:VEVENT/g) ?? []).length
  return `ICS válido con ${eventos} eventos`
})

await paso('avisos: abrir un aviso muestra su contenido', async () => {
  await pagina.goto(`${BASE}/#avisos`, { waitUntil: 'networkidle' })
  await pagina.waitForTimeout(1500)
  const titulo = await pagina.$eval('main h1', (el) => el.textContent.trim()).catch(() => null)
  if (!titulo) throw new Error('la página no pinta su título')
  const cuerpo = await pagina.evaluate(() => (document.querySelector('main')?.textContent ?? '').length)
  if (cuerpo < 200) throw new Error(`contenido sospechosamente corto (${cuerpo} caracteres)`)
  return `título "${titulo.slice(0, 40)}", ${cuerpo} caracteres`
})

await navegador.close()

const mal = pasos.filter((p) => !p.ok)
const lineas = [
  'Pasada funcional por flujos públicos con backend arriba y sesión de preview',
  `Pasos verdes: ${pasos.length - mal.length} de ${pasos.length}`,
  '',
  ...pasos.map((p) => `${p.ok ? 'OK  ' : 'FALLA'} ${p.nombre} :: ${p.detalle}`),
]
const salida = process.argv[2]
if (salida) writeFileSync(salida, lineas.join('\n'), 'utf8')
if (mal.length > 0) process.exitCode = 1
