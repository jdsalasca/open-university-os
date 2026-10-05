# Monorepo `open-university-os` — 5 de octubre de 2026

Ejecuta la decisión de [ADR-0005](../../architecture/decisions/ADR-0005-single-repository-open-university-os.md):
`frontend/` deja de ser un submódulo y pasa a ser contenido versionado del mismo repositorio, con un
único `develop` y un único CI.

## Qué cambió

| Antes | Ahora |
| --- | --- |
| `frontend/` era un puntero git (modo 160000) al repositorio del frontend | `frontend/` es contenido normal (modo 100644) del repositorio |
| `.gitmodules` declaraba el submódulo | `.gitmodules` eliminado; no hay submódulos que inicializar |
| Dos workflows: `Backend CI` en la raíz y `Frontend CI` en `frontend/.github/workflows/` | Un workflow `Platform CI` en `.github/workflows/ci.yml` con jobs `backend` y `frontend` |
| Clonar exigía `git submodule update --init --recursive` | Clonar y `docker compose up --build -d --wait` |

### Defecto corregido en el CI del frontend

El workflow del frontend ejecutaba `npm ci` sin `working-directory`. Funcionaba solo porque en aquel
repositorio la raíz era el frontend; en el monorepo `npm ci` no encontraría `package.json`. El job
único fija `defaults.run.working-directory: frontend` y `cache-dependency-path: frontend/package-lock.json`.

### Lo que no necesitó cambios

`compose.yaml` ya usaba `./backend` y `./frontend` como contextos de construcción, así que los cuatro
servicios (`mysql`, `mongodb`, `backend`, `frontend`) siguen resolviendo igual.

## Verificación

Ejecutada desde la raíz del monorepo, no desde los repositorios de origen.

- `docker compose config --quiet`: correcto. Servicios: `mongodb`, `mysql`, `backend`, `frontend`
  (`compose-servicios.txt`).
- `backend/mvnw.cmd -f backend/pom.xml test`: **424 pruebas, 0 fallos, 0 errores, 13 saltadas**,
  `BUILD SUCCESS` (`mvn-test.txt`).
- `frontend/npm test`: **518 pruebas en 77 archivos, todas aprobadas**, más 36 guardas de Node sobre
  presupuestos de bundle y contraste en tema oscuro (`vitest-frontend.txt`).
- `frontend/npm run build`: aprobado, presupuestos verificados (`build-frontend.txt`).
- `frontend/npm run lint`: 0 avisos, 0 errores en 177 archivos (`lint-frontend.txt`).

## Estado de la publicación

Publicado en `https://github.com/jdsalasca/open-university-os`, rama `develop`, commit `8f42c88`. La
primera ejecución de `Platform CI` en el monorepo terminó verde en los dos jobs: `Tests, build, and
lint` en 40 s y `Maven tests and MySQL contracts` en 1 m 36 s
([run 37260405244](https://github.com/jdsalasca/open-university-os/actions/runs/37260405244)).

El repositorio local principal se migró al monorepo: `origin` apunta ahora a `open-university-os` y
`legacy-backend` conserva la referencia al repositorio anterior, que no se modifica. El historial
previo del frontend tampoco se replica dentro del monorepo; queda en su repositorio de origen.

## Verificación desde la raíz del monorepo

Después de migrar el checkout principal, el stack se volvió a levantar y se comprobó que las cuatro
rutas públicas responden sin alertas:

| Ruta | Título | Alertas | Captura |
| --- | --- | --- | --- |
| `/#resumen` | Tu universidad, en un mismo lugar | ninguna | `monorepo-resumen.png` |
| `/#programas` | Mallas curriculares de pregrado | ninguna | `monorepo-programas.png` |
| `/#espacios` | Guía de espacios (24 de 24 espacios) | ninguna | `monorepo-espacios.png` |
| `/#admisiones` | Pregrado presencial 2027-I | ninguna | `monorepo-admisiones.png` |

El arreglo de CLS de la ronda anterior sobrevive a la migración: `/#programas` mide **0.0071** en tres
corridas con perfil limpio, frente a 0.7503 antes del arreglo.

Los cuatro servicios quedan arriba desde el monorepo: backend `UP`, frontend HTTP 200, MySQL
`healthy` y MongoDB `healthy`.

## Lo que este cambio no decide

El artefacto de Maven sigue llamándose `Universiry Backend` y el paquete Java `co.edu.uptc.universiry`.
Renombrarlos es un cambio de identificadores que toca imports, migraciones y referencias de auditoría,
y no es necesario para que el monorepo funcione. MySQL conserva la base y el usuario `universiry_dev`
por los permisos ya concedidos en el volumen.
