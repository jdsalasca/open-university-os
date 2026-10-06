// Al cambiar de ruta por el menu lateral o por un enlace interno, el foco se queda en el elemento
// que se pulso. Para quien navega con teclado o con lector de pantalla eso significa que el siguiente
// Tab sigue recorriendo el menu, no el contenido nuevo: la persona no sabe donde esta.
//
// Este script comprueba, para cada ruta, si el foco aterriza en el contenido principal tras navegar.
//
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE)

const BASE = process.env.BASE ?? 'http://localhost:5173'
// Se localizan por nombre visible y no por `href`: algunos enlaces del menu solo existen cuando hay
// sesion o un permiso concreto, y un selector por hash los daria por ausentes en vez de por no
// aplicables.
const ENLACES = [
  ['Resumen', 'Resumen'],
  ['Identidad visual', 'Identidad visual'],
  ['Programas', 'Programas'],
  ['Admisiones', 'Admisiones'],
  ['Guía de espacios', 'Guía de espacios'],
  ['Estructura y periodos', 'Estructura'],
  ['Biblioteca', 'Biblioteca'],
  ['Mis avisos', 'Mis avisos'],
]

const navegador = await chromium.launchPersistentContext(
  `${process.env.TEMP}/opencode-chrome-profile-foco-${process.env.PERFIL ?? '2026-10-06'}`,
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

// Captura con el anillo de foco visible: el DOM dice que main tiene el foco, pero lo que importa es
// que se vea. Sin esta imagen el cambio es invisible para quien navega con teclado.
// Se hace ANTES del bucle: con la maquina al 100 % el navegador se cae al final de una corrida larga,
// y una captura al principio sale siempre.
await pagina.goto(`${BASE}/#resumen`, { waitUntil: 'networkidle' })
await pagina.waitForTimeout(1200)
const enlaceCaptura = await pagina.$('nav a:has-text("Estructura")')
if (enlaceCaptura) {
  await enlaceCaptura.focus()
  await pagina.keyboard.press('Enter')
  await pagina.waitForTimeout(1500)
  await pagina.screenshot({ path: new URL('./foco-en-contenido.png', import.meta.url).pathname.replace(/^\//, '') })
  console.log('captura con el foco ya en el contenido: foco-en-contenido.png')
  console.log('')
}

const filas = []
for (const [nombre, textoEnlace] of ENLACES) {
  await pagina.goto(`${BASE}/#resumen`, { waitUntil: 'networkidle' })
  await pagina.waitForTimeout(900)
  const enlace = await pagina.$(`nav a:has-text("${textoEnlace}")`)
  if (!enlace) {
    filas.push({ nombre, hash: 'sin enlace visible', resultado: 'enlace no encontrado con esta sesion' })
    continue
  }
  await enlace.focus()
  await pagina.keyboard.press('Enter')
  await pagina.waitForTimeout(1200)

  const estado = await pagina.evaluate(() => {
    const activo = document.activeElement
    if (!activo) return { dentro: false, etiqueta: 'sin elemento activo' }
    const main = document.querySelector('main')
    return {
      dentro: !!(main && (activo === main || main.contains(activo))),
      etiqueta: `${activo.tagName.toLowerCase()}${activo.className ? `.${String(activo.className).split(' ')[0]}` : ''}`,
      texto: (activo.textContent ?? '').trim().slice(0, 40),
      url: location.hash,
    }
  })
  filas.push({ nombre, hash: estado.url, ...estado })
}
await navegador.close()

const fueraDeContenido = filas.filter((f) => f.dentro === false)
console.log(`rutas comprobadas: ${filas.length}`)
console.log(`con el foco dentro del contenido principal: ${filas.filter((f) => f.dentro === true).length}`)
console.log(`con el foco fuera (sigue en la barra lateral): ${fueraDeContenido.length}`)
console.log('')
for (const f of filas) {
  console.log(`${f.dentro === true ? 'OK  ' : 'FALLA'} ${f.nombre.padEnd(24)} ${String(f.etiqueta ?? '').padEnd(28)} ${f.texto ?? ''}`)
}
await navegador.close()
