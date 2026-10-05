// Captura las rutas publicas del monorepo para evidencia visual.
const { spawn } = require('node:child_process')
const { writeFileSync } = require('node:fs')
const path = require('node:path')

const CHROME = 'C:\\Users\\jdsal\\AppData\\Local\\ms-playwright\\chromium-1187\\chrome-win\\chrome.exe'
const PORT = 9390
const PROFILE = path.join(require('node:os').tmpdir(), 'opencode', 'mono-shot')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const here = __dirname
const routes = [
  ['resumen', '#resumen'],
  ['programas', '#programas'],
  ['espacios', '#espacios'],
  ['admisiones', '#admisiones'],
]

const c = spawn(
  CHROME,
  ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${PORT}`,
   '--window-size=1440,900', `--user-data-dir=${PROFILE}`, 'about:blank'],
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

  for (const [name, hash] of routes) {
    await send('Page.navigate', { url: `http://localhost:5173/${hash}` })
    await sleep(6000)
    const info = await send('Runtime.evaluate', {
      returnByValue: true,
      expression: `({ titulo: (document.querySelector('h1')||{}).textContent?.trim().slice(0,60) || null,
        alertas: [...document.querySelectorAll('[role=alert]')].map(a=>a.textContent.trim().slice(0,60)),
        altoBody: document.body.scrollHeight })`,
    })
    const r = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(path.join(here, `monorepo-${name}.png`), Buffer.from(r.data, 'base64'))
    console.log(name, JSON.stringify(info.result.value))
  }
  ws.close(); c.kill(); process.exit(0)
})().catch((e) => { console.error('error', e.message); c.kill(); process.exit(1) })