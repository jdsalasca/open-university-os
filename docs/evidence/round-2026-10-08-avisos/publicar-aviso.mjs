// Publica un aviso sintético en #avisos-admin y comprueba que queda publicado y visible.
// Contenido marcado como sintético en cada campo; si algo falla, falla con el nombre del paso.
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

const BASE = process.env.BASE ?? 'http://localhost:5179'
const MARCA = `sintetico-${Date.now().toString(36)}`
const navegador = await chromium.launchPersistentContext(
  `${process.env.TEMP}/opencode-chrome-profile-aviso-${Date.now()}`,
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

await paso('abrir la consola de avisos', async () => {
  await pagina.goto(`${BASE}/#avisos-admin`, { waitUntil: 'networkidle' })
  await pagina.waitForTimeout(2000)
  const h1 = await pagina.$eval('main h1', (el) => el.textContent.trim()).catch(() => null)
  if (!h1) throw new Error('la consola no pinta su título')
  return `título "${h1.slice(0, 40)}"`
})

await paso('publicar un aviso sintético', async () => {
  // Los campos de fecha son `required`: la validación nativa bloquea el envío si faltan, sin red.
  // Y van en tiempo institucional (America/Bogota, el Clock del backend), no en UTC: con
  // `toISOString()` un aviso creado de noche quedaba con inicio "de mañana" y la lectura pública lo
  // excluía correctamente. Esa fue una falsa alarma de esta misma ronda.
  const titulo = await pagina.$('main input[name="title"]')
  const cuerpo = await pagina.$('main textarea[name="body"]')
  if (!titulo || !cuerpo) throw new Error('no hay formulario de publicación visible con esta sesión')
  await titulo.fill(`Aviso sintético ${MARCA}`)
  await cuerpo.fill(`Contenido sintético de prueba ${MARCA}, sin valor institucional.`)
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const bogota = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }))
  const hoy = fmt(new Date(bogota.getTime() - 864e5))
  const mas30 = fmt(new Date(bogota.getTime() + 30 * 864e5))
  await pagina.fill('main input[name="publishedFrom"]', hoy)
  await pagina.fill('main input[name="publishedThrough"]', mas30)
  await pagina.fill('main input[name="reference"]', `REF-SINTETICA-${MARCA}`)
  const publicar = await pagina.$('main button[type="submit"]')
  if (!publicar) throw new Error('no hay botón de publicar')
  await publicar.click()
  await pagina.waitForTimeout(3000)
  const visible = await pagina.evaluate((m) => document.body.textContent.includes(m), MARCA)
  if (!visible) throw new Error('el aviso no aparece tras publicar')
  return `aviso "${MARCA}" visible tras publicar`
})

await paso('el aviso publicado se lee en la página pública', async () => {
  await pagina.goto(`${BASE}/#avisos`, { waitUntil: 'networkidle' })
  await pagina.waitForTimeout(2000)
  const visible = await pagina.evaluate((m) => document.body.textContent.includes(m), MARCA)
  if (!visible) throw new Error('el aviso publicado no se ve en la página pública')
  return `aviso "${MARCA}" legible en #avisos`
})

await navegador.close()

const mal = pasos.filter((p) => !p.ok)
const lineas = [
  'Publicación de un aviso sintético en #avisos-admin con sesión de preview',
  `Pasos verdes: ${pasos.length - mal.length} de ${pasos.length}`,
  '',
  ...pasos.map((p) => `${p.ok ? 'OK  ' : 'FALLA'} ${p.nombre} :: ${p.detalle}`),
]
const salida = process.argv[2]
if (salida) writeFileSync(salida, lineas.join('\n'), 'utf8')
if (mal.length > 0) process.exitCode = 1
