// Publica una convocatoria sintética en #admisiones y comprueba que se lee en la vista pública.
// Todo el contenido va marcado como sintético; las URL apuntan al portal genérico sin afirmar nada.
// La sesión se revoca al terminar.
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

const BASE = process.env.BASE ?? 'http://localhost:5179'
const API = process.env.API ?? 'http://localhost:8081'
const MARCA = `sintetica-${Date.now().toString(36)}`
const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const bogota = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }))
const HOY = fmt(new Date(bogota.getTime() - 864e5))
const MAS30 = fmt(new Date(bogota.getTime() + 30 * 864e5))

const navegador = await chromium.launchPersistentContext(
  `${process.env.TEMP}/opencode-chrome-profile-adm-ciclo-${Date.now()}`,
  { executablePath: process.env.CHROMIUM, headless: true, viewport: { width: 1280, height: 900 } },
)
const pagina = await navegador.newPage()
pagina.on('dialog', (d) => d.accept())

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

await pagina.goto(`${BASE}/#admisiones`, { waitUntil: 'networkidle' })
await pagina.waitForTimeout(2500)
await pagina.click('main button:has-text("Nueva convocatoria")')
await pagina.waitForTimeout(1200)

await paso('guardar el borrador de la convocatoria sintética', async () => {
  await pagina.fill('#admissions-call-key', `sintetica-${MARCA}`)
  await pagina.fill('#admissions-call-title', `Convocatoria sintética ${MARCA}`)
  await pagina.fill('#admissions-call-name', `Sintética ${MARCA}`)
  await pagina.fill('#admissions-call-updated', HOY)
  await pagina.fill('#admissions-call-checked', HOY)
  await pagina.fill('#admissions-source-label', 'Portal sintético de prueba')
  await pagina.fill('#admissions-source-url', 'https://www.uptc.edu.co/')
  await pagina.fill('#admissions-confirmation-label', 'Confirmación sintética')
  await pagina.fill('#admissions-confirmation-url', 'https://www.uptc.edu.co/')
  await pagina.fill('#admissions-milestone-key-0', `hito-${MARCA}`)
  await pagina.selectOption('#admissions-milestone-kind-0', 'APPLICATION')
  await pagina.fill('#admissions-milestone-start-0', HOY)
  await pagina.fill('#admissions-milestone-end-0', MAS30)
  await pagina.fill('#admissions-milestone-title-0', `Inscripción sintética ${MARCA}`)
  await pagina.fill('#admissions-milestone-description-0', 'Hito sintético sin valor institucional')
  await pagina.click('main form[aria-label="Editar convocatoria"] button:has-text("Guardar borrador")')
  await pagina.waitForTimeout(3000)
  const visible = await pagina.evaluate((m) => document.body.textContent.includes(m), MARCA)
  if (!visible) throw new Error('el borrador no aparece tras guardarlo')
  return 'borrador visible en la consola'
})

await paso('publicar la convocatoria con referencia oficial', async () => {
  await pagina.fill('#admissions-publication-reference', `REF-SINTETICA-${MARCA}`)
  const publicar = await pagina.$('main button:has-text("Publicar")')
  if (!publicar) throw new Error('no hay botón de publicar tras guardar el borrador')
  await publicar.click()
  await pagina.waitForTimeout(3000)
  const estado = await pagina.evaluate((m) => ({
    marca: document.body.textContent.includes(m),
    publicada: /publicad/i.test(document.body.textContent),
  }), MARCA)
  if (!estado.marca) throw new Error('la convocatoria no aparece tras publicar')
  return `convocatoria visible; estado publicado: ${estado.publicada}`
})

await paso('la convocatoria publicada se lee en la vista pública', async () => {
  const r = await fetch(`${API}/api/v1/admissions/calls`)
  const cuerpo = await r.text()
  if (!cuerpo.includes(MARCA)) throw new Error('la API pública no devuelve la convocatoria')
  return 'API pública devuelve la convocatoria sintética'
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
  'Publicación de convocatoria sintética en #admisiones: borrador, publicación y lectura pública',
  `Pasos verdes: ${pasos.length - mal.length} de ${pasos.length}`,
  '',
  ...pasos.map((p) => `${p.ok ? 'OK  ' : 'FALLA'} ${p.nombre} :: ${p.detalle}`),
]
const salida = process.argv[2]
if (salida) writeFileSync(salida, lineas.join('\n'), 'utf8')
if (mal.length > 0) process.exitCode = 1
