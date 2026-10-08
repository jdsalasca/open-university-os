# Simulacro de respaldo de volúmenes — 7 de octubre de 2026

## Por qué un script aparte

El simulacro de MySQL cubre la base relacional. Los activos de marca viven en el volumen
`branding-assets`, que hoy está **vacío (0 archivos)**: respaldarlo y restaurarlo no probaría nada,
porque vacío contra vacío siempre coincide. Este script prueba el **mecanismo** con volúmenes
desechables que sí tienen contenido, sin tocar ningún volumen de la aplicación.

## Cómo se ejecuta

```
.\tools\verify-volume-backup.ps1
Invoke-Pester -Script .\tools\verify-volume-backup.Tests.ps1
```

1. Crea un volumen desechable y siembra archivos canario sintéticos (texto + 2 KiB aleatorios).
2. Lo respalda a un tar en `%TEMP%`.
3. Restaura el tar en otro volumen desechable.
4. Compara árbol contra árbol por sha256 con `Compare-VolumeTree`; cualquier diferencia sale con
   código distinto de cero.
5. Borra los dos volúmenes y el tar.

## Resultado

```
2 archivos en origen; 2 en restauración.
Restauración idéntica: el mecanismo de respaldo sirve.
```

Pester: 4/4 (acepta árbol idéntico; reporta archivo ausente, deriva de bytes y restauración vacía).

## Dos bugs del propio script

1. **`foreach ($tipo, $nombre in ...)` no existe en PowerShell.** Esa desestructuración de tuplas es de
   otro lenguaje; el parser lo rechaza. La lista de limpieza es un array simple de nombres.
2. **`$(...)` dentro de comillas dobles se evalúa localmente.** El comando `sh` que lista archivos con
   su sha256 llevaba `$(sha256sum ...)` sin escapar y PowerShell intentaba ejecutarlo aquí. Cada `$`
   interno va escapado.

## Nota sobre el gate

Igual que con MySQL: que el mecanismo sirva no es una política de respaldos. Frecuencia, retención y
custodia pertenecen a la decisión de operación.
