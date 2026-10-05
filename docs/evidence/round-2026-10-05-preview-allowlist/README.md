# El preview local ya no concede todos los permisos — 5 de octubre de 2026

El ADR-0004 decía que el conversor de preview «concede cada permiso allowlisted en
`ApplicationPermission`». El código hacía exactamente eso: `ApplicationPermission.values()`. La
documentación prometía una allowlist; la implementación no la tenía.

## Por qué importa

Un permiso nuevo añadido al enum llegaba **automáticamente** al portador del bearer de preview, sin
revisión. Y los 18 permisos incluían:

```
identity:roles:read
identity:roles:write
```

Con esos dos, el preview podía **asignar roles**. Eso contradice de forma directa lo que el propio
repositorio exige: *«No operar asignaciones ni acceder a datos reales hasta que el patrocinador apruebe
el diseño»* y *«No preasignar perfiles ni crear administrador semilla»*. La excepción local documentada
para facilitar la revisión era, sin querer, un atajo a la operación de roles.

## El cambio

`LocalPreviewAuthoritiesConverter` declara ahora su propia lista:

```java
public static final Set<String> LOCAL_PREVIEW_PERMISSIONS = Set.of(
        // los 16 permisos de lectura y escritura de las capacidades revisables
        // identity:roles:read e identity:roles:write, ausentes a propósito
);
```

La lista es explícita para que **añadir un permiso al enum no lo entregue al preview sin revisar**.

## Verificación

`/api/v1/me` con un bearer de preview emitido ahora devuelve 16 permisos, sin los de roles:

```
academic:catalog:read, academic:catalog:write, academic:offerings:read, academic:offerings:write,
academic:period:read, academic:period:write, academic:structure:read, academic:structure:write,
admissions:calendar:read, admissions:calendar:write, branding:read, branding:write,
library:read, library:write, notices:read, notices:write
```

La auditoría de alcance del preview, que sondea 26 rutas con una sesión real, confirma que nada se
rompió y que el cierre se endurecio correctamente:

```
total 26, fugas 0, inesperados 0
```

`role-profiles` pasó de la lista de permitidas a la de cerradas. Antes de actualizar el script, la
auditoría lo reportó como `inesperado 1`, que era la señal correcta: la ruta ya no respondía con datos.

### Un test existente afirmaba el comportamiento viejo

`local_preview_issues_a_no_store_bearer_with_full_server_permissions_and_revokes_it_on_logout` exigía
`permissions.length() == 18`. No es un test que se ajustó por convenience: afirmaba literalmente el
comportamiento que se está corrigiendo. Ahora exige el tamaño de la allowlist, comprueba que incluye
`academic:offerings:read/write` y afirma que **no** incluye los permisos de roles.

## Pruebas

| Prueba | Resultado |
| --- | --- |
| `LocalPreviewAuthoritiesConverterTest` (nueva, 4 pruebas) | 4 de 4 |
| `LocalPreviewSessionControllerTest` | 1 de 1 |
| Backend completo | **434 pruebas, 0 fallos, 0 errores, 13 saltadas** |

Las cuatro pruebas nuevas cubren: que no se concedan permisos de roles, que la lista concedida sea
exactamente la declarada, que un permiso nuevo no se conceda solo, y que un token ajeno no reciba nada.

## Verificación visual pendiente

No se pudo capturar la portada: los dos navegadores disponibles (Playwright y chrome-devtools) estaban
ocupados por otras sesiones del equipo. No se cerró ningún proceso ajeno. La ronda **no toca archivos
de frontend** — el cambio es de backend y el React deriva sus accesos de `/api/v1/me` — así que el
impacto en interfaz es indirecto: la consola de roles deja de aparecer en preview, que es el efecto
deseado. Queda pendiente una captura cuando un navegador esté libre.

## Consecuencia para revisar

Quien use el preview para revisar la consola de gestión de roles ya no podrá verla. Es intencional, y
si esa revisión resulta necesaria antes de la aprobación institucional, corresponde abrir una vía
distinta y explícita, no ampliar esta allowlist en silencio.
