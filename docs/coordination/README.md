# Coordinación de contribuciones

Este documento conserva convenciones técnicas estables. Harness Moon es el registro de
tareas, asignaciones, bloqueos y checkpoints; no copies aquí identificadores personales,
detalles de sesión, rutas locales ni evidencia de ejecución.

## Reglas de colaboración

1. Registra en Harness el objetivo, alcance, archivos esperados y criterios verificables
   antes de reclamar trabajo. Un agente trabaja solo dentro de las rutas asignadas.
2. Mantén los cambios en `develop`; no publiques ramas de funcionalidad ni PRs. Usa un
   worktree local cuando se requiera aislamiento y sigue el flujo de integración autorizado.
3. Serializa los archivos compartidos: `AGENTS.md`, `docs/ROADMAP.md`,
   `docs/architecture/c4.md`, `docs/architecture/process-flows.md`, `compose.yaml` y
   `.github/workflows/ci.yml`.
4. Integra los cambios de frontend y backend en el mismo commit del monorepo; no
   actualices gitlinks ni reintroduzcas `.gitmodules`.
5. Antes de integrar, revisa `git status -sb`, `git diff --check`, el diff staged, las
   pruebas aplicables y la documentación que corresponda. Excluye secretos y artefactos
   generados.

## Límites por capacidad

| Capacidad | Rutas principales | Regla |
| --- | --- | --- |
| Frontend | `frontend/src/features/` | React presenta contratos; permisos y decisiones se validan en backend. |
| Backend | `backend/src/main/` y `backend/src/test/` | Dominio y casos de uso no dependen del framework; toda escritura autorizada y auditable. |
| Arquitectura y operación | `docs/`, `compose.yaml`, `.github/workflows/ci.yml` | Actualiza diagramas si cambian límites, procesos, integraciones o datos. |

## Integración

1. Inicia un worktree detached desde `origin/develop` y registra el objetivo, la ruta y los criterios en Harness Moon.
2. Verifica las suites de frontend y backend aplicables y revisa el diff completo.
3. Integra mediante fast-forward en `develop`, publica solo a `origin/develop` con autorización y verifica el SHA remoto y Platform CI.

El estado de ejecución y los responsables activos se consultan en Harness Moon, no en
este repositorio.

Los planes fechados anteriores a la integración del monorepo describen la coordinación
histórica entre dos repositorios. No se ejecutan como instrucciones vigentes: para el
checkout actual prevalecen `AGENTS.md`, este flujo y `docs/ROADMAP.md`.
