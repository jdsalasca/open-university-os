// Inventario de construcciones específicas de MySQL en las migraciones Flyway.
// Responde con evidencia a "¿qué costaría cambiar a SQLite?": cada hallazgo es algo que habría que
// reescribir, adaptar o verificar en el otro motor. No decide el cambio; lo dimensiona.
//
//   node docs/evidence/round-2026-10-07-sqlite-inventario/inventario.mjs [salida.txt]
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = new URL('../../../backend/src/main/resources/db/migration/', import.meta.url).pathname.replace(/^\//, '')

const PATRONES = [
  ['backticks `col`', /`[a-z_]+`/i],
  ['ENGINE=InnoDB u otro motor', /\bENGINE\s*=/i],
  ['CHARSET/COLLATE', /\b(CHARSET|COLLATE)\b/i],
  ['AUTO_INCREMENT', /\bAUTO_INCREMENT\b/i],
  ['ON UPDATE CURRENT_TIMESTAMP', /\bON UPDATE\b/i],
  ['funciones JSON_*', /\bJSON_(OBJECT|ARRAY|EXTRACT|CONTAINS|ARRAYAGG|QUOTE|UNQUOTE|VALID|TYPE|KEYS|SEARCH)\b/i],
  ['tipo JSON', /\bJSON\b/i],
  ['FULLTEXT / índices fulltext', /\bFULLTEXT\b/i],
  ['ENUM / SET', /\bENUM\s*\(|\bSET\s*\(/i],
  ['TIMESTAMP con precisión', /\bTIMESTAMP\s*\(\d+\)/i],
  ['DATETIME con precisión', /\bDATETIME\s*\(\d+\)/i],
  ['UNSIGNED', /\bUNSIGNED\b/i],
  ['COMMENT en columna/tabla', /\bCOMMENT\s+'/i],
  ['LOCK TABLES / UNLOCK', /\b(LOCK TABLES|UNLOCK TABLES)\b/i],
  ['REPLACE INTO / INSERT IGNORE / ON DUPLICATE', /\b(REPLACE INTO|INSERT IGNORE|ON DUPLICATE KEY)\b/i],
  ['funciones de fecha MySQL', /\b(DATE_FORMAT|NOW\(\)|CURDATE|SYSDATE|UTC_TIMESTAMP)\b/i],
  ['GROUP_CONCAT', /\bGROUP_CONCAT\b/i],
  ['CAST con tipos MySQL', /\bCAST\s*\([^)]*\b(CHAR|BINARY|SIGNED|UNSIGNED|DATETIME)\b/i],
]

const archivos = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort()
const lineas = [`Migraciones revisadas: ${archivos.length}`, '']
const totales = new Map()
const cuenta = (sql, patron) => (sql.match(new RegExp(patron.source, patron.flags.includes('g') ? patron.flags : patron.flags + 'g')) ?? []).length
for (const archivo of archivos) {
  const sql = readFileSync(join(DIR, archivo), 'utf8')
  const hallazgos = []
  for (const [nombre, patron] of PATRONES) {
    const veces = cuenta(sql, patron)
    if (veces > 0) {
      hallazgos.push(`${nombre} x${veces}`)
      totales.set(nombre, (totales.get(nombre) ?? 0) + veces)
    }
  }
  lineas.push(`${archivo}: ${hallazgos.length === 0 ? 'SQL estándar' : hallazgos.join(' · ')}`)
}

// Segunda mitad: el SQL que vive en el código Java (JdbcTemplate). Un DDL portable no sirve si las
// consultas usan funciones del motor.
const JAVA = new URL('../../../backend/src/main/java/', import.meta.url).pathname.replace(/^\//, '')
const PATRONES_JAVA = [
  ['SELECT ... FOR UPDATE (SQLite no lo soporta)', /\bFOR UPDATE\b/i],
  ['funciones JSON_*', /\bJSON_(OBJECT|ARRAY|EXTRACT|CONTAINS|ARRAYAGG|QUOTE|UNQUOTE|VALID|TYPE|KEYS|SEARCH)\b/i],
  ['GROUP_CONCAT', /\bGROUP_CONCAT\b/i],
  ['DATE_FORMAT / funciones de fecha', /\b(DATE_FORMAT|NOW\(\)|CURDATE|SYSDATE|UTC_TIMESTAMP)\b/i],
  ['ON DUPLICATE / REPLACE INTO', /\b(REPLACE INTO|INSERT IGNORE|ON DUPLICATE KEY)\b/i],
  ['backticks', /`[a-z_]+`/i],
  ['CAST con tipos MySQL', /\bCAST\s*\([^)]*\b(CHAR|BINARY|SIGNED|UNSIGNED|DATETIME)\b/i],
  ['INTERVAL aritmético', /\bINTERVAL\b/i],
]
const javaFiles = []
const recorrer = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) recorrer(join(dir, e.name))
    else if (e.name.endsWith('.java')) javaFiles.push(join(dir, e.name))
  }
}
recorrer(JAVA)
const totalesJava = new Map()
for (const archivo of javaFiles) {
  const src = readFileSync(archivo, 'utf8')
  for (const [nombre, patron] of PATRONES_JAVA) {
    const veces = cuenta(src, patron)
    if (veces > 0) totalesJava.set(nombre, (totalesJava.get(nombre) ?? 0) + veces)
  }
}
lineas.push('', `Archivos Java revisados: ${javaFiles.length}`)
lineas.push('Construcciones MySQL en consultas Java:')
lineas.push('', 'Totales por construcción:')
for (const [nombre, n] of [...totales.entries()].sort((a, b) => b[1] - a[1])) {
  lineas.push(`  migraciones · ${nombre}: ${n}`)
}
for (const [nombre, n] of [...totalesJava.entries()].sort((a, b) => b[1] - a[1])) {
  lineas.push(`  java · ${nombre}: ${n}`)
}
const salida = process.argv[2]
if (salida) writeFileSync(salida, lineas.join('\n'), 'utf8')
console.log(lineas.join('\n'))
