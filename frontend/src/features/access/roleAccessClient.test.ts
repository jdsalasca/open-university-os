import { describe, expect, it, vi } from 'vitest'
import type { RoleAccessClient } from './roleAccessContracts'

const accessModules = import.meta.glob<typeof import('./roleAccessClient')>('./roleAccessClient.ts')

async function loadClientModule() {
  const loader = accessModules['./roleAccessClient.ts']
  expect(loader, 'the role access API client is implemented').toBeTypeOf('function')
  return loader!()
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const profiles = [
  { key: 'APPLICANT', displayName: 'Aspirante', manuallyAssignable: false, allowedScopeKinds: [], permissions: [] },
  { key: 'ADMITTED', displayName: 'Admitido', manuallyAssignable: false, allowedScopeKinds: [], permissions: [] },
  { key: 'STUDENT', displayName: 'Estudiante', manuallyAssignable: false, allowedScopeKinds: [], permissions: [] },
  { key: 'TEACHER', displayName: 'Docente', manuallyAssignable: true, allowedScopeKinds: ['UNIVERSITY', 'SITE', 'FACULTY', 'PROGRAM', 'JOB_APPOINTMENT'], permissions: [] },
  { key: 'ADMINISTRATIVE', displayName: 'Administrativo', manuallyAssignable: true, allowedScopeKinds: ['UNIVERSITY', 'SITE', 'FACULTY', 'PROGRAM', 'JOB_APPOINTMENT'], permissions: [] },
  { key: 'ADMISSIONS', displayName: 'Admisiones', manuallyAssignable: true, allowedScopeKinds: ['UNIVERSITY', 'SITE', 'FACULTY', 'PROGRAM', 'JOB_APPOINTMENT'], permissions: [] },
  { key: 'DIRECTIVE', displayName: 'Directivo', manuallyAssignable: true, allowedScopeKinds: ['UNIVERSITY', 'SITE', 'FACULTY', 'PROGRAM', 'JOB_APPOINTMENT'], permissions: [] },
  { key: 'ADMINISTRATOR', displayName: 'Administrador', manuallyAssignable: true, allowedScopeKinds: ['UNIVERSITY'], permissions: ['identity:roles:read', 'identity:roles:write'] },
]

function assignment(overrides: Record<string, unknown> = {}) {
  return {
    assignmentId: 'a7e7f06b-09a7-43db-a468-4c7b8ee3d301',
    targetUserId: '7b717347-ae70-4a76-9a1d-01b9f178c0d2',
    profileKey: 'TEACHER',
    scopes: [{ kind: 'UNIVERSITY', stableReference: null }],
    status: 'ACTIVE',
    validFrom: '2026-10-01',
    validThrough: null,
    sourceReference: 'Acta sintética 2026-42',
    createdAt: '2026-10-01T12:00:00Z',
    version: 1,
    ...overrides,
  }
}

describe('role access client', () => {
  it('fetches the fixed role catalog without cookies and without cache', async () => {
    // Arrange
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(profiles))
    const { createRoleAccessClient } = await loadClientModule()
    const client: RoleAccessClient = createRoleAccessClient(fetcher)

    // Act
    const result = await client.roleProfiles('synthetic-token')

    // Assert
    expect(result).toHaveLength(8)
    expect(result[0].manuallyAssignable).toBe(false)
    expect(fetcher).toHaveBeenCalledWith('/api/v1/admin/access/role-profiles', expect.objectContaining({
      credentials: 'omit',
      cache: 'no-store',
      headers: expect.objectContaining({ Authorization: 'Bearer synthetic-token' }),
    }))
  })

  it('encodes identity search and keeps the user signal on the request', async () => {
    // Arrange
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([{
      userId: '7b717347-ae70-4a76-9a1d-01b9f178c0d2',
      issuer: 'https://identity.example.edu',
      subject: 'teacher +17',
    }]))
    const { createRoleAccessClient } = await loadClientModule()
    const client = createRoleAccessClient(fetcher)
    const controller = new AbortController()

    // Act
    const result = await client.searchIdentities('teacher +', 25, 'synthetic-token', controller.signal)

    // Assert
    expect(result[0].subject).toBe('teacher +17')
    expect(result[0].userId).toBe('7b717347-ae70-4a76-9a1d-01b9f178c0d2')
    expect(fetcher.mock.calls[0][0]).toContain('subjectPrefix=teacher+%2B')
    expect(fetcher.mock.calls[0][1]).toMatchObject({ signal: controller.signal })
  })

  it('returns one selectable entry when search contains multiple bindings for one canonical user', async () => {
    // Arrange
    const userId = '7b717347-ae70-4a76-9a1d-01b9f178c0d2'
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([
      { userId, issuer: 'https://identity.example.edu', subject: 'teacher-alpha' },
      { userId: userId.toUpperCase(), issuer: 'https://alternate-id.example.edu', subject: 'teacher-beta' },
    ]))
    const { createRoleAccessClient } = await loadClientModule()
    const client = createRoleAccessClient(fetcher)

    // Act
    const result = await client.searchIdentities('teacher-', 25, 'synthetic-token')

    // Assert
    expect(result).toHaveLength(1)
    expect(result[0].userId).toBe(userId)
  })

  it('sends an audited assignment command once and parses the created assignment', async () => {
    // Arrange
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(assignment(), 201))
    const { createRoleAccessClient } = await loadClientModule()
    const client = createRoleAccessClient(fetcher)
    const command = {
      targetUserId: '7b717347-ae70-4a76-9a1d-01b9f178c0d2',
      profileKey: 'TEACHER' as const,
      scopes: [{ kind: 'UNIVERSITY' as const, reference: null }],
      validFrom: '2026-10-01',
      validThrough: null,
      sourceReference: 'Acta sintética 2026-42',
    }

    // Act
    const result = await client.assign(command, 'synthetic-token')

    // Assert
    expect(result.assignmentId).toBe('a7e7f06b-09a7-43db-a468-4c7b8ee3d301')
    expect(result.targetUserId).toBe(command.targetUserId)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledWith('/api/v1/admin/access/assignments', expect.objectContaining({
      method: 'POST',
      credentials: 'omit',
      cache: 'no-store',
      body: JSON.stringify(command),
    }))
  })

  it('queries assignments by canonical user id and rejects a response for another user', async () => {
    // Arrange
    const userId = '7b717347-ae70-4a76-9a1d-01b9f178c0d2'
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([assignment()]))
    const { createRoleAccessClient } = await loadClientModule()
    const client = createRoleAccessClient(fetcher)

    // Act
    const result = await client.assignments(userId, 'synthetic-token')

    // Assert
    expect(result).toHaveLength(1)
    expect(fetcher.mock.calls[0][0]).toBe(`/api/v1/admin/access/assignments?userId=${userId}`)

    fetcher.mockResolvedValueOnce(jsonResponse([assignment({
      targetUserId: '8b717347-ae70-4a76-9a1d-01b9f178c0d2',
    })]))
    await expect(client.assignments(userId, 'synthetic-token')).rejects.toThrow('malformed')
  })

  it('rejects unknown profiles and repeated scope kinds in server responses', async () => {
    // Arrange
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([
      assignment({ profileKey: 'SUPERUSER', scopes: [{ kind: 'UNIVERSITY', stableReference: null }] }),
    ]))
    const { createRoleAccessClient } = await loadClientModule()
    const client = createRoleAccessClient(fetcher)

    // Act / Assert
    await expect(client.assignments('7b717347-ae70-4a76-9a1d-01b9f178c0d2', 'synthetic-token'))
      .rejects.toThrow('malformed')

    fetcher.mockResolvedValueOnce(jsonResponse([assignment({
      scopes: [
        { kind: 'PROGRAM', stableReference: 'a7e7f06b-09a7-43db-a468-4c7b8ee3d301' },
        { kind: 'PROGRAM', stableReference: 'b7e7f06b-09a7-43db-a468-4c7b8ee3d301' },
      ],
    })]))
    await expect(client.assignments('7b717347-ae70-4a76-9a1d-01b9f178c0d2', 'synthetic-token'))
      .rejects.toThrow('malformed')
  })

  it('surfaces authorization failures with their status and never repeats a mutation', async () => {
    // Arrange
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ error: 'forbidden', message: 'No autorizado' }, 403))
    const { createRoleAccessClient, RoleAccessApiError } = await loadClientModule()
    const client = createRoleAccessClient(fetcher)

    // Act
    const request = client.revoke('a7e7f06b-09a7-43db-a468-4c7b8ee3d301', {
      expectedVersion: 1,
      sourceReference: 'Acta sintética 2026-43',
    }, 'synthetic-token')

    // Assert
    await expect(request).rejects.toMatchObject({ name: RoleAccessApiError.name, status: 403 })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
