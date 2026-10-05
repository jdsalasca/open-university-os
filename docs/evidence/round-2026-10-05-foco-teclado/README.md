# Recorrido con teclado y orden de tabulación — 5 de octubre de 2026

Las rondas anteriores midieron contraste, nombres, área táctil y recortes siempre mirando la página
como se ve. Esta mide lo que vive la persona que no usa ratón: **el recorrido con Tab**.

## Foco visible: 584 elementos, 0 sin señal

El script de accesibilidad anterior anunciaba "foco visible" en el título pero **nunca lo medía**:
solo contaba nombres y área táctil. Recorrido ahora con `Tab` de verdad en diez rutas, comparando
cada elemento enfocado con el mismo elemento sin enfocar (outline, box-shadow, bordes, fondo, color,
decoración). Un `outline` puede estar presente y ser invisible por color; solo la comparación dice si
hay diferencia.

```
TOTAL elementos recorridos con Tab: 584
TOTAL sin diferencia perceptible al enfocar: 0
```

Ningún defecto. Es una medición, no un entregable, y queda registrada como línea base.

## El defecto: el enlace para saltar al contenido

Recorrido el orden de tabulación frente al orden visual (arriba a abajo, izquierda a derecha) y
aparecieron **89 saltos fuera de orden** en diez rutas. El más grande y más repetido:

```
retroceso (-30)
  desde <a class="workspace-home-card"> "◇Información públicaAdmisiones…"
  hacia  <a class="nav-item active skip-link"> "Saltar al contenido principal"
```

El enlace para saltar al contenido tenía `position: fixed; top: -50px`. **Apartarlo 50 px hacia arriba
no lo saca del flujo**: sigue ocupando sitio en el sidebar, así que el anillo de foco saltaba 30
líneas hacia atrás en cada vuelta del recorrido. Es el enlace que existe precisamente para quien
navega con teclado, y era el peor elemento para esa persona.

### El arreglo

```scss
.skip-link {
  position: absolute;   // sale del flujo: no ocupa sitio ni aparece en el recorrido
  top: -60px;
  left: 8px;
  z-index: 40;          // por encima del sidebar cuando aparece
  padding: 7px 12px;    // 42 px de alto, por encima de los 24 px táctiles
  background: var(--ui-surface, #fff);
  color: var(--ui-text-primary, #1a1a1a);

  &:focus-visible { top: 12px; }
}
```

El fondo propio no es decorativo: el sidebar es oscuro, y un enlace sin fondo se dibuja en gris claro
sobre ese fondo justo en el momento en que la persona lo necesita.

## Verificación con teclado real

Un `focus()` programático **no** activa `:focus-visible` — el navegador no sabe que es teclado. La
comprobación se hizo refocusando la marca y llegando al enlace con `Shift+Tab`, que sí cuenta como
navegación por teclado:

```
texto:  "Saltar al contenido principal"
top:    12          (dentro de la pantalla)
alto:   42 px
fondo:  rgb(41, 42, 36)   texto: rgb(255, 255, 255)   ratio 14,47
foco:   2px solid rgb(255, 204, 41)
tras Enter -> #resumen (main)
```

Captura en `01-skip-link-enfocado.png`. El enlace aparece arriba a la izquierda con su anillo de foco,
y `Enter` lleva el foco al `<main>` del contenido principal.

## Los 89 saltos: qué queda y qué no

De los saltos, **24 son hacia los radios del selector de tema** y **18 hacia los `nav-item`**. El
recorrido es: skip-link → marca → once enlaces de navegación → barra superior. El retroceso entre la
última fila del sidebar y la barra superior es de 586 px, y **es correcto**: es una interfaz de dos
columnas y Tab recorre primero la columna izquierda completa. Invertirlo con `flex-direction:
column-reverse` arreglaría la pantalla y rompería el orden del lector de pantalla y del DOM.

`orden-real.txt` deja el recorrido completo con la posición de cada elemento.

## El guard

`check-skip-link.node-test.mjs` cubre tres cosas: que salga del flujo y vuelva al enfocarse, que sea
legible sobre el sidebar cuando aparece, y que vaya antes que la navegación en el DOM. **Probado con
mutación**: volver a `position: fixed` hace fallar la prueba.

## Verificación

| Prueba | Resultado |
| --- | --- |
| `check-skip-link` | 3 de 3 (con prueba de mutación) |
| `check-bundle-budget` | 19 de 19 |
| `npm test` completa | **530 pruebas en 78 archivos, 92 guardas de Node** |
| `npm run lint` | 193 archivos, 116 reglas, sin avisos |
| `npm run build` | presupuestos verificados |

El CSS de entrada subió de 23.292 a 23.452 B y el de `#programas` de 55.879 a 56.039 B; el guard los
rechazó y los límites subieron a 23.500 y 56.200 B con la justificación escrita junto a ellos.
