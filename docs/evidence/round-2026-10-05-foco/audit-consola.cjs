// Captura errores de consola, promesas rechazadas y peticiones fallidas en las
// rutas publicas. Busca fugas reales de ejecucion, no avisos cosméticos.
const { spawn } = require('node:child_process')
const { writeFileSync } = require('node:fs')
const path = require('node:path')

const CHROME = 'C:\\Users\\jdsal\\AppData\\Local\\ms-playwright\\chromium-1187\\chrome-win\\chrome.exe'
const PORT = 9425
const PROFILE = path.join(require('node:os').tmpdir(), 'opencode', 'consola')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const here = __dirname
const rutas = [
  ['resumen', '#resumen'], ['programas', '#programas'], ['espacios', '#espacios'],
  ['admisiones', '#admisiones'], ['estudiantes', '#estudiantes'], ['academia', '#academia'],
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
  const consola = []
  const red = []
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); return }
    if (m.method === 'Runtime.consoleAPICalled') {
      const t = m.params.type
      if (t === 'error' || t === 'warning') {
        consola.push({ tipo: t, texto: m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200) })
      }
    }
    if (m.method === 'Runtime.exceptionThrown') {
      consola.push({ tipo: 'exception', texto: (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || '').slice(0, 200) })
    }
    if (m.method === 'Network.responseReceived') {
      const r = m.params.response
      if (r.status >= 400) red.push({ url: r.url.slice(0, 120), estado: r.status })
    }
    if (m.method === 'Network.loadingFailed') {
      red.push({ url: (m.params.requestId || '').slice(0, 60), error: m.params.errorText })
    }
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
    consola.length = 0
    red.length = 0
    await send('Page.navigate', { url: `http://localhost:5173/${hash}` })
    await sleep(7000)
    const info = {
      ruta: nombre,
      errores: consola.filter((x) => x.tipo === 'error' || x.tipo === 'exception').length,
      avisos: consola.filter((x) => x.tipo === 'warning').length,
      peticionesFallidas: red.filter((x) => x.estado >= 400).length,
      detalleConsola: consola.slice(0, 6),
      detalleRed: red.slice(0, 6),
    }
    informe.push(info)
    console.log(`${nombre}: ${info.errores} errores, ${info.avisos} avisos, ${info.peticionesFallidas} peticiones fallidas`)
    for (const d of info.detalleConsola.slice(0, 3)) console.log(`   [${d.tipo}] ${d.texto.slice(0, 130)}`)
    for (const d of info.detalleRed.slice(0, 3)) console.log(`   [red] ${d.estado || ''} ${d.url}`)
  }
  writeFileSync(path.join(here, 'consola-red.json'), JSON.stringify(informe, null, 1))
  c.kill(); process.exit(0)
})().catch((e) => { console.error('error', e.message); c.kill(); process.exit(1) })