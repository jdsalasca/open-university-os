# El detector de recortes contaba decoración como texto perdido — 5 de octubre de 2026

La ronda de responsive dejó 25 recortes "sin revisar". Esta los clasifica uno por uno, corrige el único
defecto real que aparecía y deja el detector con un criterio que ya no necesita revisión manual.

## El problema de fondo estaba en el detector

Los 25 reportes se medían elemento por elemento. Salieron así:

| Elemento | Reportado | Realidad |
| --- | --- | --- |
| `catalog-empty` | 103 px | círculos `::before`/`::after` de 220 px en `top: -134px; left: -70px` |
| `identity-preview-surface` | 22 px | ya resuelto en la ronda del preview hero |
| heroes de espacios, admisiones y accesos | 46–48 px | figura decorativa absoluta dentro del marco |
| `identity-session-status` | 11–28 px | **texto perdido, corregido en la ronda anterior** |

El detector contaba como "contenido perdido" cualquier desborde, incluidos los círculos decorativos
que `overflow: hidden` recorta a propósito. Un detector así obliga a revisar 25 casos a mano cada vez.

### El criterio corregido

> Si el elemento se desborda pero **ningún hijo directo en el flujo** excede el ancho visible, lo que
> excede no es texto: son pseudo-elementos o una figura posicionada.

Dos matices que hicieron falta, ambos con el caso real medido delante:

1. Un hijo `position: absolute` que excede **también es decoración**. Los heroes llevan la figura
   dentro del contenedor, así que su `overflow: hidden` sigue siendo lo correcto.
2. Un margen de 1–2 px no cuenta.

El criterio está probado con markup real en `check-clip-detector.node-test.mjs`, incluidos los dos
casos que lo hicieron fallar en el camino.

## El defecto que sí era real

Después de aplicar el criterio quedaban 3 casos, y uno era un título cortado:

```
.role-access-hero a 360 px
  visible 332, contenido 380
  <h1> "Accesos y perfiles": 78 px visibles de 98 px de contenido
```

El heroe mantiene `grid-template-columns: minmax(0, 1fr) 78px` en móvil, y la columna de la marca
decorativa de 76 px se queda con el ancho que necesita el título.

### El arreglo

```scss
@media (max-width: 600px) {
  .role-access-hero { grid-template-columns: minmax(0, 1fr); }
  .role-access-hero-mark { display: none; }
}
```

En un ancho de una sola columna la marca decorativa no compite con el texto. Captura en
`01-hero-accesos-360-despues.png`: "Accesos y perfiles" completo, con la marca retirada.

## Resultado del barrido clasificado

Cuatro anchos (360, 768, 1024, 1440 px) por diez rutas, **40 combinaciones**:

```
TOTAL elementos con contenido perdido: 0
TOTAL con decoracion que sobresale a proposito: 20
```

Los 20 restantes son círculos decorativos en estados vacíos, figuras de los heroes y el marco del
preview de identidad. Está declarado, no es un pendiente.

## Pruebas

| Guarda | Qué cubre |
| --- | --- |
| `check-clip-detector` | el criterio de clasificación, con los casos reales de `catalog-empty`, `spaces-hero` y `identity-session-status` |
| `check-role-access-hero` | que el heroe de accesos no compita con su marca en móvil, y que el título no lleve recorte propio |

## Verificación

| Prueba | Resultado |
| --- | --- |
| `check-clip-detector` | 5 de 5 |
| `check-role-access-hero` | 3 de 3 |
| `npm test` completa | **530 pruebas en 78 archivos, 104 guardas de Node** |
| `npm run lint` | 197 archivos, 116 reglas, sin avisos |
| `npm run build` | presupuestos verificados, CSS sin cambios |
