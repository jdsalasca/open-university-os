# Respuestas de error de la API - 5 de octubre de 2026

Audita si una petición que falla puede filtrar al cliente la maquinaria interna del servidor: nombre de
clase Java, traza, consulta SQL, ruta del servidor o nombre de excepción.

## Diez casos provocados

`audit-errors-api.mjs` emite una sesión real de `local-preview` y provoca diez fallos distintos. Cada
respuesta se busca contra siete patrones de fuga.

| Caso | Estado | Limpio |
| --- | ---: | --- |
| Recurso inexistente (UUID al vacío) | 404 | sí |
| Cuerpo vacío en alta | 400 | sí |
| Tipos y fechas inválidos | 400 | sí |
| UUID inválido en la ruta | 403 | sí |
| Código territorial inválido (`ZZ`) | 400 | sí |
| Código territorial con longitud imposible | 400 | sí |
| Petición sin token | 401 | sí |
| Método no admitido en la ruta | 403 | sí |
| Parámetro de consulta mal formado (`limit=abc`) | 400 | sí |
| Límite fuera de rango (`limit=99999`) | 400 | sí |

| Resultado | Valor |
| --- | --- |
| Casos con fuga de detalle interno | **0** |
| Respuestas 5xx | **0** |

Salida en `error-audit.txt` y `error-audit.json`.

## Por qué hoy no hay fuga

`ApiExceptionHandler` es un `@RestControllerAdvice` que responde siempre con
`new ApiError(code, messages.message(clave, locale))`: el cuerpo lleva **un código estable y un mensaje
traducido**, nunca el texto de la excepción. Incluso `DataAccessException` se traduce a
`internal_error` con un mensaje genérico, de modo que una consulta SQL fallida no llega al cliente.

## El defecto encontrado y corregido

`application.properties` declaraba `server.error.include-message=never` pero **no** el equivalente de
traza. Spring Boot tiene `never` por defecto, así que no había una fuga activa, pero la defensa
dependía del valor por defecto de la dependencia. Ahora queda explícito:

```properties
server.error.include-message=never
server.error.include-stacktrace=never
```

Un cambio de versión o un ajuste futuro ya no puede abrirlo por accidente.

## `ApiErrorExposureGuardTest`

Tres pruebas en el backend, donde corre su CI:

1. `include-message` e `include-stacktrace` deben quedar **explícitos** en `never`.
2. Ningún archivo con `@ExceptionHandler` puede usar `.getMessage()`.
3. `ApiError` debe seguir siendo un record de exactamente dos campos, `error` y `message`, sin traza,
   excepción ni marca de tiempo.

### El guard no tenía dientes y lo demostré

La segunda prueba usaba una expresión regular que pretendía localizar el cuerpo de cada método
gestionado. **Inyecté una fuga real** en `assetNotFound` —devolver `ex.getMessage()` en lugar de la
clave del catálogo— y el guard pasó sin rechistar. Un guard que siempre pasa es peor que no tener
guard: da confianza falsa.

Se reescribió con un criterio simple y verificable: los manejadores son clases cortas y dedicadas a
una familia de errores, así que cualquier `.getMessage()` dentro de un archivo que declara
`@ExceptionHandler` es una fuga. Con el criterio nuevo **el guard falla** ante la fuga inyectada y
vuelve a verde al restaurarla.

## Verificación

- Prueba negativa: fuga inyectada detectada, código restaurado, suite verde.
- `backend/mvnw.cmd test`: **430 pruebas, 0 fallos, 0 errores, 13 saltadas**, `BUILD SUCCESS`. Las tres
  nuevas son la guarda.
- `npm test` del frontend no se ve afectado: el cambio es de backend.

## Nota sobre códigos de estado

Un `PATCH` sobre `/api/v1/admin/academic-structure/sites` y un `GET` sobre
`/api/v1/admin/academic-structure/units` responden **403**, no 405. No es un fallo de autorización: la
configuración cierra con `.requestMatchers("/api/v1/admin/**").denyAll()`, y esas rutas solo existen con
otros métodos. Es el precio de un cierre por defecto correcto, y conviene saberlo al depurar: un 403 en
esa zona significa "no hay regla explícita para este método", no "faltan permisos".
