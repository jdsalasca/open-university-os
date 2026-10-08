import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

// La CI construye y prueba el código, pero no las imágenes de producción: un Dockerfile roto o
// degradado se descubriría el día del despliegue. Este guard fija las propiedades que hacen que las
// imágenes sean "de producción" y no un `Dockerfile.dev` renombrado.
const backend = readFileSync(fileURLToPath(new URL('../../backend/Dockerfile', import.meta.url)), 'utf8')
const frontend = readFileSync(fileURLToPath(new URL('../../frontend/Dockerfile', import.meta.url)), 'utf8')

const etapas = (dockerfile) => (dockerfile.match(/^FROM\s+/gim) ?? []).length

test('backend production image runs as non-root with a readiness probe', () => {
  // Arrange + Act + Assert
  assert.match(backend, /^USER\s+(?!root\b)\w+/m, 'the runtime user must not be root')
  assert.match(backend, /HEALTHCHECK[\s\S]*actuator\/health\/readiness/, 'readiness must probe the actuator')
  // Se busca activación real (variable, argumento o perfil), no la palabra en comentarios: el propio
  // Dockerfile documenta que NO se activa el perfil de desarrollo.
  assert.doesNotMatch(
    backend,
    /SPRING_PROFILES_ACTIVE\s*=\s*["']?[^"'\n]*local-preview|profiles\.active[=:][^"'\n]*local-preview|--spring\.profiles\.active=local-preview/,
    'the production image must never activate the dev profile',
  )
  assert.ok(etapas(backend) >= 2, 'the build tools must not ship in the runtime image')
})

test('frontend production image serves static files without dev tooling', () => {
  // Arrange + Act + Assert
  assert.ok(etapas(frontend) >= 2, 'the node toolchain must not ship in the serving image')
  assert.match(frontend, /^FROM\s+nginx:/m, 'the final stage must be a static server, not node')
  assert.doesNotMatch(frontend, /npm run dev|vite --host/, 'the dev server must not run in production')
  assert.match(frontend, /COPY\s+nginx\.conf/, 'the hardened nginx config must be included')
  assert.match(frontend, /COPY\s+--from=\S+\s+\S*dist\s/, 'only the built assets travel to the final stage')
})
