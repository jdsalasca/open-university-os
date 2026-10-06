# Evitar respuestas curriculares obsoletas

## Objetivo

Mantener las mallas publicadas visibles alineadas con el programa seleccionado en `/#programas`, aunque una lectura anterior se resuelva después de una selección más reciente.

## Alcance y límites

- Investigar la secuencia del efecto de lectura y reproducir una respuesta fuera de orden con una prueba de componente.
- Si se reproduce el defecto, ignorar el resultado cancelado antes de actualizar el estado público.
- Conservar el cliente, contratos HTTP, datos sintéticos y estilos actuales.
- No añadir reglas académicas, campos personales, API, persistencia, permisos ni cambios visuales.
- La ficha del directorio institucional en `/#estudiantes` queda fuera de este cambio y espera la aprobación de su diseño.

## Riesgo

Un resultado tardío podría reemplazar los currículos del programa nuevo y presentarlos bajo su encabezado. El cliente HTTP envía `AbortSignal`, pero la vista debe demostrar también que una promesa ya resuelta o una implementación que no honre la cancelación no modifica la selección actual.

## Secuencia y verificación

1. Crear una prueba AAA con dos promesas diferidas; seleccionar ambos programas, resolver primero la lectura reciente y luego la anterior, y observar el fallo esperado.
2. Añadir la guarda mínima que impide aplicar resultados de un efecto cancelado.
3. Ejecutar la prueba enfocada, suite frontend, lint y build; revisar el diff y comprobar que no cambian API, estilos ni datos.
4. Integrar por fast-forward a `develop`, publicar el mismo avance autorizado a `origin/develop`, verificar SHA y CI y retirar únicamente el worktree propio.

## Criterios de aceptación

- La selección más reciente conserva sus currículos cuando una lectura previa termina después.
- La prueba de regresión falla antes del arreglo y pasa después.
- Pruebas, lint y build frontend pasan.
- No hay cambios en rutas, estilos, contratos, persistencia ni datos institucionales.

## Archivos previstos

- `frontend/src/features/academics/AcademicCatalogPage.test.tsx`
- `frontend/src/features/academics/AcademicCatalogPage.tsx`
- `docs/superpowers/plans/2026-10-06-academic-catalog-stale-response/PLAN.md`
- `docs/superpowers/plans/2026-10-06-academic-catalog-stale-response/feature_list.json`
