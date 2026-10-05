# Mutación de las guardas: ¿fallan cuando deben? — 5 de octubre de 2026

Una suite verde no dice nada si sus pruebas no tienen dientes. La ronda del error de la API encontró un
guard que aceptaba una fuga real sin rechistar. Aquí se comprueba, uno por uno, qué ocurre cuando se
introduce la violación que cada guard dice impedir.

## Método

Para cada guarda: copia del archivo, mutación de la condición vigilada, **comprobación de que la
mutación se aplicó de verdad**, ejecución del guard y restauración.

La comprobación de aplicabilidad no es un detalle. Durante esta ronda el guard de contraste "pasó" con
una reintroducción de color inyectada, pero la mutación **no se había aplicado**: el color buscado ya no
estaba en el archivo elegido porque todas sus apariciones son ahora el token. Un guard que pasa porque
la prueba no probó nada es indistinguible de un guard roto.

## Resultado

| Guarda | Mutación aplicada | Detecta |
| --- | --- | --- |
| `check-theme-palette` | Token `--ui-text-muted` de `#6b6d63` (ratio 4,57) a `#9a9b92` (ratio 2,64) | **sí** |
| `check-boot-state` | `<div id="root">` vuelve a quedar vacío | **sí** |
| `check-api-surface` | El cliente pide `/api/v1/spaces-inexistente` | **sí** |
| `check-error-states` | Se sustituye «Reintentar» por «Ver detalle» | **sí** |
| `check-text-contrast-tokens` | Se reintroduce `#989990`, uno de los 36 colores sustituidos | **sí** |
| `check-responsive-shell` | Se elimina la regla `.module-loading-tall` | **no, al principio** |

## El hallazgo

La última fila importa. `.module-loading-tall` es la reserva que **bajó el CLS de la carga inicial de
`/#programas` de 0,7503 a 0,0064**. Al borrar esa regla la suite completa pasaba igual: nadie podía
saber que el arreglo había desaparecido.

Se añadió una prueba que exige la regla con la altura medida y con `align-content: start`, y se
comprobó que ahora **falla al borrarla** y vuelve a verde al restaurarla.

## El método falló una vez

Al verificar `check-text-contrast-tokens` se cambió `var(--ui-text-muted)` por `#989990` en
`SpaceGuidePage.scss`. El guard pasó. La explicación no fue que estuviera roto, sino que **ese color ya
no existía en ese archivo**: la mutación no tenía nada sobre qué actuar. Repetida sobre
`PublicProgramDirectory.scss`, que sí usa el token, el guard falló como debía.

Comprobación de aplicabilidad antes de cada mutación:

```powershell
$antes = (Get-FileHash $f).Hash
# ... mutacion ...
if ((Get-FileHash $f).Hash -eq $antes) { "MUTACION NO APLICO - abortando" }
```

## Verificación

- `npm test`: **521 pruebas Vitest en 77 archivos, más 76 guardas de Node**, todas aprobadas
  (`vitest.txt`). La guarda nueva es la de la reserva de altura.
- Cada mutación se restauró una a una; `git status` queda limpio salvo el test añadido.

## Pendiente

Solo se comprobaron por mutación los guards escritos en estas rondas. Quedan sin verificar
`check-bundle-budget`, `check-dark-theme-feedback`, `check-test-timeouts` y `check-touch-targets`.
`ApiErrorExposureGuardTest` ya tiene una prueba negativa registrada en
[la evidencia de errores de la API](../round-2026-10-05-errores-api/README.md).
