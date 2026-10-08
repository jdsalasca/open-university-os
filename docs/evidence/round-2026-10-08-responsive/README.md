# Barrido responsive tras los cambios recientes — 8 de octubre de 2026

## Por qué

Las últimas rondas movieron el aviso de sesión fuera de `main`, cambiaron niveles de encabezado en
tres páginas y añadieron superficies oscuras. Todo eso puede romper el móvil sin tocar el escritorio.
`medir-desborde.mjs` mide `scrollWidth` contra el viewport en 11 rutas × 360/768 px con sesión activa;
sale con código distinto de cero si algo excede.

```
node docs/evidence/round-2026-10-08-responsive/medir-desborde.mjs [salida.txt]
```

## Resultado: 0 px en las 22 combinaciones

El documento no ve recortes internos (lección de la ronda de responsive: un `overflow: hidden`
recorta sin ensanchar la página), así que además se revisaron a ojo `movil-360-avisos.png`,
`movil-360-academia.png` y `movil-360-estudiantes.png`: el aviso reubicado cabe y se lee, los `h1`
nuevos no compiten con nada, y los filtros con el botón pulsado se ven correctos.

`capturar-movil.mjs` genera esas tres capturas.
