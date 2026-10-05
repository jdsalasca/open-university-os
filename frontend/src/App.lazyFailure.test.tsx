import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { BrandingProvider } from './features/branding/BrandingProvider'
import { DEFAULT_BRANDING } from './features/branding/contracts'

vi.mock('./features/academics/AcademicCatalogPage', () => ({
  AcademicCatalogPage: () => {
    throw new Error('Academic catalog module failed to render')
  },
}))

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '#inicio')
  vi.restoreAllMocks()
})

describe('App route chunk recovery', () => {
  it('keeps the application shell usable and offers reload when the selected module throws', async () => {
    // Arrange
    vi.spyOn(console, 'error').mockImplementation(() => {})
    window.history.replaceState(null, '', '#programas')

    // Act
    render(
      <BrandingProvider loader={async () => DEFAULT_BRANDING}>
        <App />
      </BrandingProvider>,
    )

    // Assert
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar el módulo académico'))
    expect(screen.getByRole('button', { name: 'Recargar pantalla' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Identidad visual' })).toBeVisible()
  })
})
