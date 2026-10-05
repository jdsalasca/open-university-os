# Plan: hacer buscables las rutas oficiales de uso de espacios

## Objetivo

Extender la búsqueda ya existente de `/#espacios` para que encuentre también los cinco recorridos oficiales de préstamo, asignación y alquiler. La página seguirá siendo una guía informativa; no tramitará solicitudes ni afirmará cupos o disponibilidad.

## Contrato del corte

- La consulta normalizada filtra fichas de ubicación y rutas oficiales por separado.
- Para rutas, buscar en título, audiencia, resumen, nota de disponibilidad publicada y etiquetas de sus fuentes.
- Los filtros de tipo y municipio siguen limitados a las fichas de ubicación.
- Mostrar conteos y estados vacíos que distingan lugares de rutas. `Limpiar búsqueda` restaura las rutas sin cambiar los filtros de lugar; el reinicio total existente de `Limpiar filtros` restaura ambas listas.
- No cambiar instantáneas, API, modelo, reglas, fuentes, permisos, reservas ni arquitectura.

## Pasos y verificación

1. Añadir pruebas AAA que reproduzcan que `alquiler` no filtra los recorridos y que filtros de lugar no deben ocultarlos; observar RED.
2. Compartir la normalización textual existente y filtrar las rutas con los campos publicados del contrato.
3. Presentar el nombre y conteo de cada sección, mantener vacíos independientes y ajustar el campo de búsqueda a su alcance real.
4. Verificar pruebas focales, suite completa, lint y build desde `frontend/`.
5. Abrir la guía con Playwright en claro/oscuro y viewport móvil/escritorio; revisar capturas y consola.
6. Actualizar el flujo de proceso y el roadmap. No cambia C4, API ni contratos.
7. Revisar diff y Craft; integrar por fast-forward en `develop`, publicar el SHA autorizado, verificar CI y limpiar este worktree.

## Aceptación

- Buscar `alquiler` encuentra la ruta oficial de auditorios sin requerir una coincidencia en lugares.
- Búsqueda ignora tildes y mayúsculas en rutas y lugares.
- Tipo/municipio alteran únicamente los resultados de lugares.
- Conteos y vacíos separan ambas listas; limpiar filtros las restaura.
- Ninguna pantalla o prueba sugiere que el sistema reserva, publica cupos o conoce disponibilidad actual.
