// Auditoría de enlaces externos del portal: cada URL oficial que la app presenta debe responder.
// Las fixtures de pruebas (*.example*, *.attacker.example, localhost) se excluyen: son señuelos de
// los guards de seguridad, no enlaces que una persona pueda pulsar.
//
//   node docs/evidence/round-2026-10-07-enlaces/auditar-enlaces.mjs [salida.txt]
import { readFileSync, writeFileSync } from 'node:fs'

const ENTRADA = new URL('./urls-reales.txt', import.meta.url).pathname.replace(/^\//, '')
const urls = [...new Set(readFileSync(ENTRADA, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean))]

const resultados = []
for (const url of urls) {
  let estado = 'error'
  let detalle = ''
  for (const metodo of ['HEAD', 'GET']) {
    try {
      const controlador = new AbortController()
      const limite = setTimeout(() => controlador.abort(), 25000)
      const r = await fetch(url, { method: metodo, redirect: 'follow', signal: controlador.signal })
      clearTimeout(limite)
      estado = String(r.status)
      if (r.ok || (r.status !== 405 && r.status < 500)) break
      detalle = `reintentado con ${metodo}`
    } catch (e) {
      detalle = `${metodo}: ${String(e.cause?.code ?? e.message).slice(0, 60)}`
    }
  }
  resultados.push({ url, estado, detalle })
  console.log(`${estado.padEnd(6)} ${url}`)
}

const muertos = resultados.filter((r) => !/^[23]/.test(r.estado))
const lineas = [
  `Enlaces externos reales auditados: ${resultados.length}`,
  `Verdes (2xx/3xx): ${resultados.length - muertos.length}`,
  `Rotos o sin respuesta: ${muertos.length}`,
  '',
  ...muertos.map((r) => `ROTO ${r.estado} ${r.url} :: ${r.detalle}`),
]
const salida = process.argv[2]
if (salida) writeFileSync(salida, lineas.join('\n'), 'utf8')
