# Runbook de desarrollo local

## Requisitos

- Docker Desktop con Docker Compose v2.23 o posterior y motor en ejecución.
- Git y GitHub CLI configurado para el repositorio público `open-university-os`.
- Para compilar Java directamente en el host: SDKMAN con la versión declarada en `.sdkmanrc` (`25.0.4-tem`). El flujo Docker usa una imagen Maven basada en JDK 25.
- Para pruebas del frontend en el host: Node.js 24 y npm.

## Integración continua

Cada `push` a `develop`, `pull_request` dirigido a `develop` y ejecución manual ejecutan un único workflow, `.github/workflows/ci.yml`, con dos jobs independientes. El job `frontend` instala el lockfile con Node 24 y ejecuta `npm test`, `npm run build` y `npm run lint` sobre `frontend/`. El job `backend` toma Java 25 desde `.sdkmanrc`, ejecuta Maven `verify` y activa los contratos MySQL contra un servicio efímero MySQL 8.4 del runner. Los datos de prueba son sintéticos, la base no usa volumen persistente y el pipeline no recibe secretos de producción ni conecta al Compose local.

El perfil MySQL de latencia se ejecuta aparte con la carga, muestras y concurrencia definidas en la sección [contrato y perfil MySQL de paginación curricular](#contrato-y-perfil-mysql-de-paginación-curricular). Sus promedios locales no certifican el SLO institucional ni se comparan directamente con un runner hospedado.

El helper `tools/use-sdkman-java.ps1` lee la versión exacta de `.sdkmanrc`; no depende de `sdk current` y solo cambia el entorno de la sesión actual. Prueba esa selección con `Invoke-Pester -Script .\tools\use-sdkman-java.Tests.ps1` desde la raíz del repositorio.

## Preparar el checkout

```powershell
gh repo clone jdsalasca/open-university-os
Set-Location open-university-os
git switch develop
```

El monorepo contiene `backend/` y `frontend/` como contenido versionado. No hay submódulos que inicializar.

## Iniciar y observar

```powershell
docker compose config --quiet
docker compose up --build -d --wait
```

En una segunda terminal:

```powershell
docker compose watch --no-up
```

`compose watch` permanece activo en esa terminal. Los cambios bajo `frontend/src` se sincronizan a Vite y activan HMR; cambios de manifiestos reconstruyen la imagen. Los cambios bajo `backend/src` reinician el proceso Maven/Spring; cambios al `pom.xml` reconstruyen el contenedor.

Endpoints locales: UI `http://localhost:5173`, API `http://localhost:8080`, salud `http://localhost:8080/actuator/health`. El proxy de Vite dirige `/api` y `/assets` al servicio backend dentro de la red privada de Compose.

La vista previa del catálogo está en `http://localhost:5173/#programas`. El API público es `GET /api/v1/academic-catalog/programs`; al inicio responde `[]` y solo incluye programas con una versión publicada. `GET /api/v1/academic-catalog/programs/{programId}/curricula` lista versiones publicadas. La marca institucional `programs.available` sigue desactivada aunque se pueda abrir la ruta de preview.

El panel administrativo muestra el enlace «Descargar plantilla CSV» incluso sin sesión. Descarga el contrato vigente desde `GET /api/v1/academic-catalog/curriculum-template`, que devuelve un archivo UTF-8 generado desde los encabezados Java y no accede a MySQL.

Con el permiso `academic:catalog:write` en un entorno autorizado, selecciona el CSV y pulsa **Validar CSV** para revisar metadata y una muestra de hasta 10 asignaturas. La ruta `POST /api/v1/admin/academic-catalog/import-previews` vuelve a validar todo el archivo, pero no crea borradores ni eventos. Revisa el resumen y pulsa **Crear borrador**; el servidor recibe y valida nuevamente el archivo antes de guardarlo en una transacción. Cambiar el archivo limpia la muestra anterior. La cola de revisión requiere `academic:catalog:read`, carga 25 borradores por respuesta y acepta un máximo de 100 mediante un cursor de continuación. Crear un borrador reinicia la cola desde el más reciente; publicar vuelve a consultar la posición vigente y reinicia desde el inicio si quedó vacía. La previsualización local continúa sujeta a autenticación y no habilita la carga institucional desde Compose.

## Variables locales

Compose ofrece credenciales sencillas solo para desarrollo. Para cambiarlas, copia `.env.example` a `.env`, actualiza claves y reinicia el proyecto. `.env` queda fuera de Git. Las variables `UPTC_OIDC_ISSUER_URI` y `UPTC_OIDC_AUDIENCE` se dejan vacías; la sesión institucional sigue sin configurar. En el preview, abre `http://localhost:5173`, pulsa **Entrar al preview local** y confirma la etiqueta visible «Desarrollador local · modo preview». Backend emite un bearer aleatorio de cuatro horas solo en su perfil Spring `local-preview`, consulta permisos mediante `/api/v1/me` y lo revoca al salir. No hay token ni contraseña fijos. Tras recargar hay que volver a entrar; al reiniciar backend se invalidan sus sesiones. Usa únicamente datos sintéticos: la sesión habilita las operaciones disponibles sobre la base MySQL local. El detalle del límite está en [ADR-0004](../architecture/decisions/ADR-0004-local-preview-developer-session.md).

MySQL escucha solo en `127.0.0.1:3307` y conserva datos en `mysql-data`. `docker compose down` conserva volúmenes; `docker compose down -v` elimina la base y activos locales.

Las conexiones MySQL del backend fuerzan `connectionTimeZone=UTC` y `forceConnectionTimeZoneToSession=true`. Si se define `DB_URL` fuera de Compose, conserva ambos parámetros: las columnas `TIMESTAMP(6)` y los cursores usan una línea temporal UTC sin ambigüedades de horario de verano.

## Validación

```powershell
docker compose ps
Invoke-RestMethod http://localhost:8080/actuator/health
Invoke-RestMethod http://localhost:8080/api/v1/branding
```

Pruebas frontend: `npm ci`, `npm test`, `npm run build`, `npm run lint` desde `frontend/`. Pruebas backend: `backend\mvnw.cmd verify` en PowerShell o `./mvnw verify` en Git Bash desde `backend/`; las pruebas usan H2. El arranque Compose ejecuta migraciones Flyway sobre MySQL real de desarrollo.

Comprobaciones manuales del stack:

```powershell
docker compose ps
Invoke-RestMethod http://localhost:8080/actuator/health
Invoke-RestMethod http://localhost:8080/api/v1/academic-catalog/programs
Invoke-WebRequest http://localhost:8080/api/v1/academic-catalog/curriculum-template | Select-Object StatusCode,Headers
docker compose exec -T mysql sh -lc 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" -Nse "SELECT version FROM flyway_schema_history WHERE success = 1 ORDER BY installed_rank"'
```

La última consulta debe mostrar las migraciones aplicadas, incluida `5`. Para comprobar que la importación administrativa rechaza anónimos sin guardar nada, ejecuta el siguiente smoke test PowerShell con el archivo de encabezados vacío de filas; la respuesta esperada es `401 Unauthorized`:

```powershell
$http = [System.Net.Http.HttpClient]::new()
$form = [System.Net.Http.MultipartFormDataContent]::new()
$csv = [System.IO.File]::ReadAllBytes((Resolve-Path 'docs/templates/academic-curriculum-template.csv'))
$content = [System.Net.Http.ByteArrayContent]::new($csv)
$content.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse('text/csv')
$form.Add($content, 'file', 'template.csv')
$response = $http.PostAsync('http://localhost:8080/api/v1/admin/academic-catalog/imports', $form).GetAwaiter().GetResult()
$response.StatusCode
if ($response.StatusCode -ne [System.Net.HttpStatusCode]::Unauthorized) { throw "Esperaba 401 y recibí $([int]$response.StatusCode)" }
$response.Dispose(); $content.Dispose(); $form.Dispose(); $http.Dispose()
```

La plantilla solo declara el contrato de columnas; no contiene oferta académica. Una solicitud autenticada con `academic:catalog:write` sigue requiriendo datos completos válidos y nunca convierte este entorno en un sistema institucional autorizado. Las variables de importación `ACADEMIC_CATALOG_IMPORT_MAX_FILE_BYTES` y `ACADEMIC_CATALOG_IMPORT_MAX_ROWS`, definidas en `.env`, pueden ajustar límites hacia abajo, sin superar los máximos del dominio (2 MiB/10 000 filas); el arranque valida estos topes.

### Carga por pantalla React

`npm run build` genera el manifiesto y falla si se superan los presupuestos: entry hasta 280.000 B JS/21.000 B CSS; ruta `/#programas` hasta 326.000 B JS/48.000 B CSS; chunk OIDC diferido hasta 75.000 B JS, incluidas sus dependencias estáticas. El techo de programas subió 1.000 B (0,3 %) para esta entrega funcional; se debe revisar con el perfil de rendimiento posterior. El build limpio del 1 de octubre de 2026 tras `npm ci` midió 265.982 B JS y 19.281 B CSS en el entry; `/#programas` suma 295.986 B JS y 41.470 B CSS, mientras que OIDC diferido ocupa 68.637 B JS. En unidades redondeadas, el entry mide 265,98 kB JS (gzip 81,41 kB) y 19,28 kB CSS (gzip 4,93 kB); la ruta de programas suma 295,99 kB JS + 41,47 kB CSS, o 337,46 kB en total. Son 28,7 % menos bytes brutos que el bundle único previo de 401.132 B JS + 72.365 B CSS. Los chunks de pantalla pesan: catálogo 30,00/22,18 kB JS/CSS; estructura y periodos 62,63/21,11 kB; centro de identidad 24,81/17,17 kB. El OIDC se solicita después de arrancar el shell y solo al restaurar sesión con configuración activa (17,41 kB gzip). `npm test` cubre el cálculo, límites y separación dinámica con datos sintéticos.

El build local del 2 de octubre de 2026, después de añadir el preview temporal y excluir su cliente y su lógica del manifest de producción, midió entry 276.942 B JS/16.597 B CSS (gzip: 85.050/4.020 B), ruta `/#programas` 325.282 B JS/38.834 B CSS y OIDC diferido 68.637 B JS (gzip: 17.410 B). Son tamaños del artefacto compilado; no miden latencia de red, LCP ni un SLO institucional.

### Contrato y perfil MySQL de paginación curricular

Desde la raíz del monorepo puedes repetir el perfil local:

```powershell
.\tools\verify-mysql-curriculum.ps1
```

El script crea un contenedor MySQL 8.4 único, temporal, sin volumen persistente y ligado a un puerto efímero de `127.0.0.1`. Ejecuta contratos de collation/escape, sesión UTC y paginación por cursor mientras se publica otro borrador; valida además que un cierre obsoleto de periodo produzca conflicto y no restaure una revisión de calendario antigua. También mide páginas con 10.000 entradas públicas y 10.000 borradores sintéticos, con 10 calentamientos y 50 muestras por consulta; selecciona Java 25 desde SDKMAN y usa Maven Wrapper. Al terminar elimina solo el contenedor de esa ejecución. No usa ni modifica el contenedor o volumen de MySQL de Compose.

Cuatro ejecuciones del 30 de septiembre de 2026 entre las 20:11 y 20:29 (UTC-5), con Java 25.0.4 de SDKMAN y el perfil indicado, mantuvieron las doce medias bajo el gate local `<50 ms` (rango: 10,964–25,258 ms). Hubo p99 de 170,006 ms en la cola de borradores en la primera corrida y 175,024 ms en búsqueda en la segunda; no reaparecieron en la tercera corrida con registro GC ni en la cuarta. Como cada escenario solo tiene 50 muestras y el p99 nearest-rank equivale aquí a la muestra máxima, esos p99 reflejan una observación aislada, no una estimación estable de la cola. El registro GC mostró pausas G1 de aproximadamente 4,6–7,7 ms, sin explicar esos outliers; su causa sigue sin establecerse. Corridas anteriores ya habían mostrado búsqueda hasta p95/p99 de 108,218/126,693 ms. La tabla completa está en [la especificación del perfil](../superpowers/specs/2026-09-30-curriculum-mysql-search-performance.md). Estas mediciones acreditan solo esta máquina y concurrencia 1. La carga y latencia representativas de UPTC, el hardware destino y el SLO institucional siguen pendientes de acuerdo con los responsables.

Como comprobación adicional, el 30 de septiembre se habilitaron los contratos opcionales contra el MySQL 8.4 que usa Compose para la vista previa. Java del contenedor backend: 25.0.4.1; esquema Flyway: 11. Pasaron los siete contratos MySQL, incluidas las tres consultas con 10.000 filas sintéticas, 10 calentamientos, 50 muestras, página 100 (25 en cola) y concurrencia 1. Las medias más recientes fueron 11,259 ms (cola de borradores), 9,746 ms (catálogo sin filtro) y 16,759 ms (búsqueda por subcadena), todas bajo el presupuesto local `<50 ms`. Los datos sintéticos se revirtieron en la transacción y las consultas posteriores de salud, catálogo, estructura y periodos conservaron el estado esperado. Ver la tabla y percentiles en [la especificación del perfil](../superpowers/specs/2026-09-30-curriculum-mysql-search-performance.md). Este perfil local no certifica la carga ni el SLO de producción.

Desde el 1 de octubre de 2026 el mismo script también ejecuta `AcademicStructureMySqlPerformanceContractTest`: 100 unidades, 20 sedes y 1.000 afiliaciones sintéticas, con medición separada de JDBC y JSON MockMvc; el fixture y sus relaciones se revierten. Cuatro corridas locales promediaron 16,083/30,425 ms (Compose, Java 25.0.3), 12,745/27,597 ms (MySQL temporal, SDKMAN Java 25.0.4), 14,208/27,675 ms (Compose, Java 25.0.3) y 12,201/26,970 ms (MySQL temporal, SDKMAN Java 25.0.4) para servicio/JDBC y respuesta MockMvc, respectivamente. La [especificación de lectura estructural](../superpowers/specs/2026-10-01-academic-structure-read-performance.md) detalla percentiles, configuración y limitaciones.
