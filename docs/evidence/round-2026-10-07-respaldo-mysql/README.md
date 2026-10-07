# Simulacro de respaldo y restauración de MySQL — 7 de octubre de 2026

## Por qué

El gate de producción exige copias de respaldo probadas. Una copia que nadie restaura es un deseo,
no un respaldo. `tools/verify-mysql-backup-restore.ps1` vuelca la base de desarrollo, la restaura en
un MySQL 8.4 desechable y compara tabla por tabla: catálogo, conteos y versión Flyway. Cualquier
diferencia sale con código distinto de cero.

## Cómo se ejecuta

```
.\tools\verify-mysql-backup-restore.ps1
.\tools\verify-mysql-backup-restore.Tests.ps1  # vía Invoke-Pester
```

Solo usa datos locales/sintéticos de desarrollo, nunca institucionales. El volcado vive en `%TEMP%`
y se borra al terminar; el MySQL temporal no tiene volumen persistente. Las credenciales son las de
desarrollo del compose, sobrescribibles por entorno. Nada de esto es un secreto de producción.

## Resultado

```
44 tablas, Flyway 27 en origen; 44 tablas, Flyway 27 en restauración.
Restauración idéntica: el respaldo sirve.
```

Pester: 4/4 (`Compare-RestoredDatabase` acepta un restore idéntico y reporta tabla ausente,
deriva de conteo y deriva de versión Flyway).

## Dos bugs del propio script, encontrados al medir

1. **Coerción de array a string.** `"${salida}"` une las líneas de `docker exec` con espacios, así que
   la lista de 44 tablas se volvía una sola "tabla" y el `COUNT` fallaba con un error de null. Se une
   con saltos de línea explícitos.
2. **`MAX(version)` como texto da 9, no 27.** La columna es `VARCHAR` y el orden lexicográfico pone
   `'9'` por encima de `'27'`. Se compara con `MAX(CAST(version AS UNSIGNED))`.

## Nota sobre el gate

Esto prueba que el respaldo **sirve**, no que exista una política de respaldos: frecuencia,
retención, custodia fuera del host y restauración en el servidor de producción siguen pendientes y
pertenecen a la decisión de operación con DTIC, no a este script.
