# Ruta oficial de inscripción 2027-I

**Estado:** propuesta implementable para información pública.
**Revisada:** 6 de octubre de 2026.

## Objetivo

Desde la agenda pública de pregrado presencial 2027-I, dar un siguiente paso claro hacia la página oficial de inscripción publicada por UPTC. Universiry conserva la agenda informativa; el trámite y cualquier dato personal permanecen en el sitio de UPTC.

## Evidencia y alcance de la fuente

- La página pública oficial de aspirantes de UPTC presenta el proceso de inscripción del primer semestre académico de 2027 y publica la página «Inscripción pregrado presencial» como su ruta de inscripción.
- La página enlazada muestra actualización de 23 de septiembre de 2026.
- El destino que se expone es la página pública UPTC que describe esa ruta. La interfaz no afirma qué producto, backend o sistema interno procesa la inscripción 2027-I.
- No se abre, envía ni prueba ningún formulario. No se cargan PIN, credenciales, documentos ni datos de aspirantes.

## Comportamiento

1. El calendario 2027-I puede declarar una fuente opcional de ruta oficial de inscripción en su contrato de presentación.
2. Si la fuente verificada está presente, la pantalla presenta un CTA «Ver la ruta oficial de inscripción» con una nota explícita de que abre el sitio de UPTC y que Universiry no recibe ni envía datos.
3. El enlace abre en una pestaña nueva con `rel="noopener noreferrer"`.
4. Convocatorias sin esa fuente no muestran el CTA. La ruta no deduce el destino desde el nombre, fecha o identificador de una convocatoria.
5. El flujo no llama APIs, no persiste interacciones y no incorpora formularios ni decisiones de admisión.

## Accesibilidad y presentación

- El CTA tiene texto comprensible fuera de contexto, conserva indicador de foco visible y se distingue de los enlaces a calendario y acto normativo.
- La disposición usa SCSS y tokens semánticos de tinta institucional; conserva contraste legible si la institución cambia el color primario y se adapta a móvil sin desplazamiento horizontal.
- No se añaden dependencias ni cambios de arquitectura. C4 permanece igual; se actualiza el diagrama del proceso público.

## Criterios de aceptación

- La vista predeterminada ofrece el enlace oficial actual y muestra su destino seguro.
- Un calendario que no declare la fuente no presenta el CTA.
- La vista sigue declarando que informa y no recibe inscripciones; no renderiza campos ni formularios.
- Las pruebas AAA verifican el estado presente, URL/atributos del enlace, ausencia con fuente no declarada y límites de datos.
- Vitest, build, lint, diff check y revisión visual de escritorio/móvil pasan.

## Límites pendientes

La existencia de esta ruta pública no confirma el sistema técnico que procesa la convocatoria ni habilita captura o integración. La vigencia del destino debe contrastarse con las publicaciones oficiales antes de reutilizarlo en otra convocatoria.
