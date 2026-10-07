import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

const BASE = process.env.BASE ?? 'http://localhost:5179'
const navegador = await chromium.launchPersistentContext(
  `${process.env.TEMP}/opencode-chrome-profile-css-${process.env.PERFIL ?? 'a'}`,
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
await pagina.goto(`${BASE}/#admisiones`, { waitUntil: 'networkidle' })
await pagina.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
await pagina.waitForTimeout(800)
const info = await pagina.evaluate(() => {
  const nodo = document.querySelector('.admissions-source-note')
  if (!nodo) return { presente: false }
  const estilo = getComputedStyle(nodo)
  // Para cada ancestro: su color declarado y las custom props que el aviso consume.
  const cadena = []
  for (let actual = nodo; actual && actual !== document.documentElement; actual = actual.parentElement) {
    const e = getComputedStyle(actual)
    cadena.push({
      etiqueta: `${actual.tagName.toLowerCase()}.${String(actual.className).split(' ')[0]}`.slice(0, 60),
      color: e.color,
      brandText: e.getPropertyValue('--brand-text').trim() || null,
      brandSurface: e.getPropertyValue('--brand-surface').trim() || null,
    })
    if (cadena.length > 7) break
  }
  return {
    presente: true,
    computado: { color: estilo.color, fondo: estilo.backgroundColor },
    cadena,
  }
})
console.log(JSON.stringify(info, null, 1))
await navegador.close()
