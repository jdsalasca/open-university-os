# Imagen de producción del portal React. Solo contiene el build estático: nada de Vite, nada de
# node_modules, nada de código de desarrollo. La aplicación usa rutas con hash (`#resumen`,
# `#programas`, ...), así que el fragmento nunca viaja al servidor y no hace falta reescritura SPA:
# servir archivos estáticos basta.
#
# Lo que esta imagen NO resuelve, a propósito: TLS, el dominio final, la CSP de la aplicación y la
# política de framing pertenecen a la decisión del proxy de producción con DTIC
# (docs/security/frontend-production-gate.md). Aquí solo van las cabeceras que son seguras en
# cualquier origen: `nosniff` y `Referrer-Policy`.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
