# Universiry — Open University, monorepo `open-university-os`

Plataforma para apoyar la digitalización de la UPTC y de otras universidades mediante servicios digitales robustos y confiables. El código se publica en un único repositorio, [`open-university-os`](https://github.com/jdsalasca/open-university-os), con `develop` como rama de integración: el backend Spring Boot en `backend/`, el frontend Vite/React/TypeScript en `frontend/` y `compose.yaml` en la raíz. La publicación del código no acredita aprobación institucional ni habilita datos o trámites reales.

## Clonar y levantar

```powershell
gh repo clone jdsalasca/open-university-os
Set-Location open-university-os
git switch develop
docker compose up --build -d --wait
```

En una segunda terminal del checkout:

```powershell
docker compose watch --no-up
```

- Frontend: http://localhost:5173
- API de desarrollo: http://localhost:8080
- MySQL local: `127.0.0.1:3307` (solo enlazado a loopback)
- Salud del backend: http://localhost:8080/actuator/health

Los valores de base de datos incluidos son solo para desarrollo local; se pueden reemplazar mediante `.env` ignorado por Git. `docker compose down` detiene el entorno. Los datos de MySQL se conservan en el volumen local `mysql-data`; usa `docker compose down -v` solo si deseas borrarlos.

Compose no configura SSO institucional. La API rechaza cambios administrativos mientras no haya un emisor OIDC/audience y roles autorizados; no usar datos personales reales.

## Catálogo académico v0

La vista previa de programas de **pregrado presencial** está en <http://localhost:5173/#programas>. Permite buscar programas por código, nombre, facultad o sede; consultar asignaturas de una versión publicada, filtrarlas por semestre o por código/nombre y recorrerlas en páginas de hasta 100 filas. La administración carga la cola protegida de borradores por cursor (25 por respuesta, máximo 100), permite revisar el detalle y conserva publicación con control backend. El API público oculta borradores y el catálogo local empieza vacío. La carga CSV, la revisión y la publicación requieren permisos `academic:catalog:read` / `academic:catalog:write`, aún sin mapeo de grupos institucionales en Compose. La ruta de vista previa no significa que el módulo esté habilitado: `programs.available` permanece en `false`.

El contrato de columnas está en [academic-curriculum-template.csv](docs/templates/academic-curriculum-template.csv); el archivo solo contiene encabezados. La pantalla ofrece su descarga mediante un endpoint generado desde el esquema Java, para que el navegador no mantenga una copia de los nombres de columna. La API pública devuelve metadata separada de las asignaturas y ofrece páginas de hasta 100 filas con búsqueda por código/nombre y filtro por semestre; solo expone versiones `PUBLISHED` y reutiliza el modelo normalizado. El diseño, las siete tablas y las reglas de cohorte están documentados en [C4](docs/architecture/c4.md), [modelo de datos](docs/architecture/data-model.md) y [flujo de importación/publicación](docs/architecture/process-flows.md). El catálogo no maneja aspirantes ni registros de estudiantes.

## Guía pública de espacios v0

Abre <http://localhost:5173/#espacios> para buscar por nombre, municipio, dirección y tipo dentro de seis sedes, once CREAD y cuatro puntos de servicio publicados por UPTC. La consulta `GET /api/v1/spaces` es pública y de solo lectura. Cada ficha enlaza su fuente; solo ofrece búsqueda en OpenStreetMap tras un clic y cuando la fuente publica una dirección. La lista es parcial: no contiene mapa integrado, geolocalización, rutas interiores ni inventario de accesibilidad. El módulo puede renombrarse y ocultarse de la navegación desde la identidad visual.

## Borradores de oferta académica v0

En `/#academia`, el panel protegido administra grupos en borrador para un periodo regular o intersemestral y una asignatura de currículo publicado. Permite crear, corregir con control de versión y consultar auditoría. La capacidad y las fechas son propuestas; no hay publicación, disponibilidad ni inscripción/matrícula. Requiere `academic:offerings:read` y, para modificar, `academic:offerings:write`. Flyway V23 agrega `academic_offering_draft` y `academic_offering_draft_audit_event`; no crea datos iniciales. El uso real depende de validar responsables, reglas y la frontera con SIRA/Fase III/UPTConecta. Detalles en [C4](docs/architecture/c4.md), [modelo de datos](docs/architecture/data-model.md), [flujo](docs/architecture/process-flows.md) y [cronograma](docs/ROADMAP.md).

## Estructura

- `backend/`: Java 25 y Spring Boot; `.sdkmanrc` fija `25.0.4-tem` para el entorno host.
- `frontend/`: Vite, React, TypeScript y SCSS. Contenido del mismo repositorio, sin submódulo.
- `compose.yaml`: servicios locales frontend, backend, MySQL 8.4 y MongoDB 8 con Compose Watch.
- `docs/`: cronograma, alcance, modelo de datos, procesos, arquitectura C4 y runbooks.

Consulta [el README del backend](backend/README.md) para su arquitectura, comandos SDKMAN y límites operativos.

## Java del host

`.sdkmanrc` fija `25.0.4-tem`. En PowerShell selecciona el candidato SDKMAN solo para esa sesión antes de Maven:

```powershell
& .\tools\use-sdkman-java.ps1
java -version
.\backend\mvnw.cmd -f backend\pom.xml verify
```

El helper lee la versión exacta de `.sdkmanrc` y falla si ese candidato no está instalado; no depende de que SDKMAN `current` apunte a Java 25. Verifica esta selección con `Invoke-Pester -Script .\tools\use-sdkman-java.Tests.ps1`.

Consulta [desarrollo local](docs/runbook/local-development.md) y [el cronograma](docs/ROADMAP.md) antes de integrar cambios.

## Latencia de desarrollo

La [línea base local](docs/performance-baseline.md) registra promedio, mediana, P95 y máximo de rutas públicas con el snapshot vacío. Repite la lectura con `powershell -NoProfile -File .\tools\measure-api-latency.ps1`; no representa carga institucional ni un SLA de producción.

## Portada y consultas públicas

`/#resumen` es la portada predeterminada y muestra herramientas administrativas únicamente según los permisos efectivos que devuelve `/api/v1/me`; el backend revalida cada operación. `/#inicio` sigue siendo el Centro de Identidad Visual. `/#programas` separa el directorio informativo estático de la sección curricular interna, que inicia vacía hasta que exista una carga autorizada. La instantánea pública capturada el 2 de octubre de 2026 contiene 79 programas en 11 facultades; 72 conservan la marca textual «Programa ofertado» de la fuente. Esa marca no confirma convocatoria abierta, fechas vigentes, cupos ni admisión. El asset se filtra en el navegador y no carga ni modifica el maestro curricular interno. La metodología y la fuente UPTC están en [la ficha del directorio público](docs/discovery/uptc-undergraduate-directory-snapshot-2026-10.md). `/#estudiantes` enlaza fuentes institucionales sin consultar matrícula, horarios o calificaciones personales. Los módulos sintéticos no se montan desde `frontend/src/App.tsx` ni aparecen como rutas de producto.
