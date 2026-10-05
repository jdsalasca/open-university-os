import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const composeFile = join(repositoryRoot, 'compose.yaml')

function loadComposeModel() {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'universiry-compose-readiness-'))
  const environmentFile = join(temporaryDirectory, 'compose.env')

  writeFileSync(environmentFile, [
    'MYSQL_DATABASE=compose_readiness_test',
    'DB_USERNAME=compose_readiness_test',
    'DB_PASSWORD=compose_readiness_only',
    'MYSQL_ROOT_PASSWORD=compose_readiness_root_only',
    'MONGODB_DATABASE=compose_readiness_documents',
    'ACADEMIC_CATALOG_IMPORT_MAX_FILE_BYTES=2097152',
    'ACADEMIC_CATALOG_IMPORT_MAX_ROWS=10000',
    'UPTC_OIDC_ISSUER_URI=',
    'UPTC_OIDC_AUDIENCE=',
    'UPTC_OIDC_AUTHORITIES_CLAIM=authorities',
    'UPTC_OIDC_ROLE_PERMISSION_MAPPING=',
    'VITE_OIDC_AUTHORITY=',
    'VITE_OIDC_CLIENT_ID=',
    'VITE_OIDC_REDIRECT_URI=',
    'VITE_OIDC_POST_LOGOUT_REDIRECT_URI=',
    'VITE_OIDC_SCOPE=openid',
    '',
  ].join('\n'))

  try {
    const result = spawnSync('docker', [
      'compose',
      '--env-file', environmentFile,
      '--file', composeFile,
      'config',
      '--format',
      'json',
    ], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      timeout: 30_000,
      env: {
        ...process.env,
        MYSQL_DATABASE: 'compose_readiness_test',
        DB_USERNAME: 'compose_readiness_test',
        DB_PASSWORD: 'compose_readiness_only',
        MYSQL_ROOT_PASSWORD: 'compose_readiness_root_only',
        MONGODB_DATABASE: 'compose_readiness_documents',
        ACADEMIC_CATALOG_IMPORT_MAX_FILE_BYTES: '2097152',
        ACADEMIC_CATALOG_IMPORT_MAX_ROWS: '10000',
        UPTC_OIDC_ISSUER_URI: '',
        UPTC_OIDC_AUDIENCE: '',
        UPTC_OIDC_AUTHORITIES_CLAIM: 'authorities',
        UPTC_OIDC_ROLE_PERMISSION_MAPPING: '',
        VITE_OIDC_AUTHORITY: '',
        VITE_OIDC_CLIENT_ID: '',
        VITE_OIDC_REDIRECT_URI: '',
        VITE_OIDC_POST_LOGOUT_REDIRECT_URI: '',
        VITE_OIDC_SCOPE: 'openid',
      },
    })

    assert.ifError(result.error)
    assert.equal(result.status, 0, `docker compose config failed: ${result.stderr}`)
    return JSON.parse(result.stdout)
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true })
  }
}

test('Compose waits for Spring readiness before starting Vite', () => {
  // Arrange
  const { services } = loadComposeModel()

  // Act
  const backendHealthCheck = services.backend.healthcheck
  const frontendBackendDependency = services.frontend.depends_on.backend

  // Assert
  assert.ok(backendHealthCheck, 'backend must expose a Compose health check')
  assert.ok(
    backendHealthCheck.test.some((part) => part.includes('/actuator/health/readiness')),
    'backend health check must use the Spring readiness probe',
  )
  assert.ok(frontendBackendDependency, 'frontend must declare its dependency on backend')
  assert.equal(
    frontendBackendDependency.condition,
    'service_healthy',
    'a bare `- backend` only waits for the container to start, not for Spring to finish migrating',
  )
})
