import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import undergraduateSnapshot from './uptcUndergraduateCatalog.snapshot.json'
import { PublicUndergraduateDirectory } from './PublicUndergraduateDirectory'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function stubSnapshot() {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => undergraduateSnapshot }) as Response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('PublicUndergraduateDirectory result window', () => {
  it('renders a first window of results and offers the rest on demand', async () => {
    // Arrange
    stubSnapshot()

    // Act
    render(<PublicUndergraduateDirectory />)
    await screen.findByRole('heading', { name: /programas de pregrado uptc/i })

    // Assert: the initial window is bounded and the count still reports every match.
    const items = Array.from(document.querySelectorAll('.public-program-card'))
    expect(items.length).toBeGreaterThan(0)
    expect(items.length).toBeLessThan(undergraduateSnapshot.programs.length)
    const total = undergraduateSnapshot.programs.length
    expect(screen.getByText(new RegExp(`${total} resultados de ${total}`, 'i'))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ver más/i })).toBeVisible()
  })

  it('reveals the remaining results when the visitor asks for more', async () => {
    // Arrange
    const user = userEvent.setup()
    stubSnapshot()

    // Act
    render(<PublicUndergraduateDirectory />)
    await screen.findByRole('heading', { name: /programas de pregrado uptc/i })
    const firstWindow = document.querySelectorAll('.public-program-card').length
    await user.click(screen.getByRole('button', { name: /ver más/i }))

    // Assert
    const after = document.querySelectorAll('.public-program-card').length
    expect(after).toBeGreaterThan(firstWindow)
  })

  it('resets the window when a filter narrows the results', async () => {
    // Arrange
    const user = userEvent.setup()
    stubSnapshot()

    // Act
    render(<PublicUndergraduateDirectory />)
    await screen.findByRole('heading', { name: /programas de pregrado uptc/i })
    await user.click(screen.getByRole('button', { name: /ver más/i }))
    const expanded = document.querySelectorAll('.public-program-card').length
    await user.type(screen.getByPlaceholderText(/nombre, facultad o lugar/i), 'ingenier')

    // Assert: a narrower result set starts from the first window again, so the visitor sees the
    // top matches rather than the tail of a window opened before the filter.
    const filtered = document.querySelectorAll('.public-program-card').length
    expect(filtered).toBeLessThan(expanded)
    expect(filtered).toBeLessThanOrEqual(24)
  })
})
