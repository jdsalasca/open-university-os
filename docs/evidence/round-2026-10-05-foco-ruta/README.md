# El foco al cambiar de ruta — 6 de octubre de 2026

## El defecto

Al pulsar un enlace de la barra lateral, el foco se quedaba en el propio enlace. Quien navega con
teclado seguía recorriendo el menú y el contenido nuevo no llegaba a anunciarse nunca.

Medido en el navegador antes del cambio (`auditar-foco.mjs`, ocho enlaces del menú pulsados con
Enter):

```
con el foco dentro del contenido principal: 1
con el foco fuera (sigue en la barra lateral): 6
```

## El arreglo

`main` ya declaraba `tabIndex={-1}`, o sea que era enfocable por código: solo faltaba enfocarlo. Pero
enfocar `main` tenía dos problemas que se vieron al medir, no al suponer:

**1. `main` mide 4310 px y arranca en `y=0`, debajo de la barra superior.** Un indicador en su borde
superior queda tapado: la captura no mostraba nada. Se probó `outline: 3px` por dentro y la captura
mostró un recuadro negro rodeando casi toda la ventana, que se lee como un error de maquetación.

**2. `main` empieza por el aviso de sesión sintética.** Un lector de pantalla anunciaba «Desarrollador
local · modo preview…» en vez del título de la página a la que se acababa de entrar.

Los dos se resuelven con lo que recomienda WAI-ARIA para navegación de una sola página: **el foco
aterriza en el `h1` de la página**.

## El detalle que costó encontrar: las vistas se cargan bajo demanda

Con el efecto escrito de la forma obvia, el diagnóstico seguía diciendo `activeTag: MAIN` y el `h1` con
`tabindex: null`, o sea que la rama nueva no se ejecutaba. La causa no era caché ni un error de
escritura: `AcademicOperationsPage` y las demás rutas son `React.lazy`, así que al cambiar de vista el
título **todavía no existe** — React está resolviendo el chunk y `main` solo contiene el marcador de
carga. En navegación posterior, con el chunk ya en caché, habría funcionado; en la primera, no.

Por eso el efecto enfoca `main` de inmediato —para no perder el foco— y en cuanto aparece el título se
lo pasa con un `MutationObserver` que se retira solo a los 5 segundos.

## Resultado

```
con el foco dentro del contenido principal: 8 de 8
con el foco fuera (sigue en la barra lateral): 0

OK   Identidad visual     h1  Centro de identidad visual
OK   Programas            h1  Mallas curriculares de pregrado
OK   Admisiones           h1  Pregrado presencial 2027-I
OK   Guía de espacios     h1  Guía de espacios
OK   Estructura y periodos h1  Estructura y periodos académicos
```

La segunda columna es lo que un lector de pantalla anuncia al entrar: el título de la página.

`Resumen` sigue enfocando `main` a propósito: su `<h1>` es un título dinámico de la portada y esa vista
se monta al arrancar, no por navegación.

## Un defecto preexistente que esta ronda destapó

`App.test.tsx` tiene dos tests que afirman el marcador de carga perezosa: «announces the selected
academic module while its route chunk loads» y «reserves the catalog height while the programs route
chunk loads». Fallan si **cualquier test anterior del archivo carga el chunk de Programas**, porque ese
estado transitorio solo existe mientras la importación sigue en vuelo.

No es un problema teórico: mi test de foco navega a Programas, y con él los dos tests se caían. Se
intento arreglarlos con `vi.resetModules()` más un import dinámico de `App`, y eso empeoró todo: el
`App` recién importado usa otra instancia de `BrandingContext`, así que el `BrandingProvider` importado
estáticamente ya no lo satisface y la aplicación ni siquiera monta.

Se revirtió ese intento y **el test de foco se movió después de los dos tests sensibles**, que es la
forma de no romper a los demás sin debilitar nada. La fragilidad de fondo queda documentada, no
arreglada: la solución de fondo es que las pruebas puedan inyectar el cargador perezoso en vez de
depender del orden.

## Verificación

- **534 pruebas en 78 archivos**, guardas de Node en verde, lint sin avisos, build dentro de
  presupuesto.
- `check-route-focus` (nuevo, registrado en `npm test`) cubre el indicador del título, el `tabIndex` de
  la región, la búsqueda del `h1`, el paso del foco, el respaldo a la región, el `MutationObserver` y
  que el primer render no robe el foco.
- Capturas: `anillo-titulo.png` (el anillo alrededor del título, que es la prueba visual), y
  `foco-en-contenido.png` (vista completa tras navegar).

## Reproducir

```
PLAYWRIGHT_CORE=<npm root -g>/@axe-core/playwright/node_modules/playwright-core \
CHROMIUM=<chromium del ms-playwright> \
node docs/evidence/round-2026-10-05-foco-ruta/auditar-foco.mjs
node docs/evidence/round-2026-10-05-foco-ruta/recortar-anillo.mjs
node docs/evidence/round-2026-10-05-foco-ruta/diagnostico-foco.mjs
```

## Pendiente

- Los dos tests de carga perezosa siguen siendo frágiles al orden. SeSolve con un cargador inyectable.
- El aviso de sesión sigue siendo lo primero dentro de `main`. Con el foco ya en el `h1` no afecta a
  quien navega por teclado, pero convendría sacarlo del contenido de página: es cromo de sesión, no
  contenido de la ruta.