# Qué ve la persona cuando el backend no responde — 5 de octubre de 2026

AGENTS.md exige estados de carga, error y vacío en todas las pantallas. Todas las rondas anteriores
midieron **con el backend sano**: contraste, contraste en oscuro, nombres, área táctil, recortes,
foco. Ninguna había detenido el backend.

Este es el escenario que de verdad importa: la base de datos no está, la red falla, el despliegue se
cae. Aquí se corta el backend **con el navegador ya abierto y la sesión emitida**, y se mira cada ruta.

## Resultado: ninguna ruta queda en blanco

| Ruta | Con backend | Sin backend | Qué muestra |
| --- | ---: | ---: | --- |
| `/#espacios` | 11.787 car. | **758** | mensaje de fallo + botón "Reintentar" |
| `/#academia` | 7.432 | **1.016** | "Consulta de desarrollo · Sin datos personales" + "Intentar de nuevo" |
| `/#admisiones` | 2.902 | 2.939 | "No fue posible consultar la agenda versionada. Se conserva la información pública de referencia." + "Reintentar" |
| `/#biblioteca` | 826 | 705 | contenido público, degradado |
| `/#avisos` | 555 | 489 | contenido público, degradado |
| `/#programas` | 7.802 | 7.758 | directorio desde instantánea local |
| `/#accesos` | 487 | 487 | "Esta consola requiere el permiso `identity:roles:read` en una sesión institucional configurada." |

Ningún mensaje técnico crudo: ni `Failed to fetch`, ni `NetworkError`, ni JSON, ni `undefined`. Ningún
spinner eterno. Ninguna vista casi vacía.

## Los tres comportamientos correctos, y por qué importan

**`/#espacios` colapsa y ofrece reintento.** Es una vista bloqueante: sin la instantánea publicada no
hay nada que mostrar. El mensaje lo dice y el botón existe.

**`/#admisiones` degrada en vez de desaparecer.** Dice *"No fue posible consultar la agenda versionada.
Se conserva la información pública de referencia"* y mantiene el contenido público. Es el patrón
correcto: la información de referencia no depende del backend, y desaparecer por un fallo de red sería
peor que la información desactualizada.

**`/#accesos` explica por qué está vacía sin culpar a la red.** Dice que requiere un permiso en una
sesión institucional configurada. Con el preview local ya no puede leer roles desde la ronda de la
allowlist, así que la consola se explica en lugar de fingir que falló.

## Lo más importante: el aviso de sesión sobrevive

En las diez rutas, con el backend caído, sigue visible:

> Desarrollador local · modo preview — Permisos de demostración en este entorno; usa únicamente datos
> sinteticos. Esta sesion no es institucional.

Ese aviso es lo que impide que alguien confunda datos sintéticos con datos reales. Un corte de red no
lo borra, y esa es exactamente la propiedad que hay que proteger.

## Un falso positivo que casi reporto

El detector marcó `/#espacios` con *"muestra error de red crudo"*. La causa era mi propio patrón de
búsqueda: `/undefined|NaN/i` contra 11.787 caracteres de datos publicados. Antes de reportarlo como
defecto se comprobó contra el DOM real, y no había ninguna coincidencia. El detector se ajustó y el
resultado correcto es **0 rutas con detalle de infraestructura**.

## Verificación

| Prueba | Resultado |
| --- | --- |
| `check-error-states` | 11 de 11 — ya cubría este escenario |
| `npm test` completa | 530 pruebas en 78 archivos, 106 guardas de Node |
| `npm run lint` | sin avisos |
| Backend tras la prueba | arrancado de nuevo y `healthy` |

La ronda **no encontró defectos de producto**. Su valor es confirmar que el comportamiento exigido por
el repositorio está implementado en las diez rutas, no solo en las seis que se habían medido, y dejar
la medición completa en el repo.

## Reproducir

```bash
docker compose stop backend     # con el navegador abierto y la sesión de preview emitida
# ... recorrer las rutas ...
docker compose start backend
```
