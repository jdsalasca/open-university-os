// Audita las rutas publicas en movil (390x844) y tablet (768x1024): captura
// pantalla y detecta desbordamiento horizontal, elementos que se salen del
// viewport y texto recortado. Escribe PNG y un informe JSON.
const { spawn } = require('node:child_process')
const { writeFileSync } = require('node:fs')
const path = require('node:path')

const CHROME = 'C:\\Users\\jdsal\\AppData\\Local\\ms-playwright\\chromium-1187\\chrome-win\\chrome.exe'
const PORT = 9395
const PROFILE = path.join(require('node:os').tmpdir(), 'opencode', 'responsive')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const here = __dirname
const routes = [
  ['resumen', '#resumen'],
  ['programas', '#programas'],
  ['espacios', '#espacios'],
  ['admisiones', '#admisiones'],
  ['estudiantes', '#estudiantes'],
  ['academia', '#academia'],
]
const viewports = [
  ['movil', 390, 844],
  ['tablet', 768, 1024],
]

const c = spawn(
  CHROME,
  ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${PORT}`,
   `--user-data-dir=${PROFILE}`, 'about:blank'],
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

  const report = []
  for (const [vpName, w, h] of viewports) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: w, height: h, deviceScaleFactor: 1, mobile: vpName === 'movil',
    })
    for (const [route, hash] of routes) {
      await send('Page.navigate', { url: `http://localhost:5173/${hash}` })
      await sleep(6000)
      const info = await send('Runtime.evaluate', {
        returnByValue: true,
        expression: `(() => {
          const vw = document.documentElement.clientWidth
          const desbordes = []
          for (const el of document.querySelectorAll('body *')) {
            const r = el.getBoundingClientRect()
            if (r.width === 0 || r.height === 0) continue
            if (r.right > vw + 1 || r.left < -1) {
              desbordes.push({
                etiqueta: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).trim().split(/\\s+/).slice(0,2).join('.') : ''),
                izquierda: Math.round(r.left), derecha: Math.round(r.right),
              })
            }
          }
          // Solo cuenta texto realmente visible. El texto para lectores de pantalla
          // se oculta con clip y 1x1 px, y un mes abreviado ("1 de oct") es el
          // formato corto de la fecha, no un recorte.
          const recorte = [...document.querySelectorAll('body *')].filter((el) => {
            const cs = getComputedStyle(el)
            return el.children.length === 0
              && el.scrollWidth > el.clientWidth + 2
              && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll'
              && cs.textOverflow !== 'ellipsis' && cs.clip === 'auto'
          }).slice(0, 5).map((el) => ({
            etiqueta: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).trim().split(/\\s+/)[0] : ''),
            texto: el.textContent.trim().slice(0, 40),
          }))
          return {
            vw,
            scrollX: document.documentElement.scrollWidth > vw,
            anchoTotal: document.documentElement.scrollWidth,
            desbordes: desbordes.slice(0, 8),
            recorte,
            alertas: [...document.querySelectorAll('[role=alert]')].map((a) => a.textContent.trim().slice(0, 70)),
          }
        })()`,
      })
      const shot = await send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(path.join(here, `${vpName}-${route}.png`), Buffer.from(shot.data, 'base64'))
      report.push({ viewport: vpName, ruta: route, ...info.result.value })
    }
  }
  writeFileSync(path.join(here, 'responsive.json'), JSON.stringify(report, null, 1))
  for (const r of report) {
    const problemas = []
    if (r.scrollX) problemas.push(`SCROLL-H ${r.anchoTotal}>${r.vw}`)
    if (r.desbordes.length) problemas.push(`${r.desbordes.length} desbordes`)
    if (r.recorte.length) problemas.push(`recorte: ${r.recorte.map((x) => x.etiqueta).join(',')}`)
    if (r.alertas.length) problemas.push(`alerta: ${r.alertas[0]}`)
    console.log(`${r.viewport}/${r.ruta}: ${problemas.length ? problemas.join(' | ') : 'ok'}`)
  }
  ws.close(); c.kill(); process.exit(0)
})().catch((e) => { console.error('error', e.message); c.kill(); process.exit(1) })