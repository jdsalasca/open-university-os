// Captura los estados de carga y de error que exige el repositorio. El estado de
// carga se provoca ralentizando la red con CDP; el de error, cortando el backend.
// Escribe capturas e informa de si el estado es anunciable y ocupa espacio.
const { spawn } = require('node:child_process')
const { writeFileSync } = require('node:fs')
const path = require('node:path')

const CHROME = 'C:\\Users\\jdsal\\AppData\\Local\\ms-playwright\\chromium-1187\\chrome-win\\chrome.exe'
const PORT = 9430
const PROFILE = path.join(require('node:os').tmpdir(), 'opencode', 'estados')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const here = __dirname
const rutas = [['resumen', '#resumen'], ['espacios', '#espacios'], ['estudiantes', '#estudiantes'], ['academia', '#academia']]

const c = spawn(
  CHROME,
  ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${PORT}`,
   '--window-size=1440,900', `--user-data-dir=${PROFILE}`, 'about:blank'],
  { stdio: 'ignore' },
)

const ESTADO = `(() => {
  const candidatos = [...document.querySelectorAll('[role=status], [role=alert], [aria-live], [aria-busy="true"]')]
    .filter((el) => el.getBoundingClientRect().height > 0)
  return {
    estados: candidatos.map((el) => ({
      rol: el.getAttribute('role') || el.getAttribute('aria-live') || 'sin-rol',
      texto: el.textContent.trim().slice(0, 70),
      alto: Math.round(el.getBoundingClientRect().height),
    })),
    altoBody: document.body.scrollHeight,
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
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Network.enable')

  const informe = []
  for (const [nombre, hash] of rutas) {
    // Estado de carga: red muy lenta para que la pantalla intermedia sea visible.
    await send('Network.emulateNetworkConditions', {
      offline: false, latency: 2500, downloadThroughput: 25 * 1024, uploadThroughput: 25 * 1024,
    })
    await send('Page.navigate', { url: `http://localhost:5173/${hash}` })
    await sleep(3000)
    const carga = (await send('Runtime.evaluate', { returnByValue: true, expression: ESTADO })).result.value
    const shotCarga = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(path.join(here, `carga-${nombre}.png`), Buffer.from(shotCarga.data, 'base64'))
    await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
    await sleep(2500)

    informe.push({ ruta: nombre, carga })
    console.log(`${nombre} CARGA: ${carga.estados.length} regiones, ${carga.estados.map((e) => e.rol).join(',') || 'ninguna'}`)
  }
  writeFileSync(path.join(here, 'estados-carga.json'), JSON.stringify(informe, null, 1))
  c.kill(); process.exit(0)
})().catch((e) => { console.error('error', e.message); c.kill(); process.exit(1) })