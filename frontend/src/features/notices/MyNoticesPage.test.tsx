import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MyNoticesPage } from './MyNoticesPage'
import type { NoticesClient } from './noticesClient'
import type { VisibleNotice } from './noticesContracts'

const NOTICE: VisibleNotice = {
  noticeId: 'notice-1',
  title: 'Matrícula 2027-I',
  body: 'La matrícula abre el 12 de enero.',
  publishedFrom: '2026-10-01',
  publishedThrough: '2026-12-31',
  audiences: [{ kind: 'UNIVERSITY', reference: null }],
}

function fakeClient(overrides: Partial<NoticesClient> = {}): NoticesClient {
  return { getMyNotices: vi.fn(async () => [NOTICE]), ...overrides }
}

afterEach(() => cleanup())

describe('MyNoticesPage', () => {
  it('lists the notices a person can read with their validity window', async () => {
    // Arrange + Act
    render(<MyNoticesPage client={fakeClient()} accessToken="token" />)

    // Assert
    expect(await screen.findByText('Matrícula 2027-I')).toBeTruthy()
    expect(screen.getByText('La matrícula abre el 12 de enero.')).toBeTruthy()
    expect(screen.getByText(/2026-10-01/)).toBeTruthy()
  })

  it('explains an empty inbox instead of showing a blank page', async () => {
    // Arrange + Act
    render(<MyNoticesPage client={fakeClient({ getMyNotices: vi.fn(async () => []) })} accessToken="token" />)

    // Assert
    expect(await screen.findByText('No tienes avisos disponibles.')).toBeTruthy()
  })

  it('reports a failed read and retries only when asked', async () => {
    // Arrange
    const getMyNotices = vi.fn(async () => { throw new Error('offline') })
    const user = userEvent.setup()
    render(<MyNoticesPage client={fakeClient({ getMyNotices })} accessToken="token" />)

    // Act
    const retry = await screen.findByRole('button', { name: 'Reintentar avisos' })
    expect(screen.getByRole('alert')).toHaveTextContent(/no fue posible consultar/i)
    expect(getMyNotices).toHaveBeenCalledTimes(1)
    await user.click(retry)

    // Assert
    expect(getMyNotices).toHaveBeenCalledTimes(2)
  })

  it('does not ask for notices without a session', () => {
    // Arrange
    const client = fakeClient()

    // Act + Assert
    const { container } = render(<MyNoticesPage client={client} accessToken={null} />)
    expect(container.firstChild).toBeNull()
    expect(client.getMyNotices).not.toHaveBeenCalled()
  })
})
