# Barrido responsive en tres anchos y diez rutas — 5 de octubre de 2026

Las rondas anteriores midieron contraste, nombres y área táctil siempre a 1440 px. Faltaba lo que más
se nota en uso real: pantallas estrechas. Este barrido recorre diez rutas en 360, 768 y 1024 px.

## El desborde horizontal no delata nada

`document.documentElement.scrollWidth - clientWidth` dio **0 en las cincuenta** combinaciones de ruta y
ancho (`responsive.txt`). Ninguna página se ensancha.

Y sin embargo había contenido perdido. **El desborde del documento mide la página; el recorte de cada
elemento mide su propio contenido.** Un contenedor con `overflow: hidden` y un hijo más ancho queda
recortado sin ensanchar la página. Un detector que solo mire `scrollWidth` del body no encuentra nada.

## Dos detectores, y por qué el primero no servía

El primer detector (`medir-anomalias.mjs`) reportó **203 anomalías**. Todas eran el patrón de texto
visualmente oculto: `clip: rect(0,0,0,0)` con 1 px de ancho, que es como la aplicación esconde las
etiquetas del sidebar colapsado y los radios del selector de tema. **203 falsos positivos.**

El detector corregido (`detector-corregido.mjs`) excluye el patrón y baja a **38 hallazgos**, de los
que tras verificar visualmente quedaban 3 defectos reales y el resto es decoración intencionada.

## Los tres defectos reales

| Defecto | Medido | Visible en |
| --- | --- | --- |
| Nombre de la institución truncado | 156 px visibles de 311 px de contenido, en las diez rutas | `01-nombre-institucion-1024.png` (antes: "Universidad Pedagóg...") |
| Fila de estados del preview cortada | 383 px visibles de 676 px de contenido | `02-preview-nav-1024.png` |
| Órbita del preview asomando | la figura llegaba a 659 px contra un borde visible en 649 | `03-hero-1024.png` |

El nombre se ve sin problemas en la captura posterior (`01-nombre-institucion-1024.png` regenerada):
"Universidad Pedagógica y Tecnológica de Colombia" en tres líneas dentro del sidebar.

## Los recortes que NO eran defecto

Los heroes de espacios, admisiones y accesos reportan 46, 48 y 48 px de recorte. Al medir los hijos
(`verificar-heroes.mjs`), la diferencia es **exactamente el ancho de la figura decorativa** posicionada
fuera del borde, no el texto:

```
.spaces-hero:          visible 334, contenido 380, hijos: copy 292 (relative), art 145 (absolute)
.admissions-call-card: visible 290, contenido 338
.role-access-hero:     visible 332, contenido 380
```

`overflow: hidden` está haciendo su trabajo. Ponerlo en `visible` dejaría círculos asomando fuera del
marco. El guard **afirma que ese recorte se mantiene a propósito**, y que cada héroe declara su
decoración absoluta.

## El arreglo

```scss
// .brand-lockup-copy strong — el nombre cabe en dos líneas, no en una recortada
strong { font-size: 11px; line-height: 1.25; letter-spacing: .04em; white-space: normal; overflow-wrap: break-word; }

.preview-navigation { overflow-x: auto; overflow-y: hidden; }
.preview-orbit { right: 0; }
```

## El guard y su ronda de tougher

`check-content-clipped.node-test.mjs` cubre los cuatro casos y **se probó con mutación**: revertir
`right: 0` a `right: -10px`, o `overflow-x: auto` a `overflow: hidden`, hace fallar la prueba.

Durante el desarrollo el guard pasó por tres versiones equivocadas que habrían dejado el defecto
vivo: exigía `overflow: visible` en los cuatro heroes (que rompe la decoración), buscaba
`.brand-lockup-copy` con una expresión regular que los comentarios rompían, y apostaba por
`clip-path` en la órbita cuando `right: 0` resuelve el problema sin recortar nada.

## Verificación

| Prueba | Resultado |
| --- | --- |
| `check-content-clipped` | 4 de 4 (con prueba de mutación) |
| `npm test` completa | **530 pruebas en 78 archivos, 89 guardas de Node** |
| `npm run lint` | 192 archivos, 116 reglas, sin avisos |
| `npm run build` | presupuestos verificados, 23.292 B CSS (bajó 13 B) |

## Deuda

Quedan 25 recortes "reales" según el detector, todos ya clasificados: decoración intencionada en
heroes, el estado de sesión con `text-overflow: ellipsis` deliberado, y el estado vacío del catálogo
curricular, cuyo marco decorativo sobresale a propósito. Revisar cada uno exigiría navegador y sesión
de preview por ruta; el detector corregido queda en el repo para hacerlo sin reescribir la logica.
