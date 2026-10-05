// Captura el estado de error de las rutas publicas con el backend caido. Busca
// mensajes tecnicos, pantallas vacias y regiones de error anunciables.
const { spawn } = require('node:child_process')
const { writeFileSync } = require('node:fs')
const path = require('node:path')

const CHROME = 'C:\\Users\\jdsal\\AppData\\Local\\ms-playwright\\chromium-1187\\chrome-win\\chrome.exe'
const PORT = 9440
const PROFILE = path.join(require('node:os').tmpdir(), 'opencode', 'error')
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

// Un mensaje de error util dice que发生了什么 y ofrece una salida. Se marks como
// tecnico si expone un nombre de clase, un puerto, un stack o una excepcion.
const TECNICOS = /\b(Exception|Error|500|502|503|504|ECONN|fetch failed|proxy|nginx|java\.|org\.spring|localhost:\d+|at\s+\w+\.|stack|Traceback|undefined|NaN)\b/i

const ESTADO = `(() => {
  const regiones = [...document.querySelectorAll('[role=alert], [role=status]')]
    .filter((el) => el.getBoundingClientRect().height > 0)
    .map((el) => ({ rol: el.getAttribute('role'), texto: el.textContent.trim().slice(0, 120) }))
  const cuerpo = document.body.innerText.replace(/\\s+/g, ' ').trim()
  return {
    regiones,
    altoBody: document.body.scrollHeight,
    shell: document.querySelectorAll('.platform-shell').length,
    // El mensaje visible que la persona leeria de verdad.
    mensajePrincipal: (document.querySelector('main')?.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 220),
    textoTotal: cuerpo.slice(0, 400),
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

  const informe = []
  for (const [nombre, hash] of rutas) {
    await send('Page.navigate', { url: `http://localhost:5173/${hash}` })
    await sleep(9000)
    const r = await send('Runtime.evaluate', { returnByValue: true, expression: ESTADO })
    const v = r.result.value
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(path.join(here, `error-${nombre}.png`), Buffer.from(shot.data, 'base64'))
    const tecnico = TECNICOS.test(v.textoTotal)
    const alertas = v.regiones.filter((x) => x.rol === 'alert').length
    informe.push({ ruta: nombre, ...v, tecnico, alertas })
    console.log(`${nombre}: shell=${v.shell} alto=${v.altoBody} alertas=${alertas} tecnico=${tecnico}`)
    console.log(`   "${v.mensajePrincipal.slice(0, 120)}"`)
  }
  writeFileSync(path.join(here, 'error.json'), JSON.stringify(informe, null, 1))
  c.kill(); process.exit(0)
})().catch((e) => { console.error('error', e.message); c.kill(); process.exit(1) })