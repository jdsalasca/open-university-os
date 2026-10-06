# Los estados que no se pintan — 6 de octubre de 2026

## Qué se iba a hacer

La ronda del 5 de octubre dejó anotado un pendiente vago: «los 63 candidatos estáticos de
`find-dark-badges.mjs` que no se renderizan en estas nueve rutas». Abrirlos estado por estado y
medirlos es exactamente el método que ya dio 26 defectos reales, así que toca hacerlo.

## Hallazgo 1: la auditoría anterior medía la portada

`auditar-axe.mjs` pedía la sesión de preview con un tiempo fijo de 2,5 s y comprobaba el texto
`modo preview`. Cuando el botón todavía no estaba pintado, la sesión no se emitía, las rutas
autenticadas caían a la portada y axe reportaba `page-has-heading-one` en `/#biblioteca`, que sí tiene
`<h1>` desde el commit anterior.

Dos errores en el script, ninguno en la aplicación:

- **espera fija**: ahora espera al botón con 25 s de margen y después espera a que cada ruta pinte su
  propio título. Si una ruta no llega, el script falla con el nombre de la ruta en vez de inventar un
  resultado.
- **texto equivocado**: el aviso de la portada dice `Desarrollador local · preview`, no `modo preview`.
- **sesiones sin revocar**: el script abría nueve rutas por tema y nunca cerraba la sesión. El backend
  tiene cupo y `medir-latencia.mjs` ya lo revocaba por eso. Ahora captura el token de la respuesta del
  `POST` y lo revoca al terminar.

El efecto se nota: con la sesión real, `#programas` renderiza la vista de escritura y aparece un
defecto que no se había medido nunca — el texto de carga del catálogo a **4,11:1** sobre `#f4f4f0`.
Corregido a `#6a6c62` (4,84).

## Hallazgo 2: 63 candidatos estáticos, 21 reales

`candidatos-renderizados.mjs` responde la pregunta que estaba pendiente: ¿cuáles de las 63 clases
candidatas aparecen de verdad en el DOM?

| | |
| --- | ---: |
| candidatos estáticos | 72 clases |
| **se renderizan en alguna ruta** | **21** |
| nunca se pintan | 51 |

Las 51 son reglas para estados que la plataforma todavía no permite. No son defectos de contraste; son
código escrito para un futuro. La lista de 21 está en `renderizadas-2026-10-06.txt`.

## Hallazgo 3: las 21 renderizadas dan 0, y el medidor tiene dientes

`medir-contraste.mjs` no se fía del veredicto de axe-core: sube por los ancestros hasta encontrar un
fondo opaco y calcula el ratio del texto propio de cada elemento, aplicando el umbral de AA correcto
(4,5 normal, 3 para texto grande). Resultado: **0 muestras por debajo de AA**.

Para comprobar que el medidor no devuelve cero porque no mira, sino porque de verdad no hay nada, se
quitó `.spaces-type-badge` de la lista consolidada del tema oscuro y se volvió a medir: **24 muestras
bajo AA**, con `.spaces-type-badge` a ratio 2,07 sobre su fondo crema. Al restituirlo, 0. El guard
`check-dark-theme-feedback` cubre esa clase.

## Hallazgo 4: dos guards se habían quedado desincronizados

`check-dark-theme-feedback` reconstruía a mano el selector de la lista consolidada, que ya tiene
veinte entradas y grows con cada tanda. Cuando se le añadieron `[class*='-access-']` y
`[class*='-empty-state']`, el selector escrito a mano dejó de coincidir y el guard quedó en rojo.

La solución no es reescribir el selector: es **localizar la regla por un fragmento estable**
(`.catalog-admin-locked` más el `:not(.identity-preview-surface)`) y comprobar que el selector
resultante contenga lo que cada caso necesita. Ahora el guard no puede desincronizarse por crecer la
lista.

## Verificación

- **axe-core: 0 violaciones** en las 9 rutas × 2 temas, con la sesión de preview emitida y revocada.
- **531 pruebas en 78 archivos**, guardas de Node en verde, lint sin avisos, build dentro de presupuesto.
- La lista consolidada suma `[class*='-empty-state']` y `.catalog-empty-art`, que también quedaban
  claros en oscuro.

## Nota sobre el presupuesto

`entryStyles` 23.700 → 23.800 y `programsStyles` 56.300 → 56.400. Son ~120 B por dos entradas en una
lista que ya existe, no por reglas nuevas. Queda anotado en `check-bundle-budget.mjs`.
