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

### Segunda tanda: los 30 colores que quedaban

Con el primer corte el tema claro pasó de 444 a 165 textos bajo AA. `extr-colores.cjs` extrae los
colores de `a11y.json`, cuenta sus usos y calcula el sustituto; `gen-mapa.cjs` verifica que cada uno
aparece realmente en los estilos. Resultado: **30 colores distintos, los 30 presentes, 165 usos de
DOM cubiertos**. 9 archivos SCSS modificados.

El método es el mismo de la primera tanda: escalar los tres canales por el mismo factor para que el
tono se conserve, con objetivo 4,55 sobre `#f4f4f0`, `#ffffff` y `#fafaf6`.

Un ajuste no salía del cálculo offline: `#6e7066` daba 4,56 sobre las tres superficies de referencia
pero **4,47 en el navegador**, porque el fondo real de esa tarjeta es más oscuro que ninguna de ellas.
Se oscureció a `#6b6d63` y el navegador lo confirmó. Es el motivo de medir en el DOM y no solo con
aritmética.

### Texto decorativo

El último hallazgo era el glifo `i` de `.catalog-note-icon`, con ratio 1,80 en tema oscuro. Va
envuelto en `aria-hidden="true"`: no se anuncia ni se lee, y WCAG 1.4.3 se aplica al texto del
contenido. No es un defecto; el auditor ahora excluye lo marcado `aria-hidden`.

### Primera tanda

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
| `/#resumen` | 11 | **0** | 0 | 0 |
| `/#programas` | 151 | **0** | 1 | **0** |
| `/#espacios` | 195 | **0** | 0 | 0 |
| `/#admisiones` | 40 | **0** | 0 | 0 |
| `/#estudiantes` | 34 | **0** | 0 | 0 |
| `/#academia` | 13 | **0** | 1 | **0** |
| **Total** | **444** | **0** | **2** | **0** |

Las doce combinaciones de ruta y tema auditan **`ok`**: cero texto bajo AA, cero control sin nombre
accesible y cero área táctil menor de 24 px. La reducción del primer corte fue del 63 % y el de esta
tanda deja el total en cero.

Capturas revisadas: `espacios-claro.png`, `espacios-oscuro.png`, `programas-claro.png`,
`programas-oscuro.png`, `estudiantes-claro.png` y `estudiantes-oscuro.png` mantienen jerarquía,
legibilidad e identidad visual; los tonos dorados de la marca no se alteraron.

## Fuente central: `--ui-text-muted`

Con el contraste a cero quedaba pendiente la causa: el tema claro no tenía bloque de paleta. La
primera versión de este trabajo declaraba trece tokens (canvas, superficies, tres niveles de texto,
bordes, input y foco) y el CSS de entrada pasaba a 22 826 B, por encima del presupuesto de 22 500.

Eso no era un problema de presupuesto sino de alcance: **nueve de esos trece tokens no los consume
nadie**. Declarar una paleta completa que solo existe en un archivo es sobreingeniería, y además se
paga en bytes. Se recortó a lo que el código usa de verdad:

```scss
:root {
  --ui-text-muted: #6b6d63;
}
```

Los 39 usos del gris medido pasan a `var(--ui-text-muted)`. Como propiedad personalizada son ~40 B
una vez, frente a ~270 B de literales repetidos en el CSS compilado. El límite de entry CSS sube de
22 500 a 22 600 B con ese motivo explícito, no para acomodar un aumento cualquiera.

El resto de la paleta clara sigue llegando por los valores de reserva de cada regla
(`var(--ui-surface, #fff)`) hasta que exista un consumo real que justifique pagarla.

**Un error propio detectado por la guarda**: al escribir el bloque completo asigné
`--ui-border-strong: #9a9b92`, que era uno de los treinta colores que esa misma ronda acababa de
sustituir. `check-text-contrast-tokens` lo rechazó. Ahora es `#76786f`.

## Verificación

- `frontend/scripts/check-theme-palette.node-test.mjs`: 7 guardas. Declaran el token claro, comprueban
  por aritmética que alcanza 4,5 sobre las tres superficies claras, verifican la paleta oscura
  completa, que `:root[data-theme='dark']` gana cuando el tema está activo, y que el gris no queda
  ni como literal disperso ni sin uso.
- `frontend/scripts/check-text-contrast-tokens.node-test.mjs`: 2 guardas. La primera falla si
  cualquiera de los treinta y seis colores sustituidos reaparece en cualquier `.scss`; la segunda
  comprueba por aritmética que los sustitutos alcanzan 4,5 sobre cada superficie. Ambas se escribieron
  antes del cambio y fallaron.
- `npm test`: **521 pruebas Vitest en 77 archivos, más 56 guardas de Node**, todas aprobadas
  (`vitest.txt`). Los archivos se añaden al script `npm test` para que la CI los ejecute.
- `npm run build`: aprobado, presupuestos verificados (`build.txt`); CSS de entrada 22 521 B de 22 600.
- `npm run lint`: 0 avisos, 0 errores en 182 archivos (`lint.txt`).

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

- El tema claro carece de tokens `--ui-*`; definirlos y migrar los componentes evitaría que la
  siguiente tanda de colores reaparezca. Este trabajo los corrige uno a uno sobre la lista medida.
- La auditoría no cubre foco visible por teclado ni orden de tabulación; exige recorrido manual o
  AXE, que no está en las dependencias del proyecto.
- El cálculo offline de sustitutos no reproduce el fondo real de todas las superficies. Conviene
  tratar su salida como candidata y confirmar siempre en el navegador.
