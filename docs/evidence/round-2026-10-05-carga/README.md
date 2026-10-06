# Latencia bajo carga declarada — 6 de octubre de 2026

## Qué faltaba

El objetivo documentado en `AGENTS.md` es un promedio menor a 50 ms en consultas críticas, y la propia
regla dice que no se anuncie como alcanzado sin una medición representativa. La medición que había
(5 de octubre) no lo era: pedía 20 veces cada endpoint **en serie**, y daba 92 ms o 49 ms para el mismo
código el mismo día. Eso no es ruido menor, es ruido que invalida la conclusión.

## Cómo se mide ahora

`medir-carga.mjs` declara lo que hace:

- **200 peticiones** por endpoint
- **concurrencia 20**, en 20 trabajadores simultáneos, no una a una
- **5 repeticiones** del bloque completo, con la base en el mismo estado
- se **descarta la primera** repetición, que mide el establecimiento de conexiones y el arranque en frío
- se reporta la **mediana de los promedios** de las repeticiones útiles, que es el número defendible, y
  además p95, p99 y máximo

Medir en serie mide una petición solitaria con la base dormida, que no es el caso que interesa.

## El primer resultado: el objetivo no se cumplía

Con la configuración por defecto, **los 12 endpoints quedaban por encima de 50 ms**:

| endpoint | mediana |
| --- | ---: |
| `/api/v1/spaces` | 114.93 ms |
| `/api/v1/notices` | 91.51 ms |
| `/api/v1/branding` | 87.66 ms |
| `/api/v1/academic-structure` | 86.86 ms |
| `/api/v1/me` | 67.77 ms |
| `/api/v1/admin/academic-structure/audit-events` | 72.04 ms |

## Dónde estaba el costo: no en las consultas ni en los bytes

Dos hipótesis, y las dos se responden con un script:

**¿Son bytes?** No. `medir-payload.mjs` mide el cuerpo de cada respuesta:

- `/api/v1/spaces` es el mayor con **17,5 kB**
- `/api/v1/branding` 1,1 kB, `/api/v1/me` 470 B
- `/api/v1/academic-structure` 94 B
- **`/api/v1/academic-catalog/programs`, `/api/v1/academic-periods` y `/api/v1/admissions/calls` devuelven 2 bytes** (`[]`) y aun así tardaban 57 a 86 ms

Un cuerpo vacío no se serializa lento. El costo no está en la respuesta.

**¿Son las consultas?** Tampoco, necesariamente. `/api/v1/spaces` era **el más lento** y no toca MySQL:
`ClasspathPublicSpaceDirectoryAdapter` carga el snapshot una vez en el constructor y `snapshot()`
devuelve el mismo objeto en memoria. Su costo era esperar.

**Quedaba la contención.** `application.properties` no declara nada del pool, así que HikariCP usa su
defecto de **10 conexiones**, contra una concurrencia de 20: la mitad de las peticiones simultáneas se
quedaba esperando conexión.

## El experimento, con las variables separadas

Cambiar dos cosas a la vez y atribuir el resultado a la que uno quiere es el error clásico. Se midieron
tres configuraciones en el mismo host, con la misma carga declarada:

| configuración | endpoints con mediana ≥ 50 ms |
| --- | ---: |
| defecto (pool 10) | **12 de 12** |
| pool 24 **y** 24 conexiones ociosas | 3 de 12 |
| **pool 24, ociosas por defecto** | **2 de 12** |

La segunda fila cambia dos variables. La tercera las separa: **precalentar conexiones ociosas no
compra latencia y consume conexiones del servidor**, así que `minimum-idle` se queda en su valor por
defecto. La perilla que importa es el tamaño máximo del pool.

## El cambio

Una línea en `application.properties`:

```properties
spring.datasource.hikari.maximum-pool-size=${DB_POOL_MAX_SIZE:24}
```

24 no es un número mágico: es ligeramente mayor que la concurrencia medida, que es lo que evita la
cola. MySQL acepta 151 conexiones por defecto, así que 24 queda muy por debajo. Se deja como variable
de entorno para poder recalibrarla contra la concurrencia real de la institución.

## Resultado con la configuración del repositorio

| endpoint | mediana | p95 | p99 |
| --- | ---: | ---: | ---: |
| `/api/v1/me` | 28.78 ms | 57.80 ms | 69.39 ms |
| `/api/v1/branding` | 35.11 ms | 101.66 ms | 179.51 ms |
| `/api/v1/academic-structure` | 42.44 ms | 106.63 ms | 139.09 ms |
| `/api/v1/admin/academic-structure` | 26.78 ms | 54.94 ms | 73.20 ms |
| `/api/v1/academic-catalog/programs` | 19.81 ms | 45.55 ms | 58.93 ms |
| `/api/v1/admin/academic-catalog/drafts` | 27.30 ms | 53.58 ms | 76.26 ms |
| `/api/v1/academic-periods` | 16.82 ms | 41.66 ms | 52.07 ms |
| `/api/v1/admin/academic-periods` | 16.16 ms | 30.50 ms | 48.03 ms |
| `/api/v1/notices` | 35.95 ms | 69.78 ms | 123.23 ms |
| `/api/v1/admissions/calls` | 21.48 ms | 38.64 ms | 50.31 ms |
| `/api/v1/spaces` | 22.60 ms | 72.65 ms | 98.15 ms |
| `/api/v1/admin/academic-structure/audit-events` | 24.11 ms | 79.74 ms | 149.02 ms |

**Endpoints con mediana ≥ 50 ms: 0 de 12.** El peor promedio observado en algún endpoint fue 55,62 ms.

## Lo que este número NO dice

No declara el objetivo institucional cumplido, y el script lo dice en su propia salida.

- La corrida anterior con **la misma configuración** dio 2 de 12 por encima. El margen es fino: entre
  corridas el host mueve un par de endpoints de un lado a otro. La mediana entre repeticiones reduce esa
  variación, no la elimina.
- Es un Compose de desarrollo en una máquina, con 44 tablas y **sin datos institucionales**. No es una
  medición representativa de la carga real.
- Los p95 siguen entre 30 y 180 ms. Un promedio bajo 50 con un p95 de 180 significa cola: hay
  peticiones que se sienten lentas aunque el promedio cumpla.

## Verificación

- `mvnw verify`: **436 pruebas, 0 fallos, 13 omitidas**, `BUILD SUCCESS`. El perfil `test` usa SQLite,
  así que el cambio de pool no altera las pruebas.
- Archivos: `latencia-carga-2026-10-06.txt` (defecto), `latencia-carga-pool24-2026-10-06.txt` (pool 24
  con precalentado), `latencia-carga-pool24-sinidle-2026-10-06.txt` (pool 24 solo),
  `latencia-carga-final-2026-10-06.txt` (configuración del repo), `payload-2026-10-06.txt`.

## Cómo reproducir

```
docker compose up -d
node docs/evidence/round-2026-10-05-carga/medir-carga.mjs salida.txt
node docs/evidence/round-2026-10-05-carga/medir-payload.mjs
```

Variables: `PETICIONES` (200), `CONCURRENCIA` (20), `REPETICIONES` (5), `BASE` (localhost:8080).

## Pendiente

- Repetir contra el tamaño de datos real cuando exista, y con la concurrencia que traffique la
  institución. Este número es del entorno de desarrollo, no del sistema.
- Los p95 de 100 a 180 ms en `/api/v1/branding` y `/api/v1/academic-structure` son cola real. La
  siguiente pregunta no es el promedio sino por qué el percentil 95 se va.
