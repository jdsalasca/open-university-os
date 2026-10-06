# Ampliar el calendario público de admisiones 2027-I

## Objetivo

Completar `/#admisiones` con las fechas legibles del artículo 1 de la Resolución 111 de 2026 para pregrado presencial 2027-I, mantener los enlaces oficiales y corregir la presentación que mezclaba derechos pecuniarios con pago de matrícula.

## Alcance

- Mostrar en lectura solamente los hitos fechados que constan en el artículo 1.
- Mantenerlo como orientación pública; no recolectar información de aspirantes ni ejecutar selección, cobro o matrícula.
- Explicar que la fecha de pago de matrícula se consulta en el calendario académico 2027-I separado.
- Registrar la diferencia entre el considerando que menciona 2026-II y el título/artículo operativo que fijan 2027-I, sin inventar interpretación adicional.
- Actualizar el hallazgo de fuentes y la hoja de ruta; no cambia la arquitectura ni los flujos del sistema.

## Secuencia y verificación

1. Añadir pruebas AAA para hitos, límites operativos y advertencias; comprobar que fallan por el contenido ausente.
2. Actualizar los datos públicos y el aviso de fuente con el mínimo código necesario.
3. Ejecutar pruebas, lint y build del frontend; revisar el diff y validar `/#admisiones` con captura visual.
4. Integrar el commit en `develop`, publicar a `origin/develop` y verificar CI y SHA remoto.

## Criterios de aceptación

- Fechas del artículo 1 están visibles y enlazadas a la Resolución 111.
- El calendario separa pago de derechos pecuniarios y pago de matrícula.
- El aviso de discrepancia distingue considerando y artículo 1.
- La pantalla no contiene formulario ni campos de aspirante.
- Pruebas, lint, build y captura visual confirman el resultado.

## Archivos previstos

- `frontend/src/features/admissions/AdmissionsCalendarPage.test.tsx`
- `frontend/src/features/admissions/AdmissionsCalendarPage.tsx`
- `frontend/src/features/admissions/official2027ICalendar.ts`
- `docs/discovery/uptc-inscribete-2026.md`
- `docs/ROADMAP.md`
