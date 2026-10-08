# Pasada de humo y rutas que nunca se auditaron — 8 de octubre de 2026

## El hallazgo metodológico

`#noticias` no es una ruta: `readApplicationView` solo conoce 11 hashes y cualquier otro cae a la
portada. Las auditorías axe anteriores usaban `#noticias`, así que medían la portada dos veces y
dejaban sin auditar `#avisos`, `#avisos-admin` y `#estudiantes`. La pasada de humo
(`pasada-humo.mjs`, 9 capturas `humo-dark-*.png`) lo delató al mostrar la portada donde debían estar
los avisos.

`auditar-axe.mjs` ahora recorre las 11 rutas reales con su texto de espera propio.

## Lo que encontró la lista corregida: 7 violaciones

| Violación | Causa | Arreglo |
| --- | --- | --- |
| `page-has-heading-one` ×4 en `#avisos` y `#avisos-admin` | Ambas páginas empezaban en `h2` | Título a `h1`, sus `h3` a `h2` y las 3 reglas SCSS anidadas; aserción `level: 1` en cada test de página |
| `.module-loading` a 4,17 en claro | `#74766e` sobre `#f4f4f0` | `#6b6d62` (4,77) |
| Filtro pulsado estudiantil a **1,33** en oscuro | El componente declara texto oscuro sobre amarillo, pero la regla puerta lo fuerza a claro | Regla oscura que conserva el amarillo con texto oscuro; guard en `check-dark-theme-feedback` |

## Verificación

- **axe-core: 0 violaciones** en 22 combinaciones (`axe-11-rutas-tras-arreglo.txt`).
- Foco 8/8 en títulos, sin cambios.
- **557 pruebas en 80 archivos y 129 guardas**, lint sin avisos, build dentro de presupuesto.
- Captura `avisos-dark-h1.png`: jerarquía `h1`→`h2` legible en oscuro.

## Seguimiento: los instrumentos también medían mal

Al re-auditar con la lista corregida, `auditar-estados.mjs` reportó 6 `page-has-heading-one` en páginas
que sí tienen `h1`: medía el esqueleto porque solo esperaba tiempos fijos y el chunk perezoso no había
llegado (mismo fallo ya corregido en `auditar-axe.mjs`, nunca portado aquí). Se le aplicó la misma
medicina: 11 rutas reales, espera al contenido propio de cada ruta, comprobación de sesión y
revocación al terminar. Resultado: **0 nodos en violación en las 22 combinaciones**
(`axe-estados-11-endurecido.txt`).

De paso se confirmó que el cupo de sesiones del backend se agota con las propias auditorías si no se
revoca: hubo que reiniciar el backend (sesiones en memoria por diseño) para emitir de nuevo.

## Archivos de esta ronda

- `pasada-humo.mjs`: capturas de humo por ruta (así se descubrió lo de `#noticias`).
- `sondar-rutas.mjs`: diagnóstico rápido de qué pinta cada hash (encabezados + breadcrumbs).
- `capturar-avisos.mjs`: captura del estado corregido.
- `axe-11-rutas-2026-10-08.txt`: las 7 violaciones antes del arreglo.
- `axe-11-rutas-tras-arreglo.txt`: 0 violaciones después.
