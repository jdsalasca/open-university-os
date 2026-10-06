# Revisión de fuentes para perfiles docentes, asignaturas y calificaciones

**Corte de consulta:** 2026-10-06
**Alcance:** fuentes públicas de UPTC relacionadas con docentes, horarios, consulta de asignaturas y registro de notas.
**Estado:** hallazgo público preliminar; no confirma vigencia operativa de integraciones ni autoriza duplicar datos o transacciones institucionales.

## Evidencia pública consultada

| Fuente | Evidencia observada | Límite |
|---|---|---|
| [Directorio UPTC](https://uptc.edu.co/sitio/portal/sitios/directorio/index.html) | La página indexada declara actualización al 11 de agosto de 2026 e incluye columnas para dependencia, cargo, nombre, correo, teléfono, extensión, ubicación y horario. | Es un canal público de contacto; no es un padrón docente ni un contrato de API. No se extrajeron ni copiaron filas personales al repositorio. |
| [Sistemas de información para docentes](https://uptc.edu.co/sitio/portal/sitios/docentes/sis_inf/) | El portal identifica “Registro notas” dentro del Sistema de Registro Académico y publica aparte el Sistema de Evaluación Docente Institucional (SEDI), incluyendo PTA y evaluación docente. | El sitio de origen agotó el tiempo de apertura durante esta revisión; el resultado indexado sirve como pista, no valida permisos, funciones actuales ni endpoints. |
| [Sistemas de información para estudiantes](https://uptc.edu.co/sitio/portal/sitios/estudiantes/sis_inf/) | Publica la inscripción de materias con opciones de selección. La ficha indexada indica actualización el 24 de junio de 2025. | No describe el contrato de horarios, matrícula ni calificaciones ni demuestra qué sistema es fuente efectiva para cada dato hoy. |
| [Informe de rendición de cuentas UPTC 2025, publicado en 2026](https://www.uptc.edu.co/sitio/export/sites/default/portal/sitios/universidad/rectoria/planeacion/rdc/.content/doc/2026/aud_pub/infrdc_2025.pdf) | La sección indexada de UPTConecta anuncia consulta de horarios y calificaciones y accesos directos a SIRA para estudiantes y docentes. | Comunica servicios y una actualización de aplicación; no publica API, garantías de sincronización, dueño de cada dato ni un mecanismo de integración para esta plataforma. |
| [Campus Virtual UPTC](https://uptc.edu.co/sitio/portal/campus_virtual/) | Consulta directa el 6 de octubre de 2026: presenta accesos separados a SIRA estudiante y docente, además de la aplicación UPTC Conecta con enlaces para dispositivos Android e iOS. La página declara actualización al 20 de mayo de 2026. | Los enlaces acreditan puntos de entrada publicados por UPTC. No acreditan el contrato de datos, permisos, disponibilidad del servicio ni integración con Universiry. |
| [Comunicado UPTC sobre UPTConecta para iOS y otros sistemas](https://www.uptc.edu.co/sitio/portal/cal_not_eve/noticias/det/UPTConecta-la-App-institucional-ya-esta-disponible-en-iOS-y-todos-los-sistemas-operativos/) | El comunicado del 28 de agosto de 2025 indica que la aplicación se distribuye por Google Play y App Store y anuncia consulta de horarios, calificaciones y servicios académicos, con accesos a SIRA estudiantes y docentes. | Describe una capacidad anunciada en 2025; no confirma su estado actual ni expone APIs, fuente maestra o condiciones de sincronización. |
| [UPTConecta en Google Play](https://play.google.com/store/apps/details?id=co.edu.uptc.siraapp) | La ficha identifica a la UPTC como publicador y describe accesos a SIRA estudiantes/docentes, portal UPTC, pagos y carné digital. Al consultar el 6 de octubre de 2026, la ficha mostraba como última actualización el 28 de julio de 2025. | La ficha de distribución de la aplicación no documenta contratos internos ni autoriza replicar datos o procesos en otra plataforma. La fecha observada puede cambiar. |
| [UPTConecta en App Store](https://apps.apple.com/co/app/uptconecta/id6751426830) | La ficha identifica a la Universidad Pedagógica y Tecnológica de Colombia como desarrolladora y presenta la misma finalidad general de acceso a SIRA, portal institucional, pagos y carné digital. | La ficha pública no documenta interfaces ni permisos de integración; su descripción no prueba vigencia funcional para cada servicio. |
| [Resolución 27 de 2022, Sistemas de Información Institucionales](https://www.uptc.edu.co/export/sites/default/secretaria_general/consejo_academico/resoluciones_2022/res_27_2022.pdf) | El extracto público indexado describe SIRA como soporte de la actividad del estudiante hasta su graduación y SIRD como fuente de hoja de vida docente, puntaje, régimen salarial, productividad y consulta de actividad académica. También distingue el sistema SEDI. | Es una referencia de 2022; la apertura completa falló en esta consulta. Requiere revisión del acto completo y verificación con DTIC antes de definir estado actual, alcance o interfaces. |
| [Páginas de docentes por programa](https://www.uptc.edu.co/sitio/portal/sitios/universidad/vic_aca/facultades/fac_inge/preg/ing_54415_t/03_docth.html) | Hay páginas públicas de algunos programas con perfiles docentes, formación, tipo de vinculación y enlaces externos como CvLAC; los campos y el contenido varían entre programas. | Publicación selectiva y mantenida por páginas de programa no demuestra completitud institucional, ciclo de actualización, permiso de reutilización ni fuente laboral maestra. |

## Lectura del dominio

- **SIRA** ya aparece como sistema institucional relacionado con matrícula, consulta académica, notas y su registro docente. Una futura vista de asignaturas o un flujo de notas debe acordar integración o sustitución con DTIC y la autoridad del sistema antes de crear otra fuente de verdad.
- **UPTC Conecta** cuenta con rutas públicas oficiales para Android e iOS, y UPTC anuncia consultas de horarios/calificaciones y accesos a SIRA. Es un canal de acceso al sistema existente, no una API reutilizable ni evidencia de que Universiry pueda leer o modificar esos registros.
- **SIRD** cubre atributos de gestión del registro docente —incluidos hoja de vida, puntaje, régimen salarial y productividad— que no deben copiarse completos a un perfil público ni exponerse desde una ficha docente.
- **SEDI** gestiona evaluación docente y PTA. Es un proceso distinto de registrar notas de asignaturas; no mezclar evaluación laboral/pedagógica con calificaciones estudiantiles.
- El directorio institucional y las páginas de programa son productos de publicación pública, no APIs ni evidencia de qué atributos se aprobaron para un nuevo perfil. Aun los datos visibles requieren responsable, selección de campos y ciclo de actualización.
- La documentación consultada no revela endpoint, formato de exportación, identidad técnica, matriz de autorización, garantía de latencia o contrato de auditoría para SIRA/SIRD/SEDI.

## Guardas para la plataforma

1. **Mis asignaturas:** solo consultar el vínculo de la persona autenticada con sus inscripciones y resultados publicados desde la fuente acordada. No derivar cursos o matrícula desde el catálogo curricular, la semana DEV ni datos de otra persona.
2. **Registro de notas:** exigir fuente de grupos y asignación docente, ciclo de vida de notas, reglas institucionales consolidadas, ventana de captura, escala/redondeo, permisos, corrección, publicación, reclamo, auditoría y conciliación. No grabar una calificación en paralelo a SIRA sin decisión formal de fuente.
3. **Perfil docente:** acordar el conjunto público mínimo y su dueño; mantener expediente laboral, salario, puntajes, productividad y evaluación fuera de la vista pública salvo autorización específica. No hacer scraping de directorios ni añadir teléfonos/correos de personas a fixtures.
4. **Integración:** solicitar contrato actual a DTIC/administradores de SIRA, SIRD y SEDI, responsables de datos y tabla actor–acción–ámbito. Versionar el adaptador y probar lectura/registro con sandbox y cuentas de prueba institucionales, sin credenciales reales en repositorio.

## Próxima evidencia necesaria

- DTIC confirma el estado/despliegue vigente de SIRA, SIRD y SEDI, cuál de ellos es fuente por entidad, y las interfaces aprobadas o el mecanismo de extracción.
- Registro Académico valida el recorrido de consulta de materias/notas y define el dato oficial publicado; coordinación académica y docentes validan captura, cierre, corrección y reclamación de notas.
- Talento Humano y los dueños de las páginas de programa aprueban campos, fuente de formación/vinculación, audiencia y frecuencia del perfil docente.
- Seguridad y protección de datos aprueban identidad, autorizaciones y manejo de datos de estudiantes/docentes; las pruebas locales permanecen sintéticas.

No se cambia C4 ni el modelo relacional: no se identificó un contrato de integración público y la fuente institucional ya tiene capacidades que se solapan con estas funciones.
