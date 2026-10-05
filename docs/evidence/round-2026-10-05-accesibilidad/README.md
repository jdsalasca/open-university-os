# Contraste de texto en tema claro — 5 de octubre de 2026

Audita las seis rutas públicas en tema claro y oscuro, mide el contraste WCAG real del texto pintado
y sustituye los colores de texto secundario que quedaban por debajo de AA.

## Herramienta

`audit-a11y.cjs` no usa paquetes nuevos: recorre el DOM en Chromium headless, calcula el ratio WCAG
de cada nodo de texto contra el fondo real y además mide nombres accesibles de controles, jerarquía de
títulos y etiquetas de formulario. Escribe `a11y.json`.

Dos correcciones fueron necesarias para que el informe fuera fiable, ambas sobre la herramienta y
no sobre el producto:

1. **Elementos que no se pintan.** `getComputedStyle(el).display` devuelve el display propio aunque
   el ancestro esté oculto, así que la barra inferior móvil (oculta en escritorio) aparecía como 165
   hallazgos falsos. El filtro correcto es `getClientRects().length === 0` más recorrer ancestros.
2. **Texto claro sobre superficie oscura.** El recorrido no compone gradientes ni imágenes de
   fondo. El `h1` del hero de espacios es blanco sobre `rgb(30,36,28)` con ratio real ~15,8, pero la
   herramienta calculó 1,10 porque el recorrido de ancestros no vio ese fondo. Por eso solo se
   reportan textos oscuros, donde el fondo recorrido sí es una superficie clara y el ratio es
   aritmética exacta.

Sin ese filtro la herramienta habría reportado 43 colores y la mayoría no eran defectos reales.

## Causa raíz

`_theme.scss` define tokens `--ui-*` **solo para el tema oscuro**. No existe un bloque equivalente
para el tema claro, así que cada componente codifica sus grises a mano. Ahí está el origen de la
inconsistencia: el tema oscuro audita en 0 y el claro acumula cientos de textos bajo AA.

## Sustituciones

Seis colores de texto sustituidos por su equivalente accesible, escalando los tres canales por el
mismo factor para conservar el tono:

| Original | Ratio | Sustituto | Ratio | Usos en código |
| --- | --- | --- | --- | ---: |
| `#85877d` | 3.31 | `#6e7067` | 4.57 | 4 |
| `#989990` | 2.61 | `#6f7069` | 4.55 | 3 |
| `#77786f` | 4.05 | `#6f7067` | 4.55 | 32 |
| `#777970` | 4.01 | `#6e7068` | 4.55 | 12 |
| `#7b7d72` | 3.79 | `#6e7066` | 4.56 | 2 |
| `#797a72` | 3.94 | `#6f7068` | 4.55 | 1 |

Los ratios se calculan sobre las tres superficies reales: `#f4f4f0` (fondo de página), `#ffffff` y
`#fafaf6`. El objetivo se fijó en 4,55 para dejar margen sobre 4,5; el primer cálculo propuso `#6f7168` a 4,49, que la guarda de Node
rechazó.

15 archivos SCSS modificados. Ningún color sustituido se usaba como fondo ni borde, solo como
`color:`.

## Resultado

Textos oscuros bajo WCAG AA, por ruta y tema:

| Ruta | Claro antes | Claro después | Oscuro antes | Oscuro después |
| --- | ---: | ---: | ---: | ---: |
| `/#resumen` | 11 | **1** | 0 | 0 |
| `/#programas` | 151 | **37** | 1 | 1 |
| `/#espacios` | 195 | **88** | 0 | 0 |
| `/#admisiones` | 40 | **31** | 0 | 0 |
| `/#estudiantes` | 34 | **0** | 0 | 0 |
| `/#academia` | 13 | **8** | 1 | 1 |
| **Total** | **444** | **165** | 2 | 2 |

Una reducción del **63 %** y el tema oscuro intacto. El rediseño es visualmente imperceptible: los
sustitutos se separan del original entre 6 y 30 unidades por canal manteniendo el tono.

Capturas revisadas: `espacios-claro.png` y `espacios-oscuro.png` mantienen jerarquía y legibilidad;
`programas-*.png` y `estudiantes-*.png` idem.

## Verificación

- `frontend/scripts/check-text-contrast-tokens.node-test.mjs`: 2 guardas. La primera falla si
  cualquiera de los seis colores sustituidos reaparece en cualquier `.scss`; la segunda comprueba por
  aritmética que los sustitutos alcanzan 4,5 sobre cada superficie. Ambas se escribieron antes del
  cambio y fallaron.
- `npm test`: **518 pruebas Vitest en 77 archivos, más 49 guardas de Node**, todas aprobadas
  (`vitest.txt`). Los archivos se añaden al script `npm test` para que la CI los ejecute.
- `npm run build`: aprobado, presupuestos verificados (`build.txt`); CSS de entrada 22 478 B de 22 500.
- `npm run lint`: 0 avisos, 0 errores en 181 archivos (`lint.txt`).

Una corrida intermedia de `AcademicOperationsPage.test.tsx` agotó los 30 s por un pico de saturación
del host; aislado pasa 37/37 en 19,4 s y la corrida completa registrada pasa entera.

## Áreas táctiles

La primera medición contaba 61 controles con área menor de 24 px. Al revisarlos uno a uno, la mayoría
**no eran defectos**:
**no eran defectos**:

- 3 `input` de 1×1 px: los radios del selector de tema, ocultos con `clip`. Son accesibles por teclado
  y anunciados, pero no son un objetivo de puntero. El auditor ahora los excluye.
- 44 enlaces de texto en línea dentro de una tarjeta o fila que actúa como objetivo: la caja del
  enlace medía 20–21 px, pero el contenedor llega a 40–48 px. WCAG 2.2 (2.5.8) admite que el objetivo
  sea ese contenedor, así que tampoco son defectos.

Dos sí lo eran, y se corrigieron:

1. **Enlaces de mapa y de fuente de la ficha de espacios**: 12 px de alto sin contenedor que
   compensara. Con `padding-block: 6px` más `margin-block: -6px` el área llega a 24 px sin mover el
   diseño; las capturas confirman que las tarjetas quedan igual.
2. **Campo de búsqueda**: el contenedor mide 43 px pero el input dentro solo 15 px, de modo que el clic
   en los lados del campo no lo enfocaba. Con `align-self: stretch` el input cubre toda la altura.

| Controles con área menor de 24 px | Antes | Después |
| --- | ---: | ---: |
| En las doce combinaciones de ruta y tema | 61 | **0** |

`frontend/scripts/check-touch-targets.node-test.mjs` protege los tres cambios: el área de los enlaces
de ficha con su margen compensatorio, el estirado del input y la etiqueta envolvente del buscador.

## Pendiente

- Quedan 165 textos bajo AA en tema claro. Son de otro grupo: tonos khaki/beige
  (`#8d8972`, `#8a8a7a`, `#7a7c6c`) propios de admisiones, catálogo y espacios. Mismo método
  aplicable.
- El tema claro carece de tokens `--ui-*`. Definirlos y migrar los componentes es la solución de
  fondo; este corte ataca el síntoma con los colores de mayor uso.
- La auditoría no cubre foco visible por teclado ni orden de tabulación; exige recorrido manual o
 AXE, que no está en las dependencias del proyecto.
