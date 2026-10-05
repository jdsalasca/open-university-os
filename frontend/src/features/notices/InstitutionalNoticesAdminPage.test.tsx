import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InstitutionalNoticesAdminPage } from './InstitutionalNoticesAdminPage'
import type { NoticesAdminClient } from './noticesAdminClient'
import type { AdminNotice } from './noticesAdminContracts'

const NOTICE: AdminNotice = {
  noticeId: 'notice-1',
  title: 'Matrícula 2027-I',
  body: 'La matrícula abre el 12 de enero.',
  sourceReference: 'Resolución 111 de 2026',
  publishedFrom: '2026-10-01',
  publishedThrough: '2026-12-31',
  audiences: [{ kind: 'UNIVERSITY', reference: null }],
  publishedBy: 'subject-editor',
  publishedAt: '2026-09-30T12:00:00Z',
}

function fakeClient(overrides: Partial<NoticesAdminClient> = {}): NoticesAdminClient {
  return {
    getRecent: vi.fn(async () => [NOTICE]),
    publish: vi.fn(async () => NOTICE),
    ...overrides,
  }
}

afterEach(() => cleanup())

describe('InstitutionalNoticesAdminPage', () => {
  it('lists the published notices with their reference and audiences', async () => {
    // Arrange + Act
    render(<InstitutionalNoticesAdminPage client={fakeClient()} authorization={{ accessToken: 'token', canRead: true, canWrite: false }} />)

    // Assert
    expect(await screen.findByText('Matrícula 2027-I')).toBeTruthy()
    expect(screen.getByText(/Resolución 111 de 2026/)).toBeTruthy()
    expect(screen.getByText('Toda la universidad')).toBeTruthy()
  })

  it('hides the publishing form without the write permission', async () => {
    // Arrange + Act
    render(<InstitutionalNoticesAdminPage client={fakeClient()} authorization={{ accessToken: 'token', canRead: true, canWrite: false }} />)
    await screen.findByText('Matrícula 2027-I')

    // Assert
    expect(screen.queryByRole('button', { name: 'Publicar aviso' })).toBeNull()
  })

  it('publishes a notice with a scoped audience and clears the form', async () => {
    // Arrange
    const publish = vi.fn(async () => NOTICE)
    const user = userEvent.setup()
    render(<InstitutionalNoticesAdminPage
      client={fakeClient({ publish })}
      authorization={{ accessToken: 'token', canRead: true, canWrite: true }}
    />)
    await screen.findByText('Matrícula 2027-I')
    const form = screen.getByRole('form', { name: 'Publicar aviso institucional' })

    // Act
    await user.type(within(form).getByLabelText('Título'), 'Aviso de sede')
    await user.type(within(form).getByLabelText('Cuerpo'), 'La sede cierra el viernes.')
    await user.type(within(form).getByLabelText('Referencia institucional'), 'Resolución 5 de 2026')
    await user.clear(within(form).getByLabelText('Vigente desde'))
    await user.type(within(form).getByLabelText('Vigente desde'), '2026-10-01')
    await user.clear(within(form).getByLabelText('Vigente hasta'))
    await user.type(within(form).getByLabelText('Vigente hasta'), '2026-10-31')
    await user.selectOptions(within(form).getByLabelText('Audiencia 1'), 'SITE')
    await user.type(within(form).getByLabelText('Referencia de la audiencia 1'), 'SITE-NORTE')
    await user.click(within(form).getByRole('button', { name: 'Publicar aviso' }))

    // Assert
    await waitFor(() => expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Aviso de sede',
        sourceReference: 'Resolución 5 de 2026',
        audiences: [{ kind: 'SITE', reference: 'SITE-NORTE' }],
      }),
      'token',
    ))
  })

  it('aborts a pending manual retry when the administrative view unmounts', async () => {
    // Arrange
    let retrySignal: AbortSignal | undefined
    const getRecent = vi.fn(async (_accessToken: string, signal?: AbortSignal) => {
      if (getRecent.mock.calls.length === 1) throw new Error('offline')
      retrySignal = signal
      return new Promise<AdminNotice[]>(() => {})
    })
    const user = userEvent.setup()
    const { unmount } = render(<InstitutionalNoticesAdminPage
      client={fakeClient({ getRecent })}
      authorization={{ accessToken: 'token', canRead: true, canWrite: false }}
    />)

    // Act
    await user.click(await screen.findByRole('button', { name: 'Reintentar avisos' }))
    await waitFor(() => expect(retrySignal).toBeDefined())
    unmount()

    // Assert
    expect(retrySignal?.aborted).toBe(true)
  })

  it('cancels an older read before refreshing after publish and aborts the refresh on unmount', async () => {
    // Arrange
    const signals: AbortSignal[] = []
    const getRecent = vi.fn(async (_accessToken: string, signal?: AbortSignal) => {
      if (signal) signals.push(signal)
      return new Promise<AdminNotice[]>(() => {})
    })
    const user = userEvent.setup()
    const { unmount } = render(<InstitutionalNoticesAdminPage
      client={fakeClient({ getRecent })}
      authorization={{ accessToken: 'token', canRead: true, canWrite: true }}
    />)
    const form = await screen.findByRole('form', { name: 'Publicar aviso institucional' })

    // Act
    await waitFor(() => expect(getRecent).toHaveBeenCalledTimes(1))
    await user.type(within(form).getByLabelText('Título'), 'Aviso de sede')
    await user.type(within(form).getByLabelText('Cuerpo'), 'La sede cierra el viernes.')
    await user.type(within(form).getByLabelText('Referencia institucional'), 'Resolución 5 de 2026')
    await user.type(within(form).getByLabelText('Vigente desde'), '2026-10-01')
    await user.type(within(form).getByLabelText('Vigente hasta'), '2026-10-31')
    await user.click(within(form).getByRole('button', { name: 'Publicar aviso' }))
    await waitFor(() => expect(getRecent).toHaveBeenCalledTimes(2))

    // Assert
    expect(signals[0]?.aborted).toBe(true)
    unmount()
    expect(signals[1]?.aborted).toBe(true)
  })
})
