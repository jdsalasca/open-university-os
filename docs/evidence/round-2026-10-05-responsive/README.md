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

La primera corrección no bastó: el monogram seguía en `-24..14 px`. La causa era de especificidad, no de
ancho. La regla base es `.brand-lockup { .brand-lockup-copy { display: grid } }`, anidada, con
especificidad 0,2,0; el `.brand-lockup-copy { display: none }` del tramo de 850 px tiene 0,1,0 y pierde
aunque el media query vaya después. El texto seguía ocupando 66 px y empujaba el monogram. El selector
del tramo pasa a `.brand-lockup .brand-lockup-copy`, con dos clases.

Medido en el navegador tras el arreglo: una sola instancia de `.brand-monogram`, hija de
`a.brand-lockup`, dentro del carril y centrada.

### 4. La suite abortaba pruebas legítimas en un host cargado

Con el arreglo anterior, cinco corridas seguidas dejaron **13 pruebas en rojo**, siempre en un archivo
distinto y siempre el más pesado: `PublicProgramDirectories`, `VisualIdentityCenter`,
`AcademicCatalogPage`, `AcademicOperationsPage`. Los archivos tardaban 14–35 s y Vitest aborta a los 5 s
por defecto, mientras que `findBy` de Testing Library espera 1 s. El componente implicado resuelve su
contenido con `lazy()` e import dinámico.

No era una regresión del cambio: la CI alojada pasaba entera. Era la suite siendo frágil ante una
máquina lenta, algo que afecta a cualquier persona que la ejecute en un portátil cargado. Los timeouts
pasan a declararse de forma explícita:

- `testTimeout` y `hookTimeout`: 30 000 ms en `vite.config.ts`.
- `asyncUtilTimeout`: 15 000 ms en `src/test/setup.ts`.

| Medida | Antes | Después |
| --- | --- | --- |
| Fallos en 5 corridas | 13 | 0 |
| Corridas limpias seguidas | 0 de 5 | 3 de 3 |

## Falsos positivos descartados

- `span.theme-selector-label`: el texto de las opciones de tema se oculta con `clip` y 1×1 px para
  lectores de pantalla. No es texto visible.
- «Consultada 1 de oct de 2026»: es el formato corto de mes de `formatDate`, no un recorte. La medición
  confirma `scrollWidth === clientWidth` (274 px) y `white-space: normal`.
- `.spaces-hero-art` en móvil: el arte decorativo sangra del borde por diseño y el documento no genera
  scroll (`scrollWidth` 390 = viewport 390).

`audit-responsive.cjs` ahora excluye el texto solo-lector-de-pantalla para que el informe sea accionable.

## Verificación

- `frontend/scripts/check-responsive-shell.node-test.mjs`: 6 guardas que compilan el SCSS y comprueban el
  corte del chip, la ausencia de `min-width` en la barra, el tamaño táctil del selector de tema, la
  especificidad del copy colapsado, el ancho de la marca y el breakpoint del panel de espacios.
- `frontend/scripts/check-test-timeouts.node-test.mjs`: 2 guardas que impiden que los timeouts vuelvan a
  los valores por defecto.
- `npm test`: **518 pruebas Vitest en 77 archivos, más 42 guardas de Node**, todas aprobadas
  (`vitest.txt`). Los dos archivos de guardas están en el script `npm test`, así que la CI los ejecuta.
- `npm run build`: aprobado, presupuestos verificados (`build.txt`); el CSS de entrada queda en 22 478 B
  de 22 500.
- `npm run lint`: 0 avisos, 0 errores en 179 archivos (`lint.txt`).
- Navegador: las seis rutas de tablet quedan en `ok` y las cinco de móvil también; solo
  `movil/espacios` reporta elementos fuera de viewport, que son las órbitas decorativas del hero y no
  generan scroll (`scrollWidth` 390 = viewport 390).
- CI: [run 37266400707](https://github.com/jdsalasca/open-university-os/actions/runs/37266400707)
  verde en `Tests, build, and lint` y en `Maven tests and MySQL contracts`.