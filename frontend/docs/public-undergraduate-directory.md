# Directorio público de programas de pregrado

La ruta `/#programas` presenta dos vistas separadas: el directorio de programas publicado por la UPTC y los planes curriculares que Universiry publique para una cohorte. El directorio es de consulta y no modifica inscripciones, cupos, matrículas ni procesos de admisión.

## Procedencia de la instantánea

- Página fuente: [Programas académicos de pregrado UPTC](https://www.uptc.edu.co/sitio/portal/sitios/programas_ofer/pregrado.html).
- Script público que aplica los filtros de la página: [ofe_pre.js](https://www.uptc.edu.co/sitio/system/modules/alkacon.mercury.template/js-adicional/programas/ofe_pre.js?v=2.0.1).
- La página indica actualización al 15 de septiembre de 2026. La instantánea local registra captura del 2 de octubre de 2026.
- La captura conserva las 79 filas de pregrado que pasan el filtro público base (`row[13] === "Pregrado"` y `row[17] === "SI"`); 72 llevan la marca `"SI"` que la página presenta como «Programa ofertado» (`row[10]`). Estos marcadores describen el catálogo publicado; no acreditan que una convocatoria esté abierta ni definen elegibilidad, fechas, cupos o selección.
- En la revisión de la fuente del 3 de octubre de 2026, esos mismos filtros devolvieron 79 filas y 72 marcas. El código fuente observado puede cambiar cuando la UPTC actualice la página.
- Solo se guardan nombres y atributos públicos de los programas. La captura no incluye personas, postulaciones, matrículas ni reglas institucionales.

## Ejecución y actualización

`PublicUndergraduateDirectory` descarga `uptcUndergraduateCatalog.snapshot.json` como un asset estático del mismo origen. La aplicación no llama al sitio UPTC durante la navegación. Para actualizarla, captura de nuevo únicamente los campos del contrato `PublicUndergraduateProgram`, revisa cada URL contra `www.uptc.edu.co`, actualiza `capturedAt` y los conteos fijados por `publicUndergraduateCatalogClient.test.ts`, y ejecuta `npm test`, `npm run lint` y `npm run build`.

El directorio conserva la atribución a la página oficial y muestra la fecha de la fuente y de la captura. Si el asset falla, permite reintentar y enlaza la página UPTC. Los controles de búsqueda y filtros operan sobre la instantánea local.

## Alcance de arquitectura

Este corte agrega una vista diferida y un asset estático al monolito frontend existente. No agrega endpoints, tablas, migraciones ni dependencias entre dominios; el diagrama C4 no cambia.
