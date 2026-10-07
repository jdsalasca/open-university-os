# El aviso de sesión sale del contenido y una nota de admisiones en oscuro — 6 de octubre de 2026

## Parte 1: el aviso de sesión no es contenido de la página

El aviso de sesión sintética («Desarrollador local · modo preview…») se montaba como primer hijo de
`main`, delante del título de cada ruta. Dos consecuencias reales:

1. Un lector de pantalla anunciaba el aviso en vez del título al entrar en la página.
2. `main` empezaba por un landmark `complementary` que no pertenece a ninguna ruta.

El aviso sigue en el shell —entre la barra superior y el contenido— con su `aria-live`, su
`aria-atomic` y su `aria-label`. Lo que cambia es el padre: `.workspace`, no `main`.

Verificado con `check-session-chrome` (nuevo, registrado en `npm test`): el aviso no aparece dentro
del bloque `<main>…</main>` de `App.tsx`.

Un efecto colateral bueno: fuera del alcance de la regla puerta de `_theme.scss` (que solo reescribe
el color dentro de `main`), el aviso conserva sus colores declarados `#574510` sobre `#fff3c8`,
ratio ~7:1, **en ambos temas sin necesidad de regla oscura**. La captura `banner-dark.png` lo muestra
legible sobre el hero oscuro.

## Parte 2: `.admissions-source-note` a 2,27 en oscuro

Con la auditoría corriendo de verdad (sesión emitida y revocada), `dark #admisiones` mostró un nodo a
2,27: `#a8aea2` sobre `#ffffff`.

La causa es otro patrón blanket del tema: la regla de texto apagado incluye `[class*='-note']`, que
pinta el aviso del gris oscuro mientras su fondo sigue siendo el claro que declara el componente con
`var(--brand-surface)`. Medido con la cadena de herencia: `--brand-text` vale `#1A1A1A` (correcto),
pero el `color` del componente pierde por especificidad contra la regla del tema.

El arreglo sigue el patrón establecido: regla oscura propia con fondo elevado y texto primario, y se
conserva el borde amarillo de acento porque funciona en ambos temas. Guard en
`check-dark-theme-feedback`, verificado en rojo antes del arreglo.

## Parte 3: el entorno también era un hallazgo

A mitad de la ronda, el puerto 5173 servía "Hotel Eridu": otro proyecto (`hotel-os`) ocupaba 5173 y
8080, y mi stack de Compose estaba caído. No se puede tumbar el trabajo ajeno.

- Mi stack se levantó en puertos alternos (8081/5179) con una copia del compose en `%TEMP%` — el
  `compose.yaml` del repo no se toca.
- Los scripts de auditoría ya aceptaban `BASE` por entorno.
- El `Dockerfile.dev` hace `COPY . .`: la imagen lleva el código horneado y **no monta `src`**, así que
  editar en el host no se refleja hasta reconstruir. Dos verificaciones se hicieron contra código viejo
  por esto; desde entonces, editar implica reconstruir antes de medir.
- `compose.yaml` + override con `!reset`/`!override` no funcionó como esperaba en Compose v5.5.1:
  `!reset` vaciaba la lista sin aplicar la nueva. La copia del archivo con `sed` de puertos sí.

## Verificación

- **axe-core: 0 violaciones** en las 18 combinaciones con la nueva estructura.
- **555 pruebas en 80 archivos**, guardas de Node en verde, lint sin avisos, build dentro de
  presupuesto.
- Captura `banner-dark.png`: el aviso legible sobre el hero oscuro.

## Presupuesto

`entryStyles` 23.900 → 24.000 y `programsStyles` 56.500 → 56.600: ~90 B por la regla de la nota de
admisiones. Anotado en `check-bundle-budget.mjs` con el coste, como las tandas anteriores.
