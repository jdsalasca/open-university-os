import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RoleAccessApiError } from './roleAccessClient'
import type { RoleAccessClient } from './roleAccessContracts'
import type { RoleProfile } from './roleAccessContracts'
import { RoleAccessPage } from './RoleAccessPage'
import type { RoleAccessAuthorization } from './RoleAccessPage'

afterEach(cleanup)

const profileCatalog: RoleProfile[] = [
  { key: 'APPLICANT', displayName: 'Aspirante', manuallyAssignable: false, allowedScopeKinds: [], permissions: [] },
  { key: 'ADMITTED', displayName: 'Admitido', manuallyAssignable: false, allowedScopeKinds: [], permissions: [] },
  { key: 'STUDENT', displayName: 'Estudiante', manuallyAssignable: false, allowedScopeKinds: [], permissions: [] },
  { key: 'TEACHER', displayName: 'Docente', manuallyAssignable: true, allowedScopeKinds: ['UNIVERSITY', 'SITE', 'FACULTY', 'PROGRAM', 'JOB_APPOINTMENT'], permissions: [] },
  { key: 'ADMINISTRATIVE', displayName: 'Administrativo', manuallyAssignable: true, allowedScopeKinds: ['UNIVERSITY', 'SITE', 'FACULTY', 'PROGRAM', 'JOB_APPOINTMENT'], permissions: [] },
  { key: 'ADMISSIONS', displayName: 'Admisiones', manuallyAssignable: true, allowedScopeKinds: ['UNIVERSITY', 'SITE', 'FACULTY', 'PROGRAM', 'JOB_APPOINTMENT'], permissions: [] },
  { key: 'DIRECTIVE', displayName: 'Directivo', manuallyAssignable: true, allowedScopeKinds: ['UNIVERSITY', 'SITE', 'FACULTY', 'PROGRAM', 'JOB_APPOINTMENT'], permissions: [] },
  { key: 'ADMINISTRATOR', displayName: 'Administrador', manuallyAssignable: true, allowedScopeKinds: ['UNIVERSITY'], permissions: ['identity:roles:read', 'identity:roles:write'] },
]

const selectedIdentity = {
  userId: '7b717347-ae70-4a76-9a1d-01b9f178c0d2',
  issuer: 'https://identity.example.edu',
  subject: 'teacher-17',
}

const assignment = {
  assignmentId: 'a7e7f06b-09a7-43db-a468-4c7b8ee3d301',
  targetUserId: selectedIdentity.userId,
  profileKey: 'TEACHER' as const,
  scopes: [{ kind: 'UNIVERSITY' as const, stableReference: null }],
  status: 'ACTIVE' as const,
  validFrom: '2026-10-01',
  validThrough: null,
  sourceReference: 'Acta sintética 2026-42',
  createdAt: '2026-10-01T12:00:00Z',
  version: 1,
}

function clientMock(): RoleAccessClient {
  return {
    roleProfiles: vi.fn().mockResolvedValue(profileCatalog),
    searchIdentities: vi.fn().mockResolvedValue([selectedIdentity]),
    assignments: vi.fn().mockResolvedValue([]),
    assign: vi.fn().mockResolvedValue(assignment),
    revoke: vi.fn().mockResolvedValue({ ...assignment, status: 'REVOKED', version: 2 }),
  }
}

function renderPage(client: RoleAccessClient, authorization: RoleAccessAuthorization | null) {
  return render(
    <RoleAccessPage
      client={client}
      authorization={authorization}
      loadScopeOptions={async () => []}
      onAuthorizationRejected={async () => {}}
    />,
  )
}

async function chooseTarget(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole('heading', { name: 'Accesos y perfiles' })
  await user.type(screen.getByLabelText('Prefijo del identificador'), 'teacher')
  await user.click(screen.getByRole('button', { name: 'Buscar identidad' }))
  await user.click(await screen.findByRole('button', { name: /teacher-17/ }))
}

