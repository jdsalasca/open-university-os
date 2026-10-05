import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { MobileNavigation, type MobileNavigationItem } from './MobileNavigation'

const destinations: MobileNavigationItem[] = [
  { href: '#inicio', label: 'Inicio', symbol: '✳', primary: true },
  { href: '#programas', label: 'Programas', symbol: '▧', primary: true },
  { href: '#espacios', label: 'Espacios', symbol: '⌖' },
  { href: '#academia', label: 'Estructura académica', symbol: '◷' },
]

afterEach(() => cleanup())

describe('mobile navigation', () => {
  it('keeps Inicio and Programas visible and exposes other destinations through Más', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<MobileNavigation items={destinations} currentHash="#inicio" />)

    // Act
    const moreButton = screen.getByRole('button', { name: 'Más secciones' })

    // Assert
    expect(screen.getByRole('navigation', { name: 'Navegación móvil' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Inicio' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Programas' })).toBeVisible()
    expect(moreButton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('link', { name: 'Espacios', hidden: true })).not.toBeVisible()

    // Act
    await user.click(moreButton)

    // Assert
    expect(moreButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Espacios' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Estructura académica' })).toBeVisible()
  })

  it('closes Más and returns focus to its trigger when Escape is pressed', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<MobileNavigation items={destinations} currentHash="#inicio" />)
    const moreButton = screen.getByRole('button', { name: 'Más secciones' })

    // Act
    await user.click(moreButton)
    await user.keyboard('{Escape}')

    // Assert
    expect(moreButton).toHaveAttribute('aria-expanded', 'false')
    expect(moreButton).toHaveFocus()
    expect(screen.getByRole('link', { name: 'Espacios', hidden: true })).not.toBeVisible()
  })

  it('closes Más and navigates after a person selects another section', async () => {
    // Arrange
    const user = userEvent.setup()
    window.history.replaceState(null, '', '#inicio')
    render(<MobileNavigation items={destinations} currentHash="#inicio" />)

    // Act
    await user.click(screen.getByRole('button', { name: 'Más secciones' }))
    await user.click(screen.getByRole('link', { name: 'Espacios' }))

    // Assert
    expect(window.location.hash).toBe('#espacios')
    expect(screen.getByRole('button', { name: 'Más secciones' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes Más when a person chooses a primary destination', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<MobileNavigation items={destinations} currentHash="#inicio" />)

    // Act
    await user.click(screen.getByRole('button', { name: 'Más secciones' }))
    await user.click(screen.getByRole('link', { name: 'Programas' }))

    // Assert
    expect(window.location.hash).toBe('#programas')
    expect(screen.getByRole('button', { name: 'Más secciones' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('identifies the active destination inside Más and marks its link as current', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<MobileNavigation items={destinations} currentHash="#academia" />)

    // Act
    const moreButton = screen.getByRole('button', { name: 'Más secciones; sección actual: Estructura académica' })
    await user.click(moreButton)

    // Assert
    expect(moreButton).toHaveClass('is-current')
    expect(screen.getByRole('link', { name: 'Estructura académica' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Programas' })).not.toHaveAttribute('aria-current', 'page')
  })

  it('omits Más when every destination already fits in the primary navigation', () => {
    // Arrange
    const primaryDestinations = destinations.filter((item) => item.primary)

    // Act
    render(<MobileNavigation items={primaryDestinations} currentHash="#programas" />)

    // Assert
    expect(screen.queryByRole('button', { name: /Más secciones/ })).not.toBeInTheDocument()
  })
})
