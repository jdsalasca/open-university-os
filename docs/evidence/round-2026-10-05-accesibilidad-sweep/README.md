# Barrido de accesibilidad en once rutas y dos temas — 5 de octubre de 2026

Las rondas anteriores midieron contraste en seis rutas y tocaron solo un tipo de enlace. Este barrido
cubre lo que faltaba: once rutas (las nueve de `App.tsx` más dos subrutas), dos temas, y tres
dimensiones además del contraste.

## Contraste: 0 fallos

Once rutas en tema oscuro, cada elemento con texto propio medido contra su fondo:

```
#resumen 0 · #estudiantes 0 · #biblioteca 0 · #avisos 0 · #avisos-admin 0 · #programas 0
#inicio 0 · #academia 0 · #admisiones 0 · #espacios 0 · #accesos 0        TOTAL: 0
```

Medición en `barrido-nueve-rutas.txt`. Cuatro rutas —estudiantes, biblioteca, avisos y accesos— no las
había medido ninguna ronda anterior y salieron limpias.

## Nombres accesibles: 0 fallos

422 elementos interactivos revisados en once rutas por dos temas. Todos tienen nombre por `aria-label`,
`aria-labelledby`, `<label for>`, label envolvente, `title`, `placeholder` o texto propio.

## Área táctil: 74 enlaces por debajo de 24 px

Aquí sí había defecto. Entre 12 y 21 px de alto:

| Ruta | Enlaces | Alturas |
| --- | ---: | --- |
| `/#espacios` | 10 | 12–14 px |
| `/#estudiantes` | 2 | 17–20 px |
| `/#admisiones` | 2 | 12 px |
| `/#programas` | 12 | 17–21 px |

Todos son enlaces de fuente oficial o de referencia. Se pueden pulsar, pero no con facilidad, y
WCAG 2.2 pide 24 px como área táctil mínima (2.5.8, nivel AA).

Los 68 `<input>` de 1×1 que aparecen en la medición **no son un defecto**: son los radios del selector
de tema, ocultos con `clip` dentro de un `<label>` de 34×32 px. El área real es la del label, y el
clic en cualquier punto funciona. Un guard que los contara daría 142 falsos positivos.

## El arreglo

La técnica es la que ya usaba `.spaces-map-link`: `padding-block` suficiente y un `margin-block`
negativo que compensa. El área crece sin mover el diseño.

```scss
.spaces-announcement-references a { display: inline-flex; align-items: center; min-height: 24px; padding-block: 7px; margin-block: -7px; }
```

Se aplicó a siete reglas en cuatro archivos: `.student-service-card-bottom a`,
`.student-academic-calendar-provenance a`, `.admissions-official-source a`,
`.spaces-pathway-sources a`, `.spaces-announcement-references a`, `.spaces-directory-footer a`,
`.public-program-source-note a` y `.public-program-card h3 a`.

**Verificado en el navegador después del cambio: 0 enlaces por debajo de 24 px en las cuatro rutas**
(`enlaces-pequenos-despues.txt`). Capturas del antes en `01-estudiantes-antes.png` a
`04-programas-antes.png`.

## El guard, y una lección sobre guards flojos

`check-source-link-area.node-test.mjs` exige que todo enlace con `display` declare `min-height` de
24 px o padding suficiente.

La primera versión **pasaba verde con el defecto presente**, y también pasaba verde después de quitar
el `padding-block` que arreglaba uno de los enlaces. Dos motivos:

1. Buscaba `.<clase>[^{]*` y el enlace de espacios se declara en una regla agrupada
   (`.spaces-map-link, .spaces-source-link`), así que el patrón no alcanzaba a capturar el cuerpo.
2. Filtraba reglas de color, subrayado y foco que mencionan la clase pero no llevan área.

La versión final busca el bloque que declara `display`, incluyendo el caso agrupado, y **se probó con
mutación**: quitar el `padding-block` de `.spaces-source-link` hace fallar la prueba, y restaurarla la
vuelve a verde. Un guard que no falla ante la violación que vigila es peor que no tener guard.

## Verificación

| Prueba | Resultado |
| --- | --- |
| `check-source-link-area` | 4 de 4 (con prueba de mutación) |
| `npm test` completa | **527 pruebas en 78 archivos** |
| `npm run lint` | 191 archivos, 116 reglas, sin avisos |
| `npm run build` | presupuestos verificados, 23.305 B CSS |

## Nota sobre el tamaño del texto

Algunos de estos enlaces usan 8 y 9 px de tipografía. Ampliar el área sin subir el tamaño es la
solución correcta aquí: el diseño compensa con jerarquía y color, y subir la tipografía en tarjetas
densas desbalancearía la rejilla. Queda anotado como decisión, no como descuido.
