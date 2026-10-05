// Recorre la pagina con Tab real mediante CDP, de modo que el navegador aplique
// :focus-visible igual que con una persona tecleando. Comprueba que el primer
// control es el salto al contenido y que cada foco muestra indicador visible.
const { spawn } = require('node:child_process')
const { writeFileSync } = require('node:fs')
const path = require('node:path')

const CHROME = 'C:\\Users\\jdsal\\AppData\\Local\\ms-playwright\\chromium-1187\\chrome-win\\chrome.exe'
const PORT = 9421
const PROFILE = path.join(require('node:os').tmpdir(), 'opencode', 'foco2')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const here = __dirname
const rutas = [['resumen', '#resumen'], ['programas', '#programas'], ['espacios', '#espacios'], ['admisiones', '#admisiones']]

const c = spawn(
  CHROME,
  ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${PORT}`,
   '--window-size=1440,900', `--user-data-dir=${PROFILE}`, 'about:blank'],
  { stdio: 'ignore' },
)

const LEER_FOCO = `(() => {
  const el = document.activeElement
  if (!el || el === document.body) return null
  // El input de busqueda no lleva outline propio: su contenedor lo dibuja con
  // :focus-within, asi que el indicador se busca tambien en el padre inmediato.
  const cadena = []
  for (let n = el; n && n !== document.body && cadena.length < 3; n = n.parentElement) {
    const cs = getComputedStyle(n)
    if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) { cadena.push(cs.outlineWidth + ' ' + cs.outlineColor); break }
    if (cs.boxShadow !== 'none') { cadena.push('sombra'); break }
  }
  const cs = getComputedStyle(el)
  const r = el.getBoundingClientRect()
  return {
    etiqueta: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).trim().split(/\\s+/)[0] : ''),
    texto: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40),
    outlineEstilo: cs.outlineStyle,
    sombra: cs.boxShadow === 'none' ? '' : cs.boxShadow.slice(0, 50),
    indicador: cadena[0] || '',
    caja: [Math.round(r.width), Math.round(r.height)],
    visible: cs.visibility === 'visible' && cs.display !== 'none',
  }
})()`

;(async () => {
  await sleep(3500)
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
  const ws = new WebSocket(list[0].webSocketDebuggerUrl)
  const pending = new Map()
  let id = 0
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) }
  })
  await new Promise((res) => ws.addEventListener('open', res, { once: true }))
  const send = (method, params = {}) => {
    const i = ++id
    const pr = new Promise((r) => pending.set(i, r))
    ws.send(JSON.stringify({ id: i, method, params }))
    return pr
  }
  const tab = async () => {
    for (const type of ['rawKeyDown', 'char', 'keyUp']) {
      await send('Input.dispatchKeyEvent', { type, key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9, text: type === 'char' ? '' : undefined })
    }
    await sleep(90)
  }

  await send('Page.enable')
  await send('Runtime.enable')

  const informe = []
  for (const [nombre, hash] of rutas) {
    await send('Page.navigate', { url: `http://localhost:5173/${hash}` })
    await sleep(5500)
    // Sin resetear, el foco puede quedar donde lo dejo la carga anterior y el
    // primer Tab no partiria del inicio del documento.
    await send('Runtime.evaluate', { expression: `document.activeElement?.blur?.(); document.body.setAttribute('tabindex','-1'); document.body.focus(); document.body.removeAttribute('tabindex'); document.activeElement?.blur?.()` })

    const vistos = []
    for (let i = 0; i < 24; i += 1) {
      await tab()
      const r = await send('Runtime.evaluate', { returnByValue: true, expression: LEER_FOCO })
      if (!r.result.value) break
      vistos.push({ ...r.result.value, paso: i + 1 })
    }

    const sinIndicador = vistos.filter((v) => !v.indicador)
    const primero = vistos[0] || null
    const salto = vistos.find((v) => v.texto.toLowerCase().includes('saltar'))

    await send('Runtime.evaluate', { expression: `document.querySelector('a[href^="#"], .skip-link')?.focus()` })
    await sleep(250)
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(path.join(here, `foco-${nombre}.png`), Buffer.from(shot.data, 'base64'))

    informe.push({
      ruta: nombre,
      controles: vistos.length,
      sinIndicador: sinIndicador.length,
      detalle: sinIndicador.slice(0, 8),
      primero,
      saltoEsPrimero: Boolean(salto && salto.paso === 1),
    })
    console.log(`${nombre}: ${vistos.length} controles, ${sinIndicador.length} sin indicador, primero="${primero?.texto?.slice(0, 30)}"`)
  }
  writeFileSync(path.join(here, 'foco.json'), JSON.stringify(informe, null, 1))
  c.kill(); process.exit(0)
})().catch((e) => { console.error('error', e.message); c.kill(); process.exit(1) })