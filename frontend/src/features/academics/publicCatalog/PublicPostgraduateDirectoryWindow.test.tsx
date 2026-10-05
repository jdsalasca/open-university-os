import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import snapshot from './uptcPostgraduateCatalog.snapshot.json'
import { PublicPostgraduateDirectory } from './PublicPostgraduateDirectory'
import type { PublicPostgraduateCatalogSnapshot } from './publicPostgraduateCatalog'

const catalog = snapshot as PublicPostgraduateCatalogSnapshot
const cards = () => document.querySelectorAll('.public-program-card').length

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('PublicPostgraduateDirectory result window', () => {
  it('renders a first window instead of the whole 139-program snapshot', () => {
    // Arrange

    // Act
    render(<PublicPostgraduateDirectory snapshot={catalog} />)

    // Assert: the attributed total stays visible while the rendered cards are bounded.
    expect(screen.getByText(/139 programas en el directorio/i)).toBeVisible()
    expect(cards()).toBeGreaterThan(0)
    expect(cards()).toBeLessThan(catalog.programs.length)
    expect(screen.getByRole('button', { name: /ver más/i })).toBeVisible()
  })

  it('reveals the next window on request', async () => {
    // Arrange
    const user = userEvent.setup()

    // Act
    render(<PublicPostgraduateDirectory snapshot={catalog} />)
    const first = cards()
    await user.click(screen.getByRole('button', { name: /ver más/i }))

    // Assert
    expect(cards()).toBeGreaterThan(first)
  })

  it('starts from the first window again when a filter narrows the results', async () => {
    // Arrange
    const user = userEvent.setup()

    // Act
    render(<PublicPostgraduateDirectory snapshot={catalog} />)
    await user.click(screen.getByRole('button', { name: /ver más/i }))
    const expanded = cards()
    await user.type(screen.getByRole('searchbox', { name: /buscar en el directorio de posgrado/i }), 'maestria')

    // Assert
    expect(cards()).toBeLessThan(expanded)
    expect(cards()).toBeLessThanOrEqual(24)
  })
})
