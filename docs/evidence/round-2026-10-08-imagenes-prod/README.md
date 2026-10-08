# Imágenes Docker de producción — 8 de octubre de 2026

## Lo que faltaba

El repo solo tenía `Dockerfile.dev` para ambos servicios: no existía forma de construir lo que se
publicaría. `frontend/Dockerfile` y `backend/Dockerfile` cierran ese hueco.

## Frontend: build estático + nginx

Multi-etapa (`node:24-alpine` → `nginx:alpine`). La app navega por fragmento (`#resumen`,
`#programas`, ...), que el navegador nunca envía al servidor: no hace falta reescritura SPA, servir
archivos basta. Caché: inmutables con hash a 1 año, `index.html` con `no-store`.

Cabeceras en cada respuesta: `X-Content-Type-Options: nosniff` y `Referrer-Policy`. La CSP de la
aplicación y el framing quedan fuera a propósito: una política inventada rompería el flujo OIDC y
pertenecen a la decisión del proxy con DTIC.

## Backend: build Maven + JRE non-root

Multi-etapa (`maven:3-eclipse-temurin-25` → `eclipse-temurin:25-jre`), usuario `app`, sonda de
readiness contra el actuador. La URL, el usuario y la clave de la base llegan por entorno; el perfil
`local-preview` no se activa; OIDC sigue cerrado.

## Verificación corriendo (no solo construyendo)

- Frontend en puerto efímero: `/` → **200** con `nosniff`, `Referrer-Policy` y `no-store`;
  `index-BlD9qlpn.js` → **200** con `immutable` + `nosniff`; `#programas` → **200**.
- Backend contra MySQL 8.4 desechable (migraciones Flyway reales en el arranque):
  `/actuator/health/readiness` → **`{"status":"UP"}` en 8 s**, proceso como usuario `app`.

## Un bug real encontrado al verificar

El documento volvía **sin** las dos cabeceras aunque `nginx.conf` las declaraba: `add_header` dentro
de un `location` **reemplaza** las heredadas, y `/` cae en `location = /index.html` por la directiva
`index`. Se repiten en cada bloque y `check-nginx-headers` (nuevo, en `npm test`) lo exige: quitar una
lo deja en rojo. El propio guard falló una vez por su regex comiéndose un comentario que menciona
`location`; ahora quita comentarios antes de parsear.