describe('RoleAccessPage', () => {
  it('asks for the whole search page and says when the result may be capped', async () => {
    // Arrange: the server caps a search at 100, so asking for fewer identities hides matches without saying so.
    const many = Array.from({ length: 100 }, (_, index) => ({
      userId: `7b717347-ae70-4a76-9a1d-01b9f178c0${String(index).padStart(2, '0')}`,
      issuer: 'https://identity.example.edu',
      subject: `teacher-${index}`,
    }))
    const client = clientMock()
    client.searchIdentities = vi.fn().mockResolvedValue(many)
    const user = userEvent.setup()
    renderPage(client, { accessToken: 'token', canRead: true, canWrite: false })

    // Act
    await screen.findByRole('heading', { name: 'Accesos y perfiles' })
    await user.type(screen.getByLabelText('Prefijo del identificador'), 'teacher')
    await user.click(screen.getByRole('button', { name: 'Buscar identidad' }))

    // Assert
    await waitFor(() => expect(client.searchIdentities).toHaveBeenCalledWith('teacher', 100, 'token', expect.anything()))
    expect(await screen.findByText(/mostrando las primeras 100 identidades/i)).toBeTruthy()
  })

  it('keeps the console closed and makes no API request without read permission', async () => {
    // Arrange
    const client = clientMock()

    // Act
    renderPage(client, null)

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent('requiere el permiso identity:roles:read')
    expect(client.roleProfiles).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Asignar perfil' })).not.toBeInTheDocument()
  })

  it('lets a read-only operator inspect assignments without exposing mutation controls', async () => {
    // Arrange
    const client = clientMock()
    vi.mocked(client.assignments).mockResolvedValue([assignment])
    const user = userEvent.setup()
    renderPage(client, { accessToken: 'synthetic-token', canRead: true, canWrite: false })

    // Act
    await chooseTarget(user)

    // Assert
    expect(await screen.findByText('Docente')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Asignar perfil' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Revocar' })).not.toBeInTheDocument()
  })

  it('assigns the selected permitted profile once and reloads the target assignments', async () => {
    // Arrange
    const client = clientMock()
    vi.mocked(client.assignments)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([assignment])
    const user = userEvent.setup()
    renderPage(client, { accessToken: 'synthetic-token', canRead: true, canWrite: true })
    await chooseTarget(user)

    // Act
    await user.type(screen.getByLabelText('Referencia institucional'), 'Acta sintética 2026-42')
    await user.click(screen.getByRole('button', { name: 'Asignar perfil' }))

    // Assert
    await waitFor(() => expect(client.assign).toHaveBeenCalledOnce())
    expect(client.assign).toHaveBeenCalledWith(expect.objectContaining({
      targetUserId: selectedIdentity.userId,
      profileKey: 'TEACHER',
      scopes: [{ kind: 'UNIVERSITY', reference: null }],
      sourceReference: 'Acta sintética 2026-42',
    }), 'synthetic-token', expect.any(AbortSignal))
    expect(client.assignments).toHaveBeenNthCalledWith(
      1, selectedIdentity.userId, 'synthetic-token', expect.any(AbortSignal))
    expect(client.assignments).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Perfil asignado'))
  })

  it('refreshes after a stale revoke conflict and never retries the mutation', async () => {
    // Arrange
    const client = clientMock()
    vi.mocked(client.assignments)
      .mockResolvedValueOnce([assignment])
      .mockResolvedValueOnce([{ ...assignment, version: 2 }])
    vi.mocked(client.revoke).mockRejectedValue(new RoleAccessApiError(409, 'Conflicto de versión'))
    const user = userEvent.setup()
    renderPage(client, { accessToken: 'synthetic-token', canRead: true, canWrite: true })
    await chooseTarget(user)

    // Act
    await user.click(await screen.findByRole('button', { name: 'Revocar' }))
    await user.type(screen.getByLabelText('Referencia de revocación'), 'Acta sintética 2026-43')
    await user.click(screen.getByRole('button', { name: 'Confirmar revocación' }))

    // Assert
    await waitFor(() => expect(client.revoke).toHaveBeenCalledOnce())
    expect(client.assignments).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('cambió en otra sesión'))
    expect(screen.getByText(/versión 2/i)).toBeVisible()
  })
})
