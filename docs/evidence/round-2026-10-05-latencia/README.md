# Latencia de consultas criticas — 5 de octubre de 2026

## Que se midio

`medir-latencia.mjs` abre una sesion de preview en el Compose local, dispara **20 peticiones por
endpoint** en serie y reporta promedio, mediana, p95 y maximo. Al terminar **revoca la sesion**, porque
el limite de sesiones activas del backend es corto.

```
node docs/evidence/round-2026-10-05-latencia/medir-latencia.mjs [archivo-de-salida]
```

Ambiente: Compose `open-university-os`, MySQL 8.4 con **44 tablas**, backend y MySQL en contenedores
separados, sesion sintetica de `local-preview`. Sin datos institucionales: 6 colores, 9 modulos y
0 banners publicados.

## Hallazgo

`GET /api/v1/branding` era el endpoint mas lento: 92.46 ms de promedio frente a 18 ms de un endpoint
de una sola consulta. El problema **no eran las filas** —6 colores, 9 modulos, 0 banners, con indice
por `revision_id`— sino los viajes: la lectura encadenaba el puntero de revision y la cabecera en dos
consultas separadas, y cada consulta paga el tiempo de red entre contenedores.

`BrandingQueryTripCountTest` cuenta las sentencias de verdad, envolviendo el `DataSource` en un proxy
que registra cada `prepareStatement`. Antes de tocar produccion marcaba **4 viajes por lectura**; con
el `JOIN` del puntero y la cabecera son **3**.

## Cambio

`JdbcBrandingRepositoryAdapter.findCurrentPublic` resuelve el puntero publicado y la cabecera en un
solo `JOIN`. No hay cache y no hay consulta agregada de JSON.

Por que no hay cache: `findCurrentPublic` recibe el instante de la peticion para filtrar banners por
vigencia, asi que una ventana de tiempo serviria una configuracion filtrada para otro instante. Una
implementacion con ventana de 30 s rompia `BrandingRepositoryIntegrationTest`, que inserta banners por
SQL y espera verlos en la lectura inmediata. El cliente ya guarda 30 s por su cuenta con el
`Cache-Control: max-age=30` del controlador.

Por que no hay `JSON_ARRAYAGG`: reduce viajes, pero mete un parser de JSON a mano en el camino caliente
y necesita `CAST` a tipo numerico en MySQL y SQLite. La escalera mas simple que aguanta es el `JOIN`.

## Resultados

Tres corridas el mismo dia en el mismo host. **El host fluctuaba**, asi que las cifras absolutas no son
comparables entre dias:

| Corrida | branding promedio | sesion (12 endpoints) |
| --- | ---: | ---: |
| Antes, host cargado | 92.46 ms | 40.39 ms |
| Base, host tranquilo | 48.88 ms | 35.11 ms |
| Con `JOIN`, host cargado | 39.89 ms | 27.51 ms |

La unica afirmacion defendible es la que no depende de la maquina: **un viaje menos a MySQL por lectura
publica**, probada contando sentencias y verificada por mutacion (revertir el `JOIN` devuelve el test a
rojo con 40 sentencias en vez de 30).

Lo que **no** se puede afirmar: que el objetivo de `<50 ms` este cumplido. El mismo codigo base midio
92 ms y 49 ms en horas distintas del mismo dia, un factor de dos. Un runner hospedado no certifica el
SLO institucional; hace falta medicion con volumen, concurrencia y muestras declarados.

En la ultima corrida ningun endpoint de los 12 quedo sobre 50 ms de promedio, pero los p95 llegaron a
177 ms. Ver `latencia-2026-10-05.txt` para la salida completa.

## Pendiente

- `/api/v1/notices` y `/api/v1/spaces` aparecen en la primera medicion por encima de 50 ms, pero en las
  corridas siguientes quedaron por debajo sin tocar su codigo: es ruido del host, no un hallazgo.
- Los tres viajes que quedan son uno por coleccion. Bajarlos a uno requiere el agregado de JSON que se
  descarto, o una tabla de configuracion desnormalizada que solo tiene sentido si el volumen lo pide.
- Repetir la medicion con concurrencia y volumen declarados antes de reportar cualquier numero como
  cumplimiento del objetivo institucional.
