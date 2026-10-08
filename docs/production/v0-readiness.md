# Preparación V0 para producción — informe consolidado

Fecha: 8 de octubre de 2026. Rama: `develop`. Este documento dice qué está probado, qué está
bloqueado y qué falta, con la evidencia al lado de cada afirmación. No declara nada listo que no
tenga prueba corriendo detrás.

## Cómo leerlo

- ✅ **Probado**: hay evidencia ejecutada y repetible enlazada.
- ⏳ **Bloqueado**: falta una decisión, credencial o contrato que solo la institución puede dar.
  Cada bloqueo dice exactamente qué lo desbloquea.
- 🔶 **Parcial**: funciona en un alcance menor al pedido; se dice cuál.

## 1. Seguridad web (gate `docs/security/frontend-production-gate.md`)

| # | Condición del gate | Estado | Evidencia / desbloqueo |
| --- | --- | --- | --- |
| 1 | Dominio HTTPS, TLS, origen, topología API/OIDC y proxy acordados con DTIC | ⏳ Bloqueado | Requiere decisión DTIC. Sin esto no hay a dónde publicar. |
| 2 | CSP para el HTML validada en report-only y aplicada | 🔶 Parcial | Imágenes validadas sirven `nosniff` + CSP aislada; la app React no tiene CSP porque la política la debe aprobar el proxy. Inventar una rompería OIDC. |
| 3 | `nosniff`, `Referrer-Policy`, CORS exacta | ✅ Probado | Imágenes de producción sirven ambas cabeceras (verificado corriendo); CORS no se infiere del proxy local. |
| 4 | Verificación sobre el hostname final (login, callback, 401/403 con CSP) | ⏳ Bloqueado | Depende del punto 1: sin hostname no hay dónde probarlo. |
| 5 | OIDC institucional aprobado, sin secretos en el bundle | 🔶 Parcial | Código OIDC con PKCE, issuer HTTPS y callback exacto; mapa de permisos vacío por defecto. Falta proveedor, claims y matriz aprobados. |
| 6 | Almacenamiento productivo de imágenes con respaldo y conciliación | 🔶 Parcial | Validación de contenido/dimensiones, nombres propios y auditoría existen; el respaldo del volumen está probado (`round-2026-10-07-respaldo-volumen`); falta la decisión de almacenamiento compartido y durable. |

## 2. Los cinco módulos pedidos

| Módulo | Estado | Lo que sí funciona (probado) | Lo que falta (bloqueador) |
| --- | --- | --- | --- |
| Admisiones | 🔶 Parcial | Agenda pública versionada e inmutable; publicar convocatoria de punta a punta (`round-2026-10-08-admisiones`); ICS válido con 22 eventos | Captura de aspirantes, PIN, documentos, puntajes, selección: gates G0–G3 sin aprobar, sistema fuente sin confirmar |
| Vida universitaria | 🔶 Parcial | Directorios públicos, búsqueda normalizada, enlaces verificados (250/262 verdes) | Ciclo del estudiante (matrícula, notas, horarios personales): requiere identidad vinculada y fuentes acordadas |
| Solicitud de espacios públicos | 🔶 Parcial | Guía pública con rutas oficiales por recurso; filtros y mapa verificados | Reservas/alquileres con inventario, tarifas y responsables: sin dueños ni sistema fuente confirmados |
| Registro de usuarios | ⏳ Bloqueado | Identidad federada cerrada por defecto; `user_id` canónico modelado | El modelo es federado por diseño: no hay cuentas locales que "activar". Requiere proveedor OIDC y provisión aprobada |
| Generación de recibos | ⏳ Bloqueado | Ficha que enlaza a la guía oficial sin capturar nada | Recibos y pagos: contrato con Tesorería, conceptos, procesador y conciliación sin aprobar |

## 3. Plataforma y operación

| Tema | Estado | Evidencia |
| --- | --- | --- |
| Imágenes Docker de producción | ✅ Probado | Frontend (nginx, non-root pendiente del proxy) y backend (JRE, usuario `app`, readiness) verificados corriendo; `round-2026-10-08-imagenes-prod` |
| Respaldo MySQL | ✅ Probado | Volcado + restauración idéntica, 44 tablas y Flyway 27 (`round-2026-10-07-respaldo-mysql`) |
| Respaldo de volúmenes | ✅ Probado | Mecanismo verificado con canarios sha256 (`round-2026-10-07-respaldo-volumen`) |
| Política de respaldos | ⏳ Bloqueado | Frecuencia, retención y custodia: decisión de operación con DTIC |
| Latencia <50 ms | 🔶 Parcial | Mediana bajo carga declarada tras el pool de 24; p95 con cola de GC; host compartido impide certificar (`round-2026-10-05-carga`) |
| SQLite en producción | ⏳ Bloqueado | Costo inventariado (11 DDL + 7 bloqueos por repensar); requiere ADR. La escala en filas nunca fue el argumento |
| SSH al mini equipo (192.168.1.100) | ⏳ Bloqueado | Servidor accesible (OpenSSH 8.2/Ubuntu), llave denegada, usuario desconocido. Sin usuario autorizado no hay despliegue |
| Subdominio `universidad.eridu.top` | ⏳ Bloqueado | Sin acceso al host ni delegación DNS no hay nada que crear |

## 4. Calidad del producto (lo ya cerrado)

Accesibilidad axe 0 violaciones en 22 combinaciones; foco al título en 8/8 rutas; contraste, responsive
y consola verificados; 557 pruebas frontend + 129 guardas; backend 441 pruebas; presupuestos y lint
verdes; CI verde por push. Detalle por ronda en `docs/ROADMAP.md` y `docs/evidence/`.

## Lo que desbloquearía más trabajo por orden de impacto

1. **Usuario SSH autorizado en el mini equipo** → desbloquea despliegue real y verificación en destino.
2. **Proveedor OIDC + matriz actor–acción–ámbito aprobados** → desbloquea identidad, `/#accesos` operativo y registro federado.
3. **Dueño y fuente de admisiones (ACRA/sistema)** → desbloquea captura de aspirantes.
4. **Contrato con Tesorería + procesador de pagos** → desbloquea recibos.
5. **Inventario y responsables de espacios** → desbloquea reservas.
6. **Decisión ADR sobre SQLite** → cierra o abre el cambio de motor con números.
