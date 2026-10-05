import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import undergraduateSnapshot from './uptcUndergraduateCatalog.snapshot.json'
import postgraduateSnapshot from './uptcPostgraduateCatalog.snapshot.json'
import { PublicProgramDirectories } from './PublicProgramDirectories'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('PublicProgramDirectories', () => {
  it('keeps pregrado as the default and loads posgrado only after selection', async () => {
    // Arrange
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const asset = String(input).includes('Postgraduate') ? postgraduateSnapshot : undergraduateSnapshot
      return { ok: true, json: async () => asset } as Response
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<PublicProgramDirectories />)

    // Act
    const pregrado = screen.getByRole('button', { name: 'Pregrado' })
    expect(pregrado).toHaveAttribute('aria-pressed', 'true')
    await screen.findByRole('heading', { name: /programas de pregrado uptc/i })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Posgrado' }))

    // Assert
    expect(await screen.findByRole('heading', { name: /programas de posgrado uptc/i })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Posgrado' })).toHaveAttribute('aria-pressed', 'true')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[1]?.[0])).toMatch(/uptcPostgraduateCatalog\.snapshot\.json/)
  })
})
