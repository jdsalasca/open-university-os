# Barrido de badges ilegibles en tema oscuro — 5 de octubre de 2026

La ronda anterior corrigió tres iconos invisibles en `/#academia`. El patrón que los produjo es
sistemático, no un accidente: una regla puerta del tema reescribe el `color` de todo `.workspace main`
con especificidad 0-5-1, gana a cualquier selector de clase (0-1-1), pero **no toca el `background`**.
Un componente que fija su fondo claro con un literal se queda con fondo crema y texto del tema oscuro.

## Primero: un detector sin navegador

`find-dark-badges.mjs` compila los 25 SCSS de componentes y marca toda regla que:

- fija `background` con un literal **claro** (luminancia ≥ 0,55),
- fija `color` con un literal (no un token),
- hoy es legible en claro (ratio ≥ 4,5, para no mezclar problemas),
- y cuya clase **no** aparece en ningún selector `:root[data-theme=dark]` que repinte fondo o color.

Salida: `candidatos.txt`.

## La predicción se comprobó en el navegador

El analisis estatico marco 65 candidatos. La medicion con navegador sobre seis rutas dio **siete
fallos reales**:

| Ruta | Elementos bajo AA | Rango |
| --- | ---: | --- |
| `/#academia` | 0 *(ya corregido)* | — |
| `/#inicio` | 0 | — |
| `/#espacios` | **2** | 1,09 – 1,13 |
| `/#admisiones` | 0 | — |
| `/#programas` | **5** | 1,02 – 2,15 |
| `/#branding` | 0 | — |

Elementos: `.spaces-hero-art`, `.spaces-search-control`, `.catalog-note-icon`, `.catalog-admin-mark`,
`.catalog-file-picker`, `.catalog-file-icon`, `.catalog-count`. **Los siete estaban en la lista del
script**, así que el detector sin navegador acierta en esta muestra.

Medición cruda en `medicion-real.txt`, medición posterior en `medicion-real-despues.txt`.

## El arreglo

Cuatro reglas agrupadas en `_theme.scss` con tokens existentes, sin estilos inline:

```scss
:root[data-theme='dark'] .workspace main :is(.catalog-note-icon, .catalog-file-icon) { background: #332e1d; color: var(--ui-text-primary); }

:root[data-theme='dark'] .workspace main :is(.catalog-admin-mark, .catalog-file-picker, .spaces-hero-art, .spaces-search-control) {
  background: var(--ui-surface-raised);
  color: var(--ui-text-primary);
}

:root[data-theme='dark'] .workspace main .catalog-count { background: var(--ui-surface-raised); color: var(--ui-text-secondary); }
```

**Resultado tras el arreglo: 0 elementos bajo AA en las seis rutas.**

### El primer intento no funcionó, y el navegador lo dijo

Con `background: #4a4326` y `color: #f0dfa0` (el mismo tratamiento que el badge de la nota), el chip
`.catalog-note-icon` quedó en **4,35**. La causa: en esos chips gana `--ui-text-muted`, no el color que
declara la regla. El contraste no dependía del `color` declarado sino del fondo, así que se cambió el
fondo al mismo `#332e1d` que usan las notas del tema y el margen pasó a ser amplio.

Sin esa medición, el arreglo habría parecido correcto: el test estático pasaba.

## Un defecto del propio guard

`darkRule()` no tolerate que Sass parta los selectores `:is()` de tres o más clases en varias líneas, así
que una regla válida «no se encontraba» y el test la daba por ausente. Fallaba cerrado, no producía
falsos verdes, pero hacía el guard frágil ante cualquier `:is()` largo. Ahora cada espacio del
selector buscado se compila como `\s+`.

## Verificación

| Prueba | Resultado |
| --- | --- |
| `check-dark-theme-feedback` | **22 de 22** (3 nuevas) |
| `npm test` completa | **527 pruebas en 78 archivos** |
| `npm run lint` | 191 archivos, 116 reglas, sin avisos |
| `npm run build` | presupuestos verificados, 23.448 B CSS |
| Navegador, seis rutas en oscuro | **0** elementos bajo AA |

Capturas: `01-programas-dark.png`, `02-espacios-dark.png` y el detalle `03-chip-note-icon.png`, donde
la «i» se ve sobre su fondo.

## Presupuesto de bundle

El CSS de entrada subió de 23.007 a 23.448 B y el guard lo rechazó. Se subió el límite a 23.500 B con
la justificacion escrita junto a el: **+441 B** por los siete elementos. El presupuesto sigue cumpliendo su
papel, que es impedir crecimiento accidental, no impedir correcciones de accesibilidad medidas.

## Pendiente

Quedan **63 candidatos** sin revisar en `candidatos.txt`. El detector funciona pero no se revisó uno por
uno: varios serán falsos positivos (elementos dentro de un contenedor que el tema sí repinta, o que no se
renderizan sin datos). Revisarlos exige sesión de preview por ruta, y cada sesión cuenta contra el
límite de sesiones activas del backend — un 429 confirmó que el límite funciona cuando las auditorías lo
golpearon.

Sin navegador, `find-dark-badges.mjs` es la forma barata de acortar esa lista: quien revise una ruta
puede cruzarla con el reporte y confirmar la predicción.
