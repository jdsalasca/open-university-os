# Consola del navegador y enlaces internos — 5 de octubre de 2026

Dos cosas que ninguna ronda anterior había mirado: lo que React dice por consola, y si algún enlace
interno lleva a una página en blanco.

## Consola: cero errores de React

Once rutas, con escucha de `console`, `pageerror` y `requestfailed`:

```
TOTAL mensajes de consola y errores: 13
```

**Ninguno es un error de React.** Sin claves duplicadas, sin avisos de `act`, sin props desconocidas.
Las 13 entradas son `net::ERR_ABORTED`:

```
[request] net::ERR_ABORTED http://localhost:5199/api/v1/branding
[request] net::ERR_ABORTED http://localhost:5199/api/v1/academic-structure
[request] net::ERR_ABORTED http://localhost:5199/api/v1/admin/academic-periods
```

Son peticiones canceladas al cambiar de ruta, que es exactamente lo que el repositorio exige: los
clientes usan `AbortController` y abortan al desmontar o al perder permiso. Un `ERR_ABORTED` es la
prueba de que esa cancelación funciona, no un fallo. `PublicPostgraduateDirectory`,
`PublicUndergraduateDirectory`, `AcademicCatalogPage` y `AcademicOfferingDraftPanel` declaran su
`AbortController`.

## Enlaces internos: cero rotos, y ahora protegido

Once rutas recorridas, once hashes distintos en los enlaces:

```
#academia #accesos #admisiones #avisos #avisos-admin #biblioteca
#espacios #estudiantes #inicio #programas #resumen
```

Coinciden exactamente con las que `readApplicationView` sabe montar. **Cero enlaces rotos**, pero eso
era una línea base: un `href="#inventado"` en cualquier componente lleva a la portada, porque
`App.tsx` devuelve `home` para cualquier hash que no reconozca.

### El guard

`check-internal-links.node-test.mjs` lee el repositorio entero y contrasta cada hash enlazado con las
rutas que la propia `readApplicationView` declara. **No usa una lista escrita a mano**: añadir una ruta
al navegador la añade también al guard, y el orden inverso también.

### Dos versiones del guard que no tenían dientes

La primera buscaba `href="#ruta"` y pasaba verde con un enlace inventado. Motivo: en `App.tsx` los
enlaces de navegación se declaran como `href: '#resumen'`, con dos puntos, no `href="#resumen"`. El
patrón solo veía la forma JSX.

La segunda cubría las dos formas pero **no veía los enlaces de componentes**: la mutación de prueba la
apliqué primero en `StudentServicesPage.tsx` y el guard pasó. Ahí no había ningún `href="#..."` que
mutar, así que la prueba no probó nada — la misma trampa de las mutaciones que no se aplican.

**Probado con mutación dos veces**: `href: '#inventado'` en `App.tsx` y `href="#ruta-inventada"` en
`PublicUndergraduateDirectory.tsx`. Ambas hacen fallar el guard, y vuelve a verde al restaurar.

## Verificación

| Prueba | Resultado |
| --- | --- |
| `check-internal-links` | 2 de 2 (con dos pruebas de mutación) |
| `npm test` completa | **530 pruebas en 78 archivos, 106 guardas de Node** |
| `npm run lint` | 198 archivos, 116 reglas, sin avisos |
| `npm run build` | presupuestos verificados, sin cambios |

## Nota

Esta ronda no encontró defectos de producto. Su valor es la protección: el guard de enlaces internos es
la primera comprobación que impide una página en blanco por un typo en un hash, y ahora corre en cada
`npm test` y en cada push.
