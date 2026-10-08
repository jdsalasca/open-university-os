// Alta de un lugar raíz con referencia DEMO- en #academia y comprobación de las tres vistas:
// aparece en la línea administrativa, genera auditoría y NO aparece en el árbol público.
// La convención DEMO- es el mecanismo del propio dominio para datos sintéticos, no un truco del test.
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

const BASE = process.env.BASE ?? 'http://localhost:5179'
const API = process.env.API ?? 'http://localhost:8081'
const MARCA = `demo-sitio-${Date.now().toString(36)}`
const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const bogota = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }))
const DESDE = fmt(new Date(bogota.getTime() - 864e5))

const navegador = await chromium.launchPersistentContext(
  `${process.env.TEMP}/opencode-chrome-profile-acad-ciclo-${Date.now()}`,
  { executablePath: process.env.CHROMIUM, headless: true, viewport: { width: 1280, height: 900 } },
)
const pagina = await navegador.newPage()

let tokenSesion = null
const peticionesApi = []
pagina.on('response', async (respuesta) => {
  if (respuesta.url().includes('/api/v1/dev/local-preview-session') && respuesta.request().method() === 'POST') {
    try {
      tokenSesion = (await respuesta.json()).accessToken ?? null
    } catch {
      tokenSesion = null
    }
    return
  }
  if (respuesta.url().includes('/api/v1/')) {
    let cuerpo = ''
    try {
      cuerpo = (await respuesta.text()).slice(0, 200)
    } catch {
      cuerpo = '(sin cuerpo)'
    }
    peticionesApi.push(`${respuesta.status()} ${respuesta.request().method()} ${respuesta.url().split('/api/v1/')[1]} :: ${cuerpo}`)
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

await pagina.goto(`${BASE}/#academia`, { waitUntil: 'networkidle' })
await pagina.waitForTimeout(2500)
await pagina.click('main button:has-text("Crear lugar")')
await pagina.waitForTimeout(1000)

await paso('crear el lugar raíz con referencia DEMO-', async () => {
  const form = 'form:has(button:has-text("Crear lugar"))'
  const campos = await pagina.$$(`${form} input, ${form} select`)
  if (campos.length < 7) throw new Error(`el formulario no trae los 7 campos (${campos.length})`)
  // Todos los selectores van con ámbito al formulario del lugar: #academia tiene varios formularios
  // con etiquetas parecidas ("Referencia institucional" aparece en afiliaciones y cierres) y sin
  // ámbito se rellena el primero de la página en vez del correcto.
  await pagina.fill(`${form} label:has-text("Código del lugar") input`, MARCA)
  await pagina.selectOption(`${form} label:has-text("Tipo de lugar") select`, 'CAMPUS')
  await pagina.fill(`${form} label:has-text("Nombre del lugar") input`, `Sitio sintético ${MARCA}`)
  await pagina.fill(`${form} label:has-text("Vigente desde") input`, DESDE)
  await pagina.fill(`${form} label:has-text("Referencia institucional") input`, `DEMO-${MARCA}`)
  await pagina.click(`${form} button[type="submit"]`)
  await pagina.waitForTimeout(3000)
  const visible = await pagina.evaluate((m) => document.body.textContent.includes(m), MARCA)
  if (!visible) {
    const estado = await pagina.evaluate(() => {
      const f = [...document.querySelectorAll('main form')].find((x) => /crear lugar/i.test(x.textContent))
      if (!f) return 'sin formulario'
      const mal = [...f.querySelectorAll('input, select, textarea')]
        .filter((el) => !el.checkValidity())
        .map((el) => {
          const lab = (el.closest('label')?.textContent ?? '').trim().slice(0, 25)
          return `${el.tagName}[${lab}] "${el.validationMessage}" valor="${el.value}"`
        })
      return `valido=${f.checkValidity()} :: ${mal.join(' | ') || 'todo válido, el submit no disparó'}`
    })
    const relacionadas = peticionesApi.filter((p) => !p.includes('/me')).slice(-6).join(' | ')
    throw new Error(`el lugar no aparece. ${estado}. Red: ${relacionadas || 'sin peticiones'}`)
  }
  return `lugar ${MARCA} visible en la consola`
})

await paso('el árbol público excluye la referencia DEMO-', async () => {
  const r = await fetch(`${API}/api/v1/academic-structure`)
  const texto = await r.text()
  if (texto.includes(MARCA)) throw new Error('el árbol público muestra la referencia DEMO-')
  return 'árbol público limpio de la referencia sintética'
})

await paso('la auditoría registra el alta', async () => {
  if (!tokenSesion) throw new Error('sin token para consultar la bitácora')
  const r = await fetch(`${API}/api/v1/admin/academic-structure/audit-events?limit=50`, {
    headers: { Authorization: `Bearer ${tokenSesion}` },
  })
  const cuerpo = await r.text()
  if (!cuerpo.includes(MARCA) && !cuerpo.includes('SITE_CREATED')) {
    throw new Error('la bitácora no muestra el alta')
  }
  return 'bitácora con el evento de alta'
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
  'Alta de lugar raíz con referencia DEMO- en #academia: consola, árbol público y auditoría',
  `Pasos verdes: ${pasos.length - mal.length} de ${pasos.length}`,
  '',
  ...pasos.map((p) => `${p.ok ? 'OK  ' : 'FALLA'} ${p.nombre} :: ${p.detalle}`),
]
const salida = process.argv[2]
if (salida) writeFileSync(salida, lineas.join('\n'), 'utf8')
if (mal.length > 0) process.exitCode = 1
