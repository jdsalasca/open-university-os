// Captura las rutas publicas en tema claro y oscuro para revisar que el
// contraste corregido no altero la jerarquia visual ni el tema oscuro.
const { spawn } = require('node:child_process')
const { writeFileSync } = require('node:fs')
const path = require('node:path')

const CHROME = 'C:\\Users\\jdsal\\AppData\\Local\\ms-playwright\\chromium-1187\\chrome-win\\chrome.exe'
const PORT = 9415
const PROFILE = path.join(require('node:os').tmpdir(), 'opencode', 'a11y-shot')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const here = __dirname
const rutas = [['admisiones', '#admisiones'], ['resumen', '#resumen'], ['academia', '#academia']]

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
  for (const [nombre, hash] of rutas) {
    for (const tema of ['claro', 'oscuro']) {
      await send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-color-scheme', value: tema === 'oscuro' ? 'dark' : 'light' }],
      })
      await send('Page.navigate', { url: `http://localhost:5173/${hash}` })
      await sleep(6000)
      const shot = await send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(path.join(here, `${nombre}-${tema}.png`), Buffer.from(shot.data, 'base64'))
      console.log('captura', nombre, tema)
    }
  }
  c.kill(); process.exit(0)
})().catch((e) => { console.error('error', e.message); c.kill(); process.exit(1) })
