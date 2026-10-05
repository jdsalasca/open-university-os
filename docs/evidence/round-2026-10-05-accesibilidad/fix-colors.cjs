// Calcula el hex accesible mas cercano conservando el tono: escala los tres
// canales por el mismo factor en lugar de oscurecer uno solo. Aritmetica pura.
const fs = require('node:fs')

const lum = (c) => {
  const ch = c.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const rgbToHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')

const FONDOS = ['#f4f4f0', '#ffffff', '#fafaf6']
const MINIMO = 4.55

const COLORES = ['#85877d', '#989990', '#77786f', '#777970', '#7b7d72', '#797a72', '#8a8b83', '#8d8972', '#8a8a7a', '#7a7c6c', '#88866a']

const salida = []
for (const hex of COLORES) {
  const base = hexToRgb(hex)
  const peorAntes = Math.min(...FONDOS.map((f) => ratio(base, hexToRgb(f))))
  let elegido = null
  for (let f = 1; f >= 0.4; f -= 0.002) {
    const cand = base.map((v) => v * f)
    const peor = Math.min(...FONDOS.map((bg) => ratio(cand, hexToRgb(bg))))
    if (peor >= MINIMO) { elegido = { hex: rgbToHex(cand), peor, factor: Number(f.toFixed(3)) }; break }
  }
  const fila = {
    original: hex,
    ratioAntes: Number(peorAntes.toFixed(2)),
    accesible: elegido ? elegido.hex : null,
    ratioDespues: elegido ? Number(elegido.peor.toFixed(2)) : null,
    factor: elegido ? elegido.factor : null,
  }
  salida.push(fila)
  console.log(`${hex}  ${peorAntes.toFixed(2)}  ->  ${elegido ? elegido.hex + '  ' + elegido.peor.toFixed(2) + '  (x' + elegido.factor + ')' : 'sin reemplazo'}`)
}
fs.writeFileSync(__dirname + '/contraste-reemplazos.json', JSON.stringify(salida, null, 1))