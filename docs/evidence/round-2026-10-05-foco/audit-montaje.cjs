// Comprueba que el marcador de arranque desaparece al montar y que no queda
// superpuesto con el shell, tanto en tema claro como en oscuro.
const { spawn } = require('node:child_process')
const { writeFileSync } = require('node:fs')
const path = require('node:path')

const CHROME = 'C:\\Users\\jdsal\\AppData\\Local\\ms-playwright\\chromium-1187\\chrome-win\\chrome.exe'
const PORT = 9435
const PROFILE = path.join(require('node:os').tmpdir(), 'opencode', 'boot')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const here = __dirname

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

  const salida = []
  for (const tema of ['claro', 'oscuro']) {
    await send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: tema === 'oscuro' ? 'dark' : 'light' }],
    })
    for (const [nombre, hash] of [['resumen', '#resumen'], ['espacios', '#espacios']]) {
      await send('Page.navigate', { url: `http://localhost:5173/${hash}` })
      await sleep(7000)
      const r = await send('Runtime.evaluate', {
        returnByValue: true,
        expression: `(() => ({
          marcador: document.querySelectorAll('.app-boot').length,
          shell: document.querySelectorAll('.platform-shell').length,
          titulo: (document.querySelector('h1') || {}).textContent?.trim().slice(0, 40) || null,
          alto: document.body.scrollHeight,
        }))()`,
      })
      const v = r.result.value
      const shot = await send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(path.join(here, `montado-${nombre}-${tema}.png`), Buffer.from(shot.data, 'base64'))
      salida.push({ tema, ruta: nombre, ...v })
      console.log(`${tema}/${nombre}: marcador=${v.marcador} shell=${v.shell} titulo="${v.titulo}"`)
    }
  }
  writeFileSync(path.join(here, 'montaje.json'), JSON.stringify(salida, null, 1))
  c.kill(); process.exit(0)
})().catch((e) => { console.error('error', e.message); c.kill(); process.exit(1) })