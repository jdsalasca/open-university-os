// Convierte el informe de colores pendientes a un mapa hex -> hex accesible y
// comprueba cuantos aparecen realmente en los estilos.
const { readFileSync, writeFileSync, readdirSync, statSync } = require('node:fs')
const { join } = require('node:path')

const raiz = join(__dirname, '..', '..', '..', 'frontend', 'src')
const scss = (dir) => readdirSync(dir).flatMap((e) => {
  const full = join(dir, e)
  return statSync(full).isDirectory() ? scss(full) : (full.endsWith('.scss') ? [full] : [])
})
const hex = (s) => {
  const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  return '#' + [1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, '0')).join('')
}

const datos = JSON.parse(readFileSync(join(__dirname, 'contraste-pendiente.json'), 'utf8'))
const fuentes = scss(raiz).map((f) => readFileSync(f, 'utf8')).join('\n').toLowerCase()

const mapa = {}
let usos = 0
for (const d of datos) {
  const original = hex(d.color)
  if (!d.sustituto || original === d.sustituto) continue
  const veces = fuentes.split(original).length - 1
  mapa[original] = d.sustituto
  usos += d.usos
}

const conCodigo = Object.entries(mapa).filter(([k]) => fuentes.includes(k))
console.log('colores a sustituir:', Object.keys(mapa).length)
console.log('encontrados en los estilos:', conCodigo.length)
console.log('usos de DOM cubiertos:', usos)
console.log('sin aparecer en estilos:', Object.keys(mapa).filter((k) => !fuentes.includes(k)).join(', ') || 'ninguno')
writeFileSync(join(__dirname, 'mapa-contraste.json'), JSON.stringify(mapa, null, 1))