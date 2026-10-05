# Teclado, consola y estado de arranque — 5 de octubre de 2026

Cierra el último pendiente de accesibilidad del portal: foco visible por teclado, fugas de consola y
el estado de carga antes de que monte la aplicación.

## Foco visible por teclado
La primera versión de `audit-foco.cjs` reportó 67 controles sin indicador de foco. **Era un defecto de
la herramienta, no del portal**, y corregirlo exigía dos correcciones sobre la herramienta:

1. `element.focus()` desde script no siempre activa `:focus-visible`. El recorrido usa `Tab` real
   mediante `Input.dispatchKeyEvent` de CDP, como una persona tecleando.
2. Sin resetear el foco, el primer `Tab` no parte del inicio del documento y el enlace de salto no
   aparecía primero en las rutas académicas.

| Ruta | Controles recorridos | Sin indicador | Enlace de salto primero |
| --- | ---: | ---: | --- |
| `/#resumen` | 15 | 0 | sí |
| `/#programas` | 24 | 0 | sí |
| `/#espacios` | 24 | 0 | sí |
| `/#admisiones` | 15 | 0 | sí |

El input de búsqueda de espacios no lleva `outline` propio: su contenedor lo dibuja con
`:focus-within`. La herramienta ahora busca el indicador en el propio elemento y en sus dos ancestros
inmediatos, que es como se comporta un lector de pantalla al ver el foco.

**El teclado ya cumplía.** No había defecto que corregir, y no se reporta ninguno.

## Consola y red

`audit-consola.cjs` recorre las seis rutas públicas con la consola y la red activadas:

| Métrica | Resultado |
| --- | --- |
| Errores de consola | **0** en las seis rutas |
| Avisos | **0** |
| Peticiones con estado ≥ 400 | **0** |

Los eventos `loadingFailed` que aparecen son cancelaciones de peticiones al navegar, no fallos: la
herramienta los separa de los errores de estado.

## Defecto encontrado: la portada en blanco con red lenta

Este sí era un defecto real. `index.html` declaraba `<div id="root"></div>` vacío. Con la red
limitada a 25 kB/s, la portada `/#resumen` mostraba una **pantalla completamente en blanco** hasta que
descargaban los ~280 kB del bundle y montaba React: sin shell, sin navegación y sin ningún estado
de carga. El repositorio exige que toda pantalla tenga estado de carga, y el shell no puede depender
del propio JavaScript que todavía no ha llegado.

### Arreglo

```html
<div id="root">
  <div class="app-boot" role="status" aria-live="polite">Cargando la plataforma universitaria…</div>
</div>
```

React lo sustituye al montar. El texto es plano a propósito: hasta que llega el CSS del bundle el
bloque se ve sin estilo, y una línea de texto legible es mejor que un elemento gráfico suelto. La
primera versión llevaba un monograma con la letra «U» y, sin CSS aplicado, se veía una «U» desnuda en
la esquina. El repositorio prohíbe estilos en línea, así que no hay forma de centrarlo antes de que
cargue la hoja; se acepta texto plano a cambio de no mostrar un artefacto visual.

| Estado de carga anunciable | Antes | Después |
| --- | --- | --- |
| `/#resumen` | **0 regiones** | 1 (`role=status`) |
| `/#espacios` | 2 | 2 |
| `/#estudiantes` | 2 | 2 |
| `/#academia` | 2 | 2 |

`audit-montaje.cjs` confirma que tras montar quedan **0** marcadores y el shell presente, en tema claro
y oscuro, en dos rutas.

Capturas: `carga-resumen.png` con el texto legible sobre el arranque, y `montado-*.png` con el shell
completo tras el montaje.

## Estado de error con el backend caído

`audit-error.cjs` detiene el contenedor backend y recorre las seis rutas públicas. Ninguna queda rota
y ninguna muestra detalle de infraestructura.

| Ruta | Shell | Regiones de estado | Comportamiento |
| --- | --- | --- | --- |
| `/#resumen` | presente | 0 | Degrada a la identidad de respaldo: nombre, navegación y accesos siguen visibles. Es informativa y no necesita la API. |
| `/#programas` | presente | 3 | El directorio público sobrevive porque viene de una instantánea local (79 programas); solo el catálogo curricular avisa con «No se pudo cargar el catálogo». |
| `/#espacios` | presente | 1 | «No se pudo cargar la guía de espacios en este momento.» con botón **Reintentar**. |
| `/#admisiones` | presente | 1 | Degrada a la agenda pública de referencia: «No fue posible consultar la agenda versionada. Se conserva la información pública de referencia.» con **Reintentar**. |
| `/#estudiantes` | presente | 0 | Contenido editorial estático, no depende de la API. |
| `/#academia` | presente | 1 | «No fue posible cargar la información académica. Comprueba la conexión y vuelve a intentarlo.» con **Intentar de nuevo**. |

Capturas en `error-*.png`.

### Lo que la auditoría révélé sobre el diseño

Hay dos patrones distintos y ambos correctos:

- **Fallo bloqueante** (`/#espacios`, `/#academia`, el catálogo curricular): no hay nada que mostrar,
  así que se anuncia con `role="alert"` e interrumpe a quien está leyendo.
- **Degradación** (`/#admisiones`): la vista sigue siendo útil con la agenda pública de respaldo, así
  que usa `role="status"` (polite). Poner `alert` ahí sería interrumpir sin motivo.

La primera versión del guard exigía `role="alert"` en las cuatro vistas y fallaba con admisiones: el
guard estaba mal, no el producto. También buscaba el botón con la palabra «Reintentar» y la vista
académica escribe «Intentar de nuevo». `check-error-states.node-test.mjs` refleja los dos patrones y
las cuatro variantes de rótulo que usa el proyecto.

## Verificación

- `frontend/scripts/check-boot-state.node-test.mjs`: 5 guardas. Exigen contenido inicial en `#root`,
  que sea `role="status"` con texto visible real, que no lleve estilos en línea,
  el montaje siga ocurriendo por `main.tsx`. Las cinco fallaron antes del cambio.
- `frontend/scripts/check-theme-palette.node-test.mjs`: se ajustó para distinguir un literal **fijado
  en una regla** de un literal usado como **valor de reserva de `var()`**. El `index.scss` usa
  `var(--ui-text-muted, #6b6d63)` y la guarda lo rechaza como si fuera un color suelto.
- `npm test`: **521 pruebas Vitest en 77 archivos, más 72 guardas de Node**, todas aprobadas
  (`vitest.txt`).
- `npm run build`: aprobado; el CSS de entrada sube a 22 650 B de 22 700 (`build.txt`).
- `npm run lint`: 0 avisos, 0 errores en 184 archivos (`lint.txt`).

## Pendiente

- El arranque sin estilo solo puede mejorarse con estilos en línea o con una hoja crítica aparte, y el
  repositorio prohíbe lo primero. Cargar una hoja crítica mínima resolvería el centrado sin romper la
  regla, pero suma una petición de red al arranque.

