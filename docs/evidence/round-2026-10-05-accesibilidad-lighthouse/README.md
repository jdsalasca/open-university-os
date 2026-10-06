# Auditoría de accesibilidad con axe-core y Lighthouse — 5 de octubre de 2026

## Por qué esta ronda

Las rondas anteriores comprobaron contraste con reglas propias sobre tokens. axe-core mide el
estilo computado real de cada elemento, y encontró cosas que el análisis estático no puede ver.

Lighthouse, en `/#accesos`, dio 96/100 con `color-contrast` en el mensaje que explica que la consola
requiere `identity:roles:read`: `#f0f2eb` sobre `#faf7eb`, ratio **1,05:1**. El texto era casi
invisible. Ninguna regla del repo lo señalaba, porque la causa no estaba en el componente.

## La causa de raíz

`_theme.scss` tiene una regla puerta que, en tema oscuro, fuerza el color de **todo** `main`:

```scss
:root[data-theme='dark'] .workspace main :not(.identity-preview-surface):not(.identity-preview-surface *) {
  color: var(--ui-text-primary);   /* #f0f2eb */
}
```

Con especificidad 0-5-1 gana a cualquier `color` de componente (0-1-0), pero no toca el `background`,
que es un literal del componente. Las superficies oscuras las declara una lista aparte. Una caja de
aviso con fondo crema literal se queda clara mientras su texto pasa a claro: **claro sobre claro**.

Ese patrón produce 62 candidatos estáticos (`frontend/scripts/find-dark-badges.mjs`), pero solo
importan los que se renderizan.

## Cómo se midió

Los MCP de navegador estaban ocupados (el perfil del usuario tenía Chrome abierto), así que los
scripts lanzan su propio Chromium y usan el `axe-core` que ya está instalado globalmente. **No se
añade ninguna dependencia al repositorio.**

```
npm root -g
$env:PLAYWRIGHT_CORE = "<npm root -g>/@axe-core/playwright/node_modules/playwright-core"
$env:AXE_PATH        = "<npm root -g>/@axe-core/playwright/node_modules/axe-core/axe.min.js"
$env:CHROMIUM        = "$env:LOCALAPPDATA/ms-playwright/chromium-1243/chrome-win64/chrome.exe"

node docs/evidence/round-2026-10-05-accesibilidad-lighthouse/auditar-axe.mjs salida.txt
node docs/evidence/round-2026-10-05-accesibilidad-lighthouse/capturar.mjs
```

Cobertura: **las nueve rutas de la aplicación × tema claro y oscuro = 18 combinaciones**, con la
sesión de preview iniciada para que las rutas que dependen de permisos rendericen su contenido real y
no un estado vacío. Etiquetas: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` y `best-practice`.

## Resultado: 26 violaciones → 0

| Violación | Antes | Después |
| --- | ---: | ---: |
| `color-contrast` (grave) | 5 rutas afectadas, 33 nodos | **0** |
| `scrollable-region-focusable` (grave) | 0 | apareció 1 y se corrigió |
| `aria-allowed-role` (menor) | 18 | **0** |
| `landmark-unique` (moderada) | 2 | **0** |
| `page-has-heading-one` (moderada) | 2 | **0** |
| `heading-order` (moderada) | 0 | apareció 1 y se corrigió |

### Lo que se corrigió y por qué

**Contraste.** 33 nodos repartidos en cinco combinaciones:

- `/#academia` oscuro, 18 nodos: los tres formularios de alta (facultad raíz, unidad hija, relación)
  dibujaban el título a **1,09** y la introducción a 2,20. `.academic-create-entry` fija
  `background: #fbfcf8` y no estaba en la lista de superficies oscuras. Entra en la lista consolidada.
- `/#academia` claro, 23 → 0 nodos: `#77796f` sobre `#fbfcf8` daba 4,29 con AA en 4,5. Se oscurece a
  `#6f7168` (4,81). Igual en el panel de auditoría: `#79846a` → `#687250` y `#8a8b82` → `#6f7068`.
- `/#accesos`, 1 nodo: el mensaje bloqueado a 1,05. Las cajas de aviso entran por patrón
  (`[class*='-access-']`), así que un aviso nuevo nace legible sin tocar el tema otra vez. El botón
  «Reintentar» necesita regla propia porque no lleva clase.
