// Extrae de a11y.json los colores de texto que siguen bajo WCAG AA en tema claro,
// cuenta sus usos y calcula el sustituto accesible mas cercano conservando el tono.
const { readFileSync, writeFileSync } = require('node:fs')
const path = require('node:path')

const informe = JSON.parse(readFileSync(path.join(__dirname, 'a11y.json'), 'utf8'))

const cuenta = new Map()
for (const entrada of informe) {
  if (entrada.tema !== 'claro') continue
  for (const h of entrada.contraste || []) {
    const actual = cuenta.get(h.color) || { color: h.color, ratio: h.ratio, usos: 0, clases: new Set() }
    actual.usos += 1
    actual.clases.add(h.etiqueta)
    cuenta.set(h.color, actual)
  }
}

const lum = (c) => {
  const ch = c.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const rgb = (s) => {
  const m = String(s).match(/rgba?\(([^)]+)\)/)
  const p = m[1].split(',').map(parseFloat)
  return [p[0], p[1], p[2]]
}
const hex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
const FONDOS = [[244, 244, 240], [255, 255, 255], [250, 250, 246]]
const OBJETIVO = 4.55

const salida = []
for (const v of [...cuenta.values()].sort((a, b) => b.usos - a.usos)) {
  const base = rgb(v.color)
  let elegido = null
  for (let f = 1; f >= 0.35; f -= 0.002) {
    const cand = base.map((x) => x * f)
    const peor = Math.min(...FONDOS.map((bg) => ratio(cand, bg)))
    if (peor >= OBJETIVO) { elegido = { hex: hex(cand), ratio: Number(peor.toFixed(2)), factor: Number(f.toFixed(3)) }; break }
  }
  const fila = {
    color: v.color,
    ratioMedido: v.ratio,
    usos: v.usos,
    sustituto: elegido ? elegido.hex : null,
    ratioNuevo: elegido ? elegido.ratio : null,
    clases: [...v.clases].slice(0, 5),
  }
  salida.push(fila)
  console.log(`${v.color.padEnd(20)} medido ${String(v.ratio).padEnd(5)} usos ${String(v.usos).padEnd(4)} -> ${elegido ? elegido.hex + ' (' + elegido.ratio + ')' : 'SIN REEMPLAZO'}`)
}
console.log('colores distintos:', salida.length, 'usos totales:', salida.reduce((a, b) => a + b.usos, 0))
writeFileSync(path.join(__dirname, 'contraste-pendiente.json'), JSON.stringify(salida, null, 1))