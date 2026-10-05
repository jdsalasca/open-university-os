import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

// AGENTS.md exige estados de carga, error y vacio en todas las pantallas, y que al perder
// autenticacion React revalide `/api/v1/me`. Ninguna ronda lo ha comprobado de verdad: todas
// midieron con el backend sano.
//
// Aqui se corta el backend con el navegador ya abierto y se mira que muestra cada ruta. Un estado
// de error honesto dice que no se pudo conectar y ofrece reintentar; uno deficient se queda en
// blanco, en un spinner eterno, o muestra un error de red crudo.
const RUTAS = ['#resumen', '#estudiantes', '#biblioteca', '#avisos', '#programas', '#inicio', '#academia', '#admisiones', '#espacios', '#accesos']

const navegador = await chromium.launchPersistentContext(
  join(process.env.TEMP, 'opencode-chrome-profile-resiliencia-' + Date.now()),
  { executablePath: process.env.CHROMIUM, headless: true, viewport: { width: 1440, height: 900 } },
)
const pagina = await navegador.newPage()
await pagina.goto('http://localhost:5199/#resumen', { waitUntil: 'networkidle' })
await pagina.waitForTimeout(3000)
await pagina.waitForSelector('text=Entrar al preview local', { timeout: 20000 })
await pagina.click('text=Entrar al preview local')
await pagina.waitForSelector('text=Salir del preview local', { timeout: 20000 })

const SECCION = process.env.SECCION ?? 'sin-backend'
const lineas = [`Estado de cada ruta ${SECCION}`, '']

if (SECCION === 'sin-backend') {
  // Se corta el backend DESPUES de abrir la sesion, para que la UI tenga que trabajar con la API caida.
  const { spawnSync } = await import('node:child_process')
  const stopped = spawnSync('docker', ['compose', 'stop', 'backend'], { encoding: 'utf8', timeout: 90_000 })
  lineas.push(`docker compose stop backend: ${stopped.status === 0 ? 'ok' : stopped.stderr}`)
  lineas.push('')
  await pagina.waitForTimeout(1500)
}

for (const ruta of RUTAS) {
  await pagina.goto(`http://localhost:5199/${ruta}`, { waitUntil: 'domcontentloaded' })
  await pagina.waitForTimeout(3500)
  const info = await pagina.evaluate(() => {
    const main = document.querySelector('main') || document.body
    const texto = (main.innerText || '').replace(/\s+/g, ' ').trim()
    return {
      largo: texto.length,
      // Un estado de error honesto lo dice: no se pudo, reintenta, sin conexion.
      diceError: /no se pudo|no pudimos|reintent|sin conexi|no responde|error|fallo/i.test(texto),
      tieneBoton: Boolean(main.querySelector('button')),
      spinner: Boolean(document.querySelector('[aria-busy="true"], .spinner, [class*="loading"]')),
      // Un spinner eterno con poco texto suele ser la senal de que la vista no sabe que fallo.
      muestraCargando: /cargando|loading/i.test(texto),
      muestraVacio: /no hay|sin |aun no|no .{0,30}publicad/i.test(texto),
      muestraErrorDeRed: /Failed to fetch|NetworkError|ERR_CONNECTION|load failed/i.test(texto),
      muestraRawJson: /\{"[a-z]+":|status":\s*\d/i.test(texto),
      muestraVacioBruto: texto.length < 40,
      extracto: texto.slice(0, 160),
    }
  })
  const problemas = []
  if (info.muestraCargando) problemas.push('dice cargando sin resolver')
  if (info.muestraErrorDeRed) problemas.push('muestra error de red crudo')
  if (info.muestraRawJson) problemas.push('muestra JSON crudo')
  if (info.muestraVacioBruto) problemas.push('vista casi vacia')
  if (info.spinner && problemas.length === 0) problemas.push('spinner presente')
  lineas.push(`--- ${ruta}: ${info.largo} caracteres | ${problemas.length ? problemas.join('; ') : 'ok'}`)
  lineas.push(`    "${info.extracto}"`)
}

if (SECCION === 'sin-backend') {
  const { spawnSync } = await import('node:child_process')
  spawnSync('docker', ['compose', 'start', 'backend'], { encoding: 'utf8', timeout: 120_000 })
  lineas.push('')
  lineas.push('backend arrancado de nuevo')
}

writeFileSync(join(process.env.SALIDA, `estado-${SECCION}.txt`), lineas.join('\n'), 'utf8')
console.log(lineas.filter((l) => l.startsWith('---')).join('\n'))
await navegador.close()
