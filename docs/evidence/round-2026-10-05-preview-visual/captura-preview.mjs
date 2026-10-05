// Captura de la portada con sesion de preview local, usando un perfil de navegador propio
// para no interferir con las otras sesiones del equipo. Verifica que la consola de roles
// ya no aparezca tras restricting la allowlist del preview local.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

const SALIDA = process.env.SALIDA
const BASE = 'http://localhost:5173'
const PERFIL = join(process.env.TEMP, 'opencode-chrome-profile-preview')

mkdirSync(SALIDA, { recursive: true })

const navegador = await chromium.launchPersistentContext(PERFIL, {
  executablePath: process.env.CHROMIUM,
  headless: true,
  viewport: { width: 1440, height: 900 },
  locale: 'es-CO',
  args: ['--disable-dev-shm-usage', '--no-first-run'],
})

const problemas = []
const pagina = await navegador.newPage()
pagina.on('console', (m) => { if (m.type() === 'error') problemas.push(`consola: ${m.text()}`) })
pagina.on('pageerror', (e) => problemas.push(`excepcion: ${e.message}`))

const esperarTexto = (texto, ms = 15000) =>
  pagina.waitForSelector(`text=${texto}`, { timeout: ms }).then(() => true).catch(() => false)

await pagina.goto(`${BASE}/#resumen`, { waitUntil: 'domcontentloaded' })
await pagina.waitForTimeout(2500)
await pagina.screenshot({ path: join(SALIDA, '01-portada-sin-sesion.png'), fullPage: true })

// El boton de preview local solo existe en Vite DEV con OIDC sin configurar.
const entro = await esperarTexto('Entrar al preview local')
await pagina.screenshot({ path: join(SALIDA, '02-boton-preview.png'), fullPage: true })

if (!entro) {
  problemas.push('no se encontro el boton de entrada al preview local')
} else {
  await pagina.click('text=Entrar al preview local')
  const listo = await esperarTexto('Desarrollador local', 20000)
  if (!listo) problemas.push('la sesion de preview local no quedo visible')
  await pagina.waitForTimeout(2000)
  await pagina.screenshot({ path: join(SALIDA, '03-portada-con-preview.png'), fullPage: true })

  const cuerpo = await pagina.innerText('body')
  const mencionaRoles = /rol|perfil de acceso|identidad y permisos/i.test(cuerpo)
  console.log(`la portada menciona roles o perfiles: ${mencionaRoles}`)

  for (const [nombre, ruta] of [['04-academia.png', '#academia'], ['05-branding.png', '#inicio']]) {
    await pagina.goto(`${BASE}/${ruta}`, { waitUntil: 'domcontentloaded' })
    await pagina.waitForTimeout(3000)
    await pagina.screenshot({ path: join(SALIDA, nombre), fullPage: true })
  }

  const consola = await pagina.evaluate(() => document.body.innerText)
  console.log(`--- roles visibles en #inicio: ${/gesti[oó]n de roles|perfiles de rol|asignar rol/i.test(consola)}`)
}

console.log(`problemas: ${problemas.length}`)
problemas.forEach((p) => console.log(`  - ${p}`))

await navegador.close()
