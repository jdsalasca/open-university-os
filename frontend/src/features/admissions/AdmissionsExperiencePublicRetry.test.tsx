import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AdmissionsCalendarExperience as AdmissionsExperience } from './AdmissionsExperience'
import type { AdmissionsCallClient, PublicAdmissionsCall } from './admissionsCallContracts'

const publishedCall: PublicAdmissionsCall = {
  callId: 'de31c2a6-05c2-4c4d-8910-51bd5f49e395',
  callKey: 'pregrado-presencial-2028-i',
  revisionId: 'ed9cce93-1f3c-4412-9ad9-cd83c9f39b1c',
  revisionNumber: 1,
  content: {
    title: 'Pregrado presencial 2028-I',
    callName: 'Primer semestre académico de 2028',
    updatedAt: '2027-12-15',
    checkedAt: '2027-12-20',
    source: { label: 'Calendario público ACRA', url: 'https://acra.example.edu/calendario' },
    confirmationSource: { label: 'Comunicado público UPTC', url: 'https://uptc.example.edu/noticias' },
    milestones: [{ key: 'registration', kind: 'APPLICATION', startsOn: '2028-01-01', endsOn: '2028-01-05',
      title: 'Inscripción', description: 'Ventana publicada de inscripción.' }],
  },
  officialReference: 'Resolución pública 12 de 2028',
  publishedAt: '2027-12-20T12:00:00Z',
}

afterEach(cleanup)

describe('AdmissionsExperience public reload', () => {
  it('lets a visitor retry the public calendar read after a failure', async () => {
    // Arrange
    const user = userEvent.setup()
    const getPublicCalls = vi.fn()
      .mockRejectedValueOnce(new Error('service unavailable'))
      .mockResolvedValueOnce([publishedCall])
    const client: AdmissionsCallClient = {
      getPublicCalls,
      getAdminCalls: vi.fn(async () => []),
      createCall: vi.fn(async () => { throw new Error('Unexpected call creation') }),
      createRevision: vi.fn(async () => { throw new Error('Unexpected revision creation') }),
      updateDraft: vi.fn(async () => { throw new Error('Unexpected draft update') }),
      publish: vi.fn(async () => { throw new Error('Unexpected publication') }),
    }
    render(<AdmissionsExperience client={client} />)
    expect(await screen.findByText(/no fue posible consultar la agenda versionada/i)).toBeVisible()

    // Act
    await user.click(screen.getByRole('button', { name: /reintentar/i }))

    // Assert
    await waitFor(() => expect(getPublicCalls).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('heading', { name: /pregrado presencial 2028-i/i })).toBeVisible()
    expect(screen.queryByText(/no fue posible consultar la agenda versionada/i)).not.toBeInTheDocument()
  })
})
