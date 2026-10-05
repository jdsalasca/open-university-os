# Universiry — plataforma institucional UPTC

## Propósito

Construir una plataforma institucional única que, por etapas y dominio de negocio, unifique y reemplace los sistemas que hoy apoyan la vida universitaria de la UPTC. El objetivo incluye admisiones, expediente y ciclo del estudiante, estructura académica, currículos, mallas, asignaturas, carga académica, registro, bienestar, talento humano, finanzas, investigación, extensión y procesos administrativos. La lista definitiva, las reglas vigentes y las integraciones se confirman con los responsables institucionales durante el descubrimiento.

Un inventario público de DTIC de 2024 relaciona SIRA, SIRD, SEDI, HUMANO, OLIB, GOOBI, SIPRO, SIIUPS y otros. Los boletines de Vicerrectoría Académica de 2025 describen actualización de SIRA para PAE, planes, oferta y horarios. Además, el [informe de rendición de cuentas UPTC 2025](https://www.uptc.edu.co/sitio/export/sites/default/portal/sitios/universidad/rectoria/planeacion/rdc/.content/doc/2026/aud_pub/infrdc_2025.pdf) reporta la formulación al 100 % de la Fase III de un nuevo sistema académico alternativo a SIRA y reporta 50 % de avance para la meta de ejecutar el 90 % de sus fases de desarrollo durante 2025; ese indicador no equivale al porcentaje de sistema construido. No confirma inversión aprobada, productos actuales ni estado posterior al periodo reportado. Antes de ampliar módulos que se solapen, se debe determinar si esta plataforma pertenece a esa iniciativa, reutiliza su alcance, la complementa o tiene un mandato distinto. La relación y preguntas de validación quedan en [control de solapamiento institucional](discovery/uptc-new-academic-system-phase-iii.md). La autorización reportada por el patrocinador para este desarrollo no define por sí sola esa relación ni sustituye el inventario vigente.

## Misión

Proveer una base digital segura, clara y mantenible para los servicios universitarios de la UPTC, integrando capacidades por dominio con identidad y permisos explícitos, información atribuida, trazabilidad y validación con las áreas responsables. Cada entrega debe ser útil para la comunidad sin presentar prototipos o datos públicos como operación oficial.

## Visión

Avanzar hacia una plataforma universitaria coherente que pueda reemplazar sistemas existentes por etapas, con cortes reversibles y dueños de datos e interfaces acordados. Mantener dos monolitos modulares mientras esa forma responda a las necesidades; considerar una separación en servicios solo cuando una frontera operativa y su beneficio estén demostrados.

## Ficha técnica y estado

| Campo | Línea base |
| --- | --- |
| Institución objetivo | Universidad Pedagógica y Tecnológica de Colombia (UPTC) |
| Nombre de trabajo | Universiry |
| Objetivo | Unificar gradualmente servicios de la vida universitaria y reemplazar sistemas por dominio, tras inventario, contratos y aceptación institucional |
| Repositorio | `jdsalasca/open-university-os`: monorepo público con `backend/`, `frontend/`, Compose e integración continua en un solo `develop`. |
| Frontend | Monolito Vite, React, TypeScript y SCSS; pruebas Vitest con AAA; catálogo público y navegación separados de operaciones protegidas. |
| Backend | Monolito modular Spring Boot sobre Java 25 administrado por SDKMAN; contratos/interfaces de aplicación, pruebas AAA, i18n y migraciones Flyway. |
| Persistencia | MySQL objetivo con esquema versionado. La metadata pública de directorios informativos se conserva como contenido atribuido; no se carga como maestro institucional. |
| Calidad y arquitectura | Contratos primero, TDD RED-GREEN-REFACTOR, casos felices/límite/error/autorización, revisión de duplicación y diagramas C4/procesos actualizados ante cambios. |
| Rendimiento | Objetivo preliminar: promedio menor a 50 ms para consultas MySQL bajo volumen, concurrencia y hardware acordados; mediciones locales no certifican un SLO institucional. |
| Estado de uso | Desarrollo y preview local. Sin corte productivo ni tratamiento de datos personales reales. OIDC institucional y permisos permanecen sin configuración aprobada. |
| Áreas sugeridas | ACRA y Registro Académico fueron propuestos por el patrocinador; no se consideran formalmente designados como dueños de datos o proceso. |

### Misión de la próxima entrega

Completar el descubrimiento del proceso de inscripción y selección de aspirantes de pregrado presencial: consolidar normas y páginas públicas verificadas, separar los requisitos confirmados de las reglas internas pendientes y documentar sistemas fuente, responsables, permisos, privacidad e interfaces por acordar. Mantener desconectados los módulos sintéticos; no ejecutar selección ni tratar datos personales hasta contar con contratos y validación institucional verificables.

## Decisiones confirmadas

- Un solo repositorio público, `open-university-os`, contiene los monolitos desplegables `frontend/` y `backend/`, junto con Compose, migraciones y el workflow único de CI. Ambos servicios conservan límites y ciclos de despliegue independientes.
- La única rama remota de integración es `develop`. No publiques ramas de funcionalidad ni PRs; para aislar cambios usa worktrees detached desde `origin/develop`, integra mediante avance fast-forward y verifica el SHA remoto.
- `frontend/` se versiona como contenido normal del monorepo. No hay gitlink ni `.gitmodules`; los repositorios históricos se conservan como referencia, no como dependencia de checkout o build.
- Frontend: Vite, React y TypeScript.
- Backend: Java 25 administrado por SDKMAN y Spring Boot; el build y el `.sdkmanrc` fijan versión exacta.
- Backend como monolito modular, separado por capacidades de negocio. Los microservicios quedan aplazados hasta que haya evidencia de una frontera y una ganancia concreta.
- MySQL es la base relacional objetivo. Migraciones explícitas, integridad referencial y propiedad clara de datos por dominio.
- TDD en ciclos RED-GREEN-REFACTOR; pruebas con estructura AAA, casos felices, límites, permisos y regresiones.
- Diseño por contratos e interfaces, cohesión alta, acoplamiento bajo, principios SOLID y revisión de duplicaciones.
- Centro de Identidad Visual administrable: paleta, logos, imágenes institucionales, banners y nombres visibles de módulos, con autorización, vista previa y auditoría.
- Mensajes del backend resueltos por `Accept-Language`, con español de Colombia como idioma predeterminado.
- Compose local con MySQL y recarga de frontend/backend al cambiar código.
- Actualizar diagramas C4 y procesos al modificar componentes, límites, integraciones o cortes de migración.
- Objetivo de consultas críticas MySQL: promedio <50 ms bajo carga y volumen acordados; p95/p99 acompañan el promedio.

## Usuarios y permisos preliminares

Los grupos exactos y su mapeo al proveedor institucional se confirman con UPTC. El backend ya admite un mapa JSON explícito grupo/claim → permisos internos, pero arranca con el mapa vacío: ningún nombre de rol de ejemplo concede acceso. React usa Authorization Code + PKCE y consulta `/api/v1/me`; no interpreta grupos. El servidor permite solo pares método/ruta registrados y probados, y deniega el resto de `/api/v1/admin/**` para que un módulo no herede permisos por compartir un prefijo.

## Alcance del primer incremento

1. Un monorepo reproducible para ambos monolitos, herramientas de contexto IA, Compose Watch con MySQL local, traducciones del backend, base versionada y documentación viva.
2. Centro de Identidad Visual que publica una configuración de marca validada: colores, logos, banners y nombres de módulos.
3. Estructura de navegación y contratos preparados para identidad, estudiante y catálogo académico, sin inventar datos reales ni marcar módulos futuros como funcionales.
4. El mecanismo OIDC se implementa con configuración vacía por defecto; DTIC debe confirmar issuer, audience, claim, scopes, callback registrado y matriz grupo-permiso antes de habilitarlo. Inventario vigente sigue siendo requisito para migraciones productivas y cortes oficiales.

## Límites de seguridad y publicación

- El desarrollo usa solamente datos sintéticos.
- Las imágenes se validan por contenido real, dimensiones y tamaño; se excluyen SVG activos.
- El almacenamiento local de activos se limita al entorno de desarrollo. El almacenamiento productivo compartido se define con DTIC antes de desplegar más de una instancia.
- La identidad institucional y la lista oficial de roles son dependencias externas por descubrir. El inicio de sesión y el mapa de permisos permanecen cerrados hasta recibir configuración aprobada; no se publicará un centro administrativo operativo antes de esa validación.
- Una migración de dominio requiere perfilado, conciliación, aceptación del dueño de datos, ensayo de reversa y aprobación de corte. No habrá doble escritura sin reconciliación.

## Identidad visual inicial

El manual de identidad gráfica UPTC 2022 especifica amarillo `#FFCC29` (RGB 255/204/41) y negro `#1A1A1A` (RGB 26/26/26). La página oficial lista archivos de logotipos UPTC 2026. Los valores iniciales se documentan con estas fuentes y permanecen configurables; una actualización institucional prevalece. [Manual gráfico](https://www.uptc.edu.co/sitio/export/sites/default/portal/sitios/universidad/rectoria/comunicaciones/.content/doc/manual/man_identgraf_2022.pdf) · [Logos oficiales 2026](https://www.uptc.edu.co/sitio/portal/sitios/universidad/rectoria/comunicaciones/9_identidad_grafica/)
