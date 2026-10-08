# Im├ígenes Docker de producci├│n ÔÇö 8 de octubre de 2026

## Lo que faltaba

El repo solo ten├¡a `Dockerfile.dev` para ambos servicios: no exist├¡a forma de construir lo que se
publicar├¡a. `frontend/Dockerfile` y `backend/Dockerfile` cierran ese hueco.

## Frontend: build est├ítico + nginx

Multi-etapa (`node:24-alpine` ÔåÆ `nginx:alpine`). La app navega por fragmento (`#resumen`,
`#programas`, ...), que el navegador nunca env├¡a al servidor: no hace falta reescritura SPA, servir
archivos basta. Cach├®: inmutables con hash a 1 a├▒o, `index.html` con `no-store`.

Cabeceras en cada respuesta: `X-Content-Type-Options: nosniff` y `Referrer-Policy`. La CSP de la
aplicaci├│n y el framing quedan fuera a prop├│sito: una pol├¡tica inventada romper├¡a el flujo OIDC y
pertenecen a la decisi├│n del proxy con DTIC.

## Backend: build Maven + JRE non-root

Multi-etapa (`maven:3-eclipse-temurin-25` ÔåÆ `eclipse-temurin:25-jre`), usuario `app`, sonda de
readiness contra el actuador. La URL, el usuario y la clave de la base llegan por entorno; el perfil
`local-preview` no se activa; OIDC sigue cerrado.

## Verificaci├│n corriendo (no solo construyendo)

- Frontend en puerto ef├¡mero: `/` ÔåÆ **200** con `nosniff`, `Referrer-Policy` y `no-store`;
  `index-BlD9qlpn.js` ÔåÆ **200** con `immutable` + `nosniff`; `#programas` ÔåÆ **200**.
- Backend contra MySQL 8.4 desechable (migraciones Flyway reales en el arranque):
  `/actuator/health/readiness` ÔåÆ **`{"status":"UP"}` en 8 s**, proceso como usuario `app`.

## Un bug real encontrado al verificar

El documento volv├¡a **sin** las dos cabeceras aunque `nginx.conf` las declaraba: `add_header` dentro
de un `location` **reemplaza** las heredadas, y `/` cae en `location = /index.html` por la directiva
`index`. Se repiten en cada bloque y `check-nginx-headers` (nuevo, en `npm test`) lo exige: quitar una
lo deja en rojo. El propio guard fall├│ una vez por su regex comi├®ndose un comentario que menciona
`location`; ahora quita comentarios antes de parsear.

---

# Re-verificación de imágenes de producción — 8 de octubre de 2026

## Por qué otra vez

Las imágenes se verificaron una vez, pero el código siguió cambiando (avisos con `h1`, superficies
oscuras, indicador de foco, banner fuera de `main`). Un claim de "lista para publicar" caduca con
cada commit. Esta ronda reconstruye ambas imágenes del código actual y repite la verificación.

## Resultado

- **Frontend** (`universiry-frontend-prod:round2`): bundle con hash distinto al anterior, prueba de
  build fresco. `/` 200 con `nosniff` + `Referrer-Policy` + `no-store`; asset con `immutable`;
  `#programas` 200.
- **Backend** (`universiry-backend-prod:round2`): todo cacheado porque el código productivo no cambió
  desde la última verificación — dicho explícitamente en vez de fingir trabajo. Re-ejecutado contra
  MySQL desechable con migraciones reales: readiness **UP** (40 s esta vez, varianza del host
  compartido; la vez anterior 8 s), proceso como usuario `app`.
- Limpieza: los tres contenedores de prueba eliminados; ningún volumen ni red residual.

`ver-prod-rebuild.mjs` comprueba la imagen servida (título, banner, encabezados).
