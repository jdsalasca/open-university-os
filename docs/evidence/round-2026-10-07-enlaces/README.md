# Auditoría de enlaces externos — 7 de octubre de 2026

## Por qué

El producto es, en buena parte, un portal hacia páginas oficiales: directorios, calendarios,
pagos, espacios y programas enlazan a `uptc.edu.co` y dominios afines. Un enlace muerto es un
defecto visible para la persona que lo pulsa. `auditar-enlaces.mjs` pide cada URL externa real con
HEAD y reintenta con GET, siguiendo redirecciones, con 25 s de margen por intento.

```
node docs/evidence/round-2026-10-07-enlaces/auditar-enlaces.mjs [salida.txt]
```

## Resultado: 262 URLs, 250 verdes, 0 enlaces muertos de cara al usuario

| Hallazgo | Veredicto |
| --- | --- |
| 250 URLs responden 2xx/3xx | Verdes |
| 10 URLs con IDs falsos (`/programa/001`, `/programs/education-001/`, `public-test-program`, `uptc.edu.co/calendario`) | **Fixtures de tests**, no las pulsa nadie: `*.test.ts(x)` |
| `openstreetmap.org/search` solo → 400 | **Falso positivo del instrumento**: la app construye la URL con `?query=` en runtime (`SpaceGuidePage.tsx:359`) |
| `openstreetmap.org/search?query=Tunja...` → 429 | **Límite de tasa contra mi propio tráfico** de auditoría, no enlace roto |

## Dos trampas del instrumento, documentadas para no repetirlas

1. **260 "rotos" que no lo eran.** La primera pasada dio 260 fallos con
   `UNABLE_TO_VERIFY_LEAF_SIGNATURE`: el verificador TLS de Node no confía en la cadena que sí
   confía el sistema. La solución correcta no es `rejectUnauthorized: false` (eso convertiría la
   auditoría en teatro), sino `NODE_OPTIONS=--use-system-ca`. Con eso: 250 verdes.
2. **Medir la plantilla no es medir el enlace.** El 400 de OSM solo existe porque pedí la URL base
   sin query. La comprobación honesta es con query real.

## Guard permanente

`check-external-links-https`: ninguna URL de producción usa `http://` sin cifrar (verificado hoy:
cero). El guard muerde —inyectar `http://uptc.edu.co/pagos` lo deja en rojo nombrando archivo, línea
y URL— y está registrado en `npm test`.
