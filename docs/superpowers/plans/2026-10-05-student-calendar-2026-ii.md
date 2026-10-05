# Plan: agenda pública de pregrado 2026-II

## Objetivo

Incorporar en `/#estudiantes` una lectura clara de las fechas que ACRA publica para el II semestre de 2026 y permitir una descarga personal `.ics`. Conservar las distinciones del calendario fuente por modalidad y población. La agenda es una instantánea editorial con fecha de consulta; no ejecuta trámites ni presenta información individual.

## Contrato del corte

- Fuente: https://uptc.edu.co/sitio/portal/sitios/universidad/vic_aca/adm_reg/2estu/est_pre.html (actualizada por ACRA el 17 de septiembre de 2026; consultada el 5 de octubre de 2026).
- Mostrar los 18 hitos publicados con textos, modalidades y poblaciones explícitas, aun cuando sus fechas ya hayan transcurrido.
- El archivo iCalendar usa eventos de día completo, convierte el fin inclusivo de la interfaz al `DTEND` exclusivo de iCalendar, incorpora fuente y aviso de confirmar cambios, y valida fechas e IDs.
- Extraer el serializador de admisiones existente a un helper compartido y conservar el contrato del wrapper de admisiones.
- No añadir API, base de datos, formulario, autenticación, elegibilidad ni estados de transacción.

## Pasos y verificación

1. Añadir primero pruebas AAA para la API compartida iCalendar y la presentación/exportación de `#estudiantes`; ejecutar y guardar el fallo esperado.
2. Extraer la serialización y descarga compartida, con cobertura de escapes UTF-8, ID duplicado, fecha inválida, rango invertido y fin inclusivo.
3. Incorporar instantánea tipada de 18 hitos y una sección accesible para navegar y descargar el calendario.
4. Ajustar SCSS con tokens existentes para escritorio y móvil; no usar estilos en línea.
5. Ejecutar pruebas, build, lint y revisar visualmente la ruta por navegador; comprobar el payload `.ics` descargado.
6. Actualizar ficha de fuentes, flujo y roadmap. Integrar el commit por fast-forward en `develop`, publicar el SHA autorizado, verificar CI y eliminar solo este worktree.

## Aceptación

- La interfaz comunica título del periodo, fuente, fecha visible de actualización, fecha de consulta y límites informativos.
- Los 18 hitos concuerdan con la instantánea ACRA revisada en la sesión y conservan modalidad/población publicada.
- La agenda se descarga como `.ics` válido y cada fecha final es inclusiva en la UI y exclusiva en `DTEND`.
- Las pruebas y calidad del frontend pasan; la captura revisada no presenta problemas de lectura, ajuste móvil, foco ni overflow.
- Los documentos explican procedencia y que ACRA/Registro Académico no se consideran formalmente designados como dueños.
