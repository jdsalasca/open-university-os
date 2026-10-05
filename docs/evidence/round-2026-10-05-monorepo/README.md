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

El remoto `jdsalasca/open-university-os` se crea para alojar este árbol. Los repositorios de origen
`open-university-backend` y `Universiry-frontend` se conservan intactos: el historial del frontend no
se replica dentro del monorepo.

## Lo que este cambio no decide

El artefacto de Maven sigue llamándose `Universiry Backend` y el paquete Java `co.edu.uptc.universiry`.
Renombrarlos es un cambio de identificadores que toca imports, migraciones y referencias de auditoría,
y no es necesario para que el monorepo funcione. MySQL conserva la base y el usuario `universiry_dev`
por los permisos ya concedidos en el volumen.
