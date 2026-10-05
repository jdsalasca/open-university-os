// Detecta el patron que produjo tres iconos invisibles el 5 de octubre de 2026: una regla de
// componente que fija `background` claro con un literal y tambien fija `color` con un literal.
// En tema oscuro la regla puerta de _theme.scss gana al `color` (especificidad 0-5-1 frente a
// 0-1-1 de un selector de clase) pero no toca el `background`, que es un literal del componente:
// el glifo queda claro sobre claro.
//
// Este script solo CUENTA y LISTA. El criterio para darlo por bueno esta en el guard
// check-dark-badges.node-test.mjs.
import { compile } from 'sass'
import { readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const raiz = process.argv[2]
const salida = process.argv[3]

const luminancia = (hex) => {
  const canales = hex.slice(1).match(/.{2}/g).map((c) => Number.parseInt(c, 16) / 255)
  const [r, g, b] = canales.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a, b) => {
  const [alto, bajo] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (alto + 0.05) / (bajo + 0.05)
}

const hojas = []
const recorrer = (dir) => {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) recorrer(ruta)
    else if (nombre.endsWith('.scss')) hojas.push(ruta)
  }
}
recorrer(raiz)

// Los selectores que el tema oscuro repinta de forma explicita. Una regla de componente que
// aparece aqui queda cubierta por el tema y no es candidata.
const temaOscuro = compile(join(raiz, '..', 'styles', '_theme.scss')).css
const repintados = new Set()
// Sass compila `[data-theme='dark']` a `[data-theme=dark]`, asi que el texto del selector ya no
// conserva las comillas. Se busca el atributo, no la cadena completa.
for (const regla of temaOscuro.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  if (!/data-theme\s*=\s*['"]?dark/.test(regla[1])) continue
  if (!/(background|color)\s*:/.test(regla[2])) continue
  for (const m of regla[1].matchAll(/\.([a-z0-9][a-z0-9-]+)/gi)) repintados.add(m[1])
}

const candidatos = []
for (const archivo of hojas) {
  const css = compile(archivo, { loadPaths: [join(raiz, '..')] }).css
  for (const [, selector, cuerpo] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = selector.trim()
    if (sel.startsWith(':root') || sel.startsWith('@')) continue
    const fondo = /background(?:-color)?\s*:\s*(#[0-9a-f]{6})/i.exec(cuerpo)
    const color = /(?:^|[;\s])color\s*:\s*(#[0-9a-f]{6})/i.exec(cuerpo)
    if (!fondo || !color) continue
    // Solo interesan los fondos claros: un fondo oscuro con color claro sobrevive al tema.
    if (luminancia(fondo[1]) < 0.55) continue
    // Y solo los que hoy son legibles en claro; si ya fallan, es otro problema.
    if (ratio(fondo[1], color[1]) < 4.5) continue
    const clases = [...sel.matchAll(/\.([a-z0-9][a-z0-9-]+)/gi)].map((m) => m[1])
    const cubierto = clases.length > 0 && clases.every((c) => repintados.has(c))
    if (cubierto) continue
    candidatos.push({
      archivo: archivo.replace(raiz + '\\', ''),
      selector: sel.replace(/\s+/g, ' ').slice(0, 90),
      fondo: fondo[1],
      color: color[1],
      ratio: ratio(fondo[1], color[1]).toFixed(2),
    })
  }
}

const lineas = [
  `hojas revisadas: ${hojas.length}`,
  `clases que el tema oscuro repinta: ${repintados.size}`,
  `candidatos SIN repintar en tema oscuro: ${candidatos.length}`,
  '',
  'Un candidato es una regla que fija fondo claro y color con literales, y cuya clase no esta',
  'en la lista de selectores que el tema oscuro repinta. Al entrar en tema oscuro el color lo',
  'reescribe la regla puerta y el fondo se queda claro: el texto queda ilegible.',
  '',
]
for (const c of candidatos) {
  lineas.push(`${c.archivo}`)
  lineas.push(`  ${c.selector}`)
  lineas.push(`  fondo ${c.fondo} · color ${c.color} · ratio en claro ${c.ratio}`)
}
writeFileSync(salida, lineas.join('\n'), 'utf8')
console.log(lineas.slice(0, 4).join('\n'))
console.log(`escrito en ${salida}`)
