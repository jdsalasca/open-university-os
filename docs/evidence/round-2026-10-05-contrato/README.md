# Contrato de superficie entre React y Spring — 5 de octubre de 2026

En un monorepo el fallo silencioso más común no es un 500: es que el cliente llame a una ruta que el
backend ya no expone, y la pantalla degrade sin que nadie se entere hasta producción. Esta ronda
verifica esa frontera por dos vías independientes.

## Vía 1: contra el backend en ejecución

`check-contract.cjs` recorre las 29 rutas que consume el cliente y las pide al backend local. Un **404**
significaría que la ruta no existe; 401 o 403 significan que existe y el servidor autoriza.

| Resultado | Valor |
| --- | --- |
| Rutas consultadas | 29 |
| Rutas que existen | **29** |
| Rutas inexistentes | **0** |

Salida completa en `rutas-runtime.txt`. Las públicas responden 200 y las administrativas 401, que es lo
correcto sin sesión.

## Vía 2: estática, dentro de la CI

`check-api-surface.node-test.mjs` cruza las rutas del cliente con los mapeos del backend leyendo el
código. No necesita el backend levantado, así que entra en `npm test` y por tanto en la CI.

- Extrae de `frontend/src/**/*Client.ts` toda cadena `/api/v1/...`.
- Extrae de `backend/src/main/java/**` cada `@RequestMapping`, `@Get|Post|Put|Patch|DeleteMapping`,
  componiendo el prefijo de clase con la ruta relativa del método.
- Comprueba que **toda ruta del cliente tiene un mapeo** que la publica, y que **ningún recurso
  administrativo del backend queda huérfano**: código que existe, se despliega y nadie llama.

| Medida | Valor |
| --- | --- |
| Rutas del cliente | 43 |
| Mapeos del backend | 61 |
| Rutas del cliente sin mapeo | **0** |
| Recursos administrativos huérfanos | **0** |

## Tres bugs de la propia herramienta

La primera versión de la guarda fallaba en 18 rutas y en cada corrección el defecto estaba en la
herramienta, no en el proyecto:

1. **Barra inicial perdida.** `split('/').filter(Boolean)` descarta el segmento vacío inicial y el
   `join` no lo devuelve, así que los patrones se construían como `api/v1/...` en vez de `/api/v1/...`
   y no casaban con nada.
2. **Mapeos no compuestos.** Hay controladores que declaran la raíz con `@RequestMapping("/api/v1/me")`
   y el método con `@GetMapping` sin argumentos. La extracción solo leía rutas entrecomilladas y se
   perdía media superficie de la API.
3. **Prefijo contra igualdad.** La comparación exigía coincidencia exacta de los primeros cinco
   segmentos, pero el cliente escribe `/api/v1/admin/academic-catalog/drafts` y el mapeo añade más
   segmentos. Ahora se compara por prefijo de segmentos, con `/api/v1/recurso` como base.

## Verificación de la forma, no solo de la ruta

Que la ruta exista no basta: también puede haber cambiado de forma. `GET /api/v1/spaces` se contrastó
campo por campo con lo que el componente lee:

| Origen | Claves que devuelve | Campos que el componente lee |
| --- | --- | --- |
| Raíz | `locations`, `requestPathways`, `officialOfficeDirectoryUrl` | los tres |
| Ubicación | `id`, `kind`, `name`, `municipality`, `department`, `address`, `locationDetail`, `mapQuery`, `source`, `announcement` | los diez |
| Fuente | `label`, `url`, `checkedAt`, `sourceUpdatedAt` | los cuatro |
| Canal (`requestPathways`) | `id`, `kind`, `title`, `audience`, `summary`, `availabilityNote`, `sources` | los siete |
| Anuncio | `capacities`, `locationNote`, `locationReferences` | los tres |

Coincidencia exacta en los cinco niveles. Dos de las 24 ubicaciones traen anuncio con
`capacities[{areaName, announcedCapacityPersons}]`, que es lo que el componente renderiza como aforo
publicado.

El cliente valida además la respuesta en tiempo de ejecución (`spaceGuideContracts.ts`), así que un
cambio de forma se detecta al recibir la respuesta, no en un 404.

## Verificación

- `frontend/scripts/check-api-surface.node-test.mjs`: 3 guardas, todas verdes.
- `npm test`: **521 pruebas Vitest en 77 archivos, más 75 guardas de Node**, todas aprobadas
  (`vitest.txt`).
- `npm run build`: aprobado, presupuestos verificados (`build.txt`).
- `npm run lint`: 0 avisos, 0 errores en 185 archivos (`lint.txt`).

## Pendiente

- La guarda comprueba existencia de la ruta, no el esquema de la respuesta entre ambos lados. El
  cliente valida el JSON al recibirlo, pero una comparación de tipos compartida detectaria antes un
  cambio incompatible.
- El contraste campo por campo está hecho a mano para espacios. Automatizarlo exige generar los tipos
  del backend y compararlos con los contratos del cliente.
