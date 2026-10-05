# Responsive de las rutas públicas — 5 de octubre de 2026

Audita las seis rutas públicas en móvil (390×844) y tablet (768×1024) con Chromium headless. El
protocolo del repositorio exige revisar responsive, y esta era la primera medición.

## Resultado

| Viewport | Rutas | Scroll horizontal | Recorte de texto |
| --- | --- | --- | --- |
| Tablet 768 px | 6 | **0 (antes 5)** | 0 |
| Móvil 390 px | 6 | 0 | 0 |

`audit-responsive.cjs` mide `documentElement.scrollWidth` contra `clientWidth`, y recorre el árbol
buscando elementos cuyo texto visible se pierde. Las capturas y el detalle por elemento quedan en
`responsive.json` y en los PNG.

## Defectos encontrados y corregidos

### 1. Scroll horizontal en tablet en cinco de seis rutas

La barra superior suma ruta, estado, un chip decorativo, el selector de tema y el botón de sesión. A
768 px el conjunto medía 573 px y el documento llegaba a 786–817 px de ancho: el botón «Entrar al
preview local» quedaba fuera de pantalla y el contenido se desplazaba de lado a lado.

El chip (`PORTAL UNIVERSITARIO`, `ESPACIOS · GUÍA`, …) repite el contexto que ya da el breadcrumb, así
que es lo prescindible. Se oculta como máximo 1120 px en `App.scss`.

| Ruta | Antes | Después |
| --- | --- | --- |
| `/#resumen` | 802 px | 768 px |
| `/#programas` | 786 px | 768 px |
| `/#espacios` | 817 px | 768 px |
| `/#admisiones` | 796 px | 768 px |
| `/#academia` | 787 px | 768 px |

### 2. La guía de espacios no entraba a 768 px

El panel de búsqueda declara cuatro columnas (`minmax(240px, 1fr) repeat(2, minmax(155px, 210px))
auto`) y solo bajaba a dos columnas bajo 760 px. Un viewport de tablet de 768 px quedaba ocho píxeles
fuera del corte: el panel pedía unos 692 px en un área útil de 648 px y el contador de resultados
empujaba el documento a 817 px. El tramo pasa a 900 px.

### 3. La marca del sidebar colapsado se salía del carril

A 768 px el sidebar baja a un carril de 68 px. `.brand-lockup` conservaba 115 px de ancho, de modo que
su monograma quedaba en `-24..14 px`, cortado por el borde izquierdo. Se le fija `width: 100%`, que ya
lo corrige al ancho del carril.

## Falsos positivos descartados

- `span.theme-selector-label`: el texto de las opciones de tema se oculta con `clip` y 1×1 px para
  lectores de pantalla. No es texto visible.
- «Consultada 1 de oct de 2026»: es el formato corto de mes de `formatDate`, no un recorte. La medición
  confirma `scrollWidth === clientWidth` (274 px) y `white-space: normal`.
- `.spaces-hero-art` en móvil: el arte decorativo sangra del borde por diseño y el documento no genera
  scroll (`scrollWidth` 390 = viewport 390).

`audit-responsive.cjs` ahora excluye el texto solo-lector-de-pantalla para que el informe sea accionable.

## Verificación

- `frontend/scripts/check-responsive-shell.node-test.mjs`: 5 guardas que compilan el SCSS y comprueban
  el corte del chip, la ausencia de `min-width` en la barra, el tamaño táctil del selector de tema, el
  ancho de la marca colapsada y el breakpoint del panel de espacios. Las tres primeras y la quinta se
  escribieron primero y fallaron antes del arreglo.
- `npm test`: **518 pruebas Vitest en 77 archivos, más 41 guardas de Node**, todas aprobadas
  (`vitest.txt`). El nuevo archivo de guardas se añadió al script `npm test`, así que la CI lo ejecuta.
- `npm run build`: aprobado, presupuestos verificados (`build.txt`); el CSS de entrada sube 39 B por las
  reglas responsivas y queda en 22 464 B de 22 500.
- `npm run lint`: 0 avisos, 0 errores en 178 archivos (`lint.txt`).
- Navegador: `tablet-espacios.png` y `movil-espacios.png` muestran el panel en dos columnas y en una
  columna respectivamente, sin desbordes. El resto de rutas quedó en `ok`.

## Pendiente

`.brand-monogram` sigue reportándose en `-24..14 px` a 768 px aunque `.brand-lockup` ya mide 52 px
dentro del carril y `justify-content: center` debería centrar un hijo de 38 px. El elemento medido no
resulta ser hijo del enlace que devuelve `querySelector('.brand-lockup')`, así que hay más de una
instancia de `.brand-monogram` en el documento. No genera scroll y el efecto visual es un cuadrado de
38 px parcialmente fuera del carril; queda por localizar la instancia correcta.