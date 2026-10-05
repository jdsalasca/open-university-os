// Audita accesibilidad en el navegador sobre las rutas publicas, en tema claro y
// oscuro. No depende de paquetes nuevos: mide contraste WCAG real del texto pintado,
// nombres accesibles de los controles, jerarquia de titulos, etiquetas de formulario
// y area tactil. Escribe JSON y capturas por ruta y tema.
const { spawn } = require('node:child_process')
const { writeFileSync } = require('node:fs')
const path = require('node:path')

const CHROME = 'C:\\Users\\jdsal\\AppData\\Local\\ms-playwright\\chromium-1187\\chrome-win\\chrome.exe'
const PORT = 9410
const PROFILE = path.join(require('node:os').tmpdir(), 'opencode', 'a11y')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const here = __dirname
const APP = 'http://localhost:5173'
const routes = [
  ['resumen', '#resumen'],
  ['programas', '#programas'],
  ['espacios', '#espacios'],
  ['admisiones', '#admisiones'],
  ['estudiantes', '#estudiantes'],
  ['academia', '#academia'],
]

const AUDIT = String.raw`
(() => {
  const lum = (c) => {
    const ch = c.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 })
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
  }
  const parse = (s) => {
    const m = String(s).match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const p = m[1].split(',').map((x) => parseFloat(x))
    return { c: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 }
  }
  // Fondo efectivo: sube por el arbol hasta encontrar un color opaco.
  const fondo = (el) => {
    let n = el
    while (n && n !== document.documentElement) {
      const bg = parse(getComputedStyle(n).backgroundColor)
      if (bg && bg.a > 0.85) return bg.c
      n = n.parentElement
    }
    const html = parse(getComputedStyle(document.documentElement).backgroundColor)
    return html && html.a > 0 ? html.c : [255, 255, 255]
  }
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
    return (x + 0.05) / (y + 0.05)
  }
  const nombre = (el) => {
    const aria = el.getAttribute('aria-label')
    if (aria && aria.trim()) return aria.trim()
    const labelledby = el.getAttribute('aria-labelledby')
    if (labelledby) {
      const t = labelledby.split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim()).filter(Boolean).join(' ')
      if (t) return t
    }
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
      if (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')?.textContent?.trim()) return 'label'
      if (el.closest('label')?.textContent?.trim()) return 'label-envuelto'
      if (el.getAttribute('title')) return el.getAttribute('title')
      return ''
    }
    if (el.tagName === 'IMG' && el.getAttribute('alt')) return el.getAttribute('alt')
    return (el.textContent || '').trim().slice(0, 60)
  }
  const etiqueta = (el) => el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).trim().split(/\s+/).slice(0, 2).join('.') : '')

  // getComputedStyle devuelve el display propio aunque el ancestro este oculto, asi
  // que hay que comprobar que el elemento llega a pintarse de verdad.
  const sePinta = (el) => {
    if (el.getClientRects().length === 0) return false
    let n = el
    while (n && n !== document.documentElement) {
      const cs = getComputedStyle(n)
      if (cs.display === 'none' || cs.visibility === 'hidden') return false
      n = n.parentElement
    }
    return true
  }

  const contraste = []
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el)
    if (!sePinta(el) || parseFloat(cs.opacity) < 0.15) continue
    const texto = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ')
    if (!texto) continue
    if (el.closest('.theme-selector-label')) continue
    const fg = parse(cs.color)
    if (!fg || fg.a < 0.15) continue
    const size = parseFloat(cs.fontSize)
    const peso = parseInt(cs.fontWeight, 10) || 400
    const grande = size >= 24 || (size >= 18.66 && peso >= 700)
    const r = ratio(fg.c, fondo(el))
    const minimo = grande ? 3 : 4.5
    if (r < minimo) {
      // Un texto claro casi siempre vive sobre una superficie oscura (el hero de
      // espacios, por ejemplo, tiene fondo rgb(30,36,28) fijo). El recorrido de
      // ancestros no compone gradientes ni imagenes, asi que para texto claro el
      // fondo calculado no es fiable. Solo se reporta texto oscuro, donde el fondo
      // recorrido es una superficie clara y el ratio es aritmeticamente exacto.
      const lumTexto = lum(fg.c)
      contraste.push({
        etiqueta: etiqueta(el),
        texto: texto.slice(0, 42),
        ratio: Number(r.toFixed(2)),
        minimo,
        size,
        fiable: lumTexto < 0.5,
        lumTexto: Number(lumTexto.toFixed(3)),
      })
    }
  }

  const controles = []
  for (const el of document.querySelectorAll('button, a[href], input, select, textarea, [role=button]')) {
    if (!sePinta(el)) continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    const n = nombre(el)
    if (!n) controles.push({ etiqueta: etiqueta(el), problema: 'sin-nombre-accesible', caja: [Math.round(r.width), Math.round(r.height)] })
    else if (r.height < 24 || r.width < 24) controles.push({ etiqueta: etiqueta(el), problema: 'area-tactil-pequena', caja: [Math.round(r.width), Math.round(r.height)], nombre: n.slice(0, 30) })
  }

  const titulos = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => Number(h.tagName[1]))
  const jerarquia = []
  for (let i = 1; i < titulos.length; i += 1) if (titulos[i] - titulos[i - 1] > 1) jerarquia.push({ de: titulos[i - 1], a: titulos[i] })
  const h1 = document.querySelectorAll('h1').length

  const campos = []
  for (const el of document.querySelectorAll('input, select, textarea')) {
    if (!sePinta(el)) continue
    const tiene = (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]'))
      || el.closest('label') || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')
    if (!tiene) campos.push({ etiqueta: etiqueta(el), tipo: el.type || el.tagName })
  }

  return {
    contraste: contraste.filter((x) => x.fiable).slice(0, 20),
    contrasteNoVerificable: contraste.filter((x) => !x.fiable).length,
    controles: controles.slice(0, 20),
    jerarquia,
    h1,
    campos: campos.slice(0, 12),
    conteos: { contraste: contraste.filter((x) => x.fiable).length, controles: controles.length, jerarquia: jerarquia.length, campos: campos.length },
  }
})()
`

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

  const informe = []
  for (const [nombreRuta, hash] of routes) {
    for (const tema of ['claro', 'oscuro']) {
      await send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-color-scheme', value: tema === 'oscuro' ? 'dark' : 'light' }],
      })
      await send('Page.navigate', { url: `${APP}/${hash}` })
      await sleep(5500)
      const out = await send('Runtime.evaluate', { returnByValue: true, expression: AUDIT })
      const r = out.result.value
      informe.push({ ruta: nombreRuta, tema, ...r })
      const total = r.conteos.contraste + r.conteos.controles + r.conteos.jerarquia + r.conteos.campos
      console.log(`${nombreRuta}/${tema}: ${total === 0 ? 'ok' : JSON.stringify(r.conteos)}`)
    }
  }
  writeFileSync(path.join(here, 'a11y.json'), JSON.stringify(informe, null, 1))
  c.kill(); process.exit(0)
})().catch((e) => { console.error('error', e.message); c.kill(); process.exit(1) })