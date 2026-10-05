// Ajusta un valor del mapa de contraste y lo aplica a los estilos.
const { readFileSync, writeFileSync, readdirSync, statSync } = require('node:fs')
const { join } = require('node:path')

const mapaPath = join(__dirname, 'mapa-contraste.json')
const anterior = process.argv[2]
const nuevo = process.argv[3]
if (!anterior || !nuevo) throw new Error('uso: node ajusta-mapa.cjs <hex-anterior> <hex-nuevo>')

const mapa = JSON.parse(readFileSync(mapaPath, 'utf8'))
let cambios = 0
for (const [clave, valor] of Object.entries(mapa)) {
  if (valor.toLowerCase() === anterior.toLowerCase()) { mapa[clave] = nuevo; cambios += 1 }
}
writeFileSync(mapaPath, JSON.stringify(mapa, null, 1))
console.log('entradas del mapa actualizadas:', cambios)

const raiz = join(__dirname, '..', '..', '..', 'frontend', 'src')
const scss = (dir) => readdirSync(dir).flatMap((e) => {
  const full = join(dir, e)
  return statSync(full).isDirectory() ? scss(full) : (full.endsWith('.scss') ? [full] : [])
})
let archivos = 0
for (const archivo of scss(raiz)) {
  const texto = readFileSync(archivo, 'utf8')
  if (!texto.toLowerCase().includes(anterior.toLowerCase())) continue
  writeFileSync(archivo, texto.replaceAll(anterior, nuevo))
  archivos += 1
}
console.log('archivos actualizados:', archivos)