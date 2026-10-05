import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AdmissionsCallManagementPanel } from './AdmissionsCallManagementPanel'
import { AdmissionsCallApiError } from './admissionsCallContracts'
import type { AdmissionsCallClient } from './admissionsCallContracts'

afterEach(cleanup)

describe('AdmissionsCallManagementPanel reload', () => {
  it('retries the administrative read after a load failure', async () => {
    // Arrange
    const user = userEvent.setup()
    const getAdminCalls = vi.fn()
      .mockRejectedValueOnce(new AdmissionsCallApiError(500))
      .mockResolvedValueOnce([])
    const client: AdmissionsCallClient = {
      getPublicCalls: vi.fn(async () => []),
      getAdminCalls,
      createCall: vi.fn(async () => { throw new Error('Unexpected call creation') }),
      createRevision: vi.fn(async () => { throw new Error('Unexpected revision creation') }),
      updateDraft: vi.fn(async () => { throw new Error('Unexpected draft update') }),
      publish: vi.fn(async () => { throw new Error('Unexpected publication') }),
    }
    render(<AdmissionsCallManagementPanel client={client}
      authorization={{ accessToken: 'reader-token', canRead: true, canWrite: false }}
      onPublished={vi.fn()} />)

    // Act
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/no fue posible consultar/i))
    await user.click(screen.getByRole('button', { name: /reintentar/i }))

    // Assert
    await waitFor(() => expect(getAdminCalls).toHaveBeenCalledTimes(2))
    expect(await screen.findByText(/no hay convocatorias administradas/i)).toBeVisible()
    expect(screen.queryByText(/no fue posible consultar/i)).not.toBeInTheDocument()
  })
})
