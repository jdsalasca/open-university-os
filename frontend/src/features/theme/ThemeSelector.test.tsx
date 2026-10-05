import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ThemeSelector } from './ThemeSelector'
import { THEME_STORAGE_KEY, useThemeStore } from './themeStore'

beforeEach(() => {
  window.localStorage.removeItem(THEME_STORAGE_KEY)
  useThemeStore.getState().setPreference('system')
  window.localStorage.removeItem(THEME_STORAGE_KEY)
})

afterEach(() => {
  cleanup()
  window.localStorage.removeItem(THEME_STORAGE_KEY)
  useThemeStore.getState().setPreference('system')
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.style.removeProperty('color-scheme')
})

describe('theme selector', () => {
  it('lets a keyboard and screen-reader user select and restore a color theme', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<ThemeSelector />)

    // Act
    await user.tab()
    expect(screen.getByRole('radio', { name: 'Automático' })).toHaveFocus()
    await user.keyboard('{ArrowRight}{ArrowRight}')

    // Assert
    expect(screen.getByRole('radio', { name: 'Oscuro' })).toBeChecked()
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')

    // Act
    await user.click(screen.getByRole('radio', { name: 'Automático' }))

    // Assert
    expect(screen.getByRole('radio', { name: 'Automático' })).toBeChecked()
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  })
})
