# Universiry — Open University Frontend

El código público de [`open-university-frontend`](https://github.com/jdsalasca/open-university-frontend) busca apoyar la digitalización de la UPTC y servir como base adaptable para otras universidades que necesiten servicios digitales robustos y confiables. Construye el monolito web institucional con Vite, React, TypeScript y SCSS; sus capacidades operativas se habilitan según contratos y permisos del backend.

El frontend vive en un repositorio independiente, coordinado con el backend mediante la rama `develop`.

## Requisitos y comandos

Requiere Node.js 24 y npm. Desde esta carpeta:

```powershell
npm ci
npm test
npm run build
npm run lint
npm run dev
```

Vite sirve la interfaz en `http://localhost:5173` y por defecto proxifica `/api` y `/assets` a `http://localhost:8080`. Compose sobrescribe el destino mediante `VITE_API_TARGET=http://backend:8080` y activa HMR al guardar fuentes SCSS/TSX.

## Portal unificado

La ruta `/#resumen` es la entrada general de la aplicación. Presenta recursos públicos de la marca institucional y muestra accesos administrativos solo a partir de permisos efectivos obtenidos por `/api/v1/me`; cada operación vuelve a autorizarse en el backend. La ruta `/#inicio` conserva el Centro de Identidad Visual. Los módulos sintéticos no se exponen desde `App.tsx` ni se incluyen en el build de producción.

## Límites

La identidad descargada se valida antes de aplicar colores, activos y etiquetas. El cliente no concede permisos: publicar identidad exige token y rol validados por backend. La imagen local de preview no equivale a un cambio institucional publicado. No usar secretos ni datos personales reales en el frontend.

## Catálogo de pregrado presencial

La ruta `/#programas` presenta dos capacidades separadas. El directorio público de 79 programas usa `src/features/academics/publicCatalog/uptcUndergraduateCatalog.snapshot.json`, que Vite emite como asset JSON versionado del mismo origen; React lo carga bajo demanda y filtra en el navegador. La captura es del 2 de octubre de 2026 (página fuente actualizada el 15 de septiembre). Incluye búsqueda por texto, filtros de facultad/lugar/modalidad/nivel, el marcador de oferta de la fuente y enlaces a fichas oficiales. El marcador no representa una convocatoria abierta ni cupos; la procedencia y las reglas de actualización están en el [registro de fuente](../docs/discovery/uptc-undergraduate-directory-snapshot-2026-10.md). No usa API backend ni base de datos y no alimenta el maestro académico.

En otra sección, el catálogo curricular interno consulta metadata y asignaturas de versiones publicadas. Las páginas de `/api/v1/academic-catalog/curricula/{id}/entries` contienen máximo 100 filas y admiten búsqueda por código/nombre y filtro por semestre; la búsqueda se retrasa 250 ms y las solicitudes obsoletas se cancelan. La cola administrativa de borradores requiere permisos y usa clientes autenticados; no se mezcla con el directorio público.