- `/#inicio`, 9 → 0 nodos: `.draft-indicator` 4,44 y `.color-field small` 3,44.
- `/#programas`, 1 → 0 nodos: `.catalog-file-action` 4,36.
- Vista previa de identidad, 2 → 0 nodos: `.preview-local-badge` 4,29 y `.preview-footnote` 3,47. Esa
  superficie se queda clara en todos los temas por diseño, así que se corrige en el componente.

**Región desplazable sin teclado.** `scrollable-region-focusable` en `.preview-navigation`: la fila de
módulos se desplaza en horizontal cuando los nombres no caben y sus items son `span`, no enlaces. Sin
`tabindex` no se podía alcanzar con el teclado. Se añade `tabindex={0}` al `<nav>`.

**`role="status"` sobre `<aside>`.** Los dos banners de sesión sintética declaraban `role="status"`.
Sobre un `<aside>` ese rol pisa el `complementary` del landmark y no está permitido: 18 violaciones.
Se sustituye por `aria-live="polite"` con `aria-atomic="true"`, que es la forma que ya usa
`check-session-status` para el estado de sesión. Al volver a ser landmarks, cada uno lleva
`aria-label` propio.

**Landmarks sin nombre único.** En `/#espacios`, dos `<section>` de capacidades anunciadas eran
idénticas para un lector de pantalla. La etiqueta incluye ahora el nombre del lugar.

**`/#biblioteca` sin `<h1>`.** Era la única página que empezaba en `<h2>`; todas las demás usan `<h1>`.
Al subir el título, los `<h3>` de sección quedaron saltando un nivel, así que bajan a `<h2>` y sus
`<h4>` a `<h3>`: `heading-order` también queda en cero.

## Un error propio, contado

Al añadir `role="group"` al `<nav>` de la vista previa introduje 2 violaciones
`aria-allowed-role`: `group` no está permitido sobre un elemento con rol `navigation`. La axe-core del
siguiente pase las delató y el rol se quitó; el `tabindex` es lo que hace falta para desplazar.

## Guarda

- `check-dark-theme-feedback` cubre la lista consolidada y el botón de reintento, y mide el contraste
  del token de texto primario sobre `--ui-surface`. Se verificó por mutación: quitar `.academic-create-entry`
  o `[class*='-access-']` de la lista deja el guard en rojo.
- `check-live-region-role` (nuevo) exige que los dos `<aside>` no declaren `role`, anuncien con
  `aria-live` y `aria-atomic`, y|nombre su landmark. También exige que la etiqueta de capacidades
  incluya el lugar.
- `VisualIdentityCenter.test.tsx` exige que la región desplazable sea alcanzable y **no** declare rol.

## Verificación

- **531 pruebas en 78 archivos y 110 guardas de Node**, lint sin avisos, build dentro de presupuesto.
- Lighthouse en `/#accesos`: 96 → **100**.
- axe-core: **0 violaciones en las 18 combinaciones**.
- Capturas en tema oscuro de los estados corregidos: `academia-dark-alta-facultad.png`,
  `accesos-dark-bloqueado.png`, `biblioteca-dark-encabezados.png`, `inicio-dark-preview.png`.

## El presupuesto de CSS se subió, no se recortó

Las reglas de superficie oscura cuestan bytes. Este archivo de presupuesto ya documentaba cada tanda
anterior con su coste. En esta ronda **se ahorraron 196 B** consolidating las cajas de aviso en la
lista existente en vez de escribir una regla por clase, y el resto se pagó: `entryStyles` 23.500 →
23.700 y `programsStyles` 56.200 → 56.300. Queda anotado en `check-bundle-budget.mjs` para que la
próxima ronda vea lo que se pagó y por qué.

## Pendiente

- Los 62 candidatos estáticos de `find-dark-badges.mjs` que no se renderizan en estas nueve rutas.
  Repartirlos por estado (abrir cada formulario, cada diálogo y cada estado vacío) es la forma de
  saber cuáles son defectos reales.
- La lista consolidada de superficies oscuras es una lista de patrones que crece con cada tanda. La
  solución de fondo es que los componentes consuman tokens y se pueda borrar la regla puerta; eso es
  un refactor, no un parche.
