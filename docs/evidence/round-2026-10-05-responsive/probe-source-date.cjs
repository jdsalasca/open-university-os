// Inspecciona el recorte de la linea de fuente en la guia de espacios a 768 px:
// mide el elemento, sus ancestros y el estilo computado para entender la causa.
const { spawn } = require('node:child_process')
const path = require('node:path')

const CHROME = 'C:\\Users\\jdsal\\AppData\\Local\\ms-playwright\\chromium-1187\\chrome-win\\chrome.exe'
const PORT = 9397
const PROFILE = path.join(require('node:os').tmpdir(), 'opencode', 'source-probe')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const c = spawn(
  CHROME,
  ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${PORT}`,
   '--window-size=768,1024', `--user-data-dir=${PROFILE}`, 'about:blank'],
  { stdio: 'ignore' },
)

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
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 768, height: 1024, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: 'http://localhost:5173/#espacios' })
  await sleep(7000)
  const out = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const p = document.querySelector('.spaces-source-date')
      if (!p) return { error: 'no encontrado' }
      const cs = getComputedStyle(p)
      const cadena = []
      let el = p
      while (el && el !== document.body) {
        const s = getComputedStyle(el)
        cadena.push({
          etiqueta: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).trim().split(/\\s+/)[0] : ''),
          ancho: Math.round(el.getBoundingClientRect().width),
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          overflow: s.overflow,
          whiteSpace: s.whiteSpace,
          display: s.display,
        })
        el = el.parentElement
      }
      return {
        texto: p.textContent.trim(),
        lineas: Math.round(p.getBoundingClientRect().height / parseFloat(cs.lineHeight)),
        scrollWidth: p.scrollWidth, clientWidth: p.clientWidth,
        estilo: { whiteSpace: cs.whiteSpace, overflow: cs.overflow, textOverflow: cs.textOverflow, display: cs.display },
        ancestros: cadena,
      }
    })()`,
  })
  console.log(JSON.stringify(out.result.value, null, 1))
  ws.close(); c.kill(); process.exit(0)
})().catch((e) => { console.error('error', e.message); c.kill(); process.exit(1) })