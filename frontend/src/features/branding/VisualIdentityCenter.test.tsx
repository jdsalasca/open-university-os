import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BrandingProvider } from './BrandingProvider'
import { DEFAULT_BRANDING } from './contracts'
import type { PublicBranding } from './contracts'
import type { ApplicationPermission } from '../identity/identityContracts'
import { VisualIdentityCenter } from './VisualIdentityCenter'
import type { BrandingAdministrationClient } from './api/brandingAdministrationClient'
import { BrandingAdministrationError } from './api/brandingAdministrationClient'

function configuration(overrides: Partial<PublicBranding> = {}): PublicBranding {
  return {
    ...DEFAULT_BRANDING,
    revision: 7,
    colors: { ...DEFAULT_BRANDING.colors },
    assets: { ...DEFAULT_BRANDING.assets },
    modules: DEFAULT_BRANDING.modules.map((module) => ({ ...module })),
    banners: [],
    ...overrides,
  }
}

function createClient(overrides: Partial<BrandingAdministrationClient> = {}): BrandingAdministrationClient {
  const current = configuration()
  return {
    getCurrentConfiguration: vi.fn().mockResolvedValue(current),
    uploadAsset: vi.fn().mockResolvedValue({ assetId: 'a7e7f06b-09a7-43db-a468-4c7b8ee3d301', mimeType: 'image/png', sizeBytes: 12, width: 2, height: 2 }),
    publishConfiguration: vi.fn().mockResolvedValue({ ...current, revision: current.revision + 1 }),
    restoreRevision: vi.fn().mockResolvedValue({ ...current, revision: current.revision + 1 }),
    ...overrides,
  }
}

function renderCenter({
  client = createClient(),
  accessToken = 'test-access-token',
  permissions = ['branding:read', 'branding:write'],
  initialConfiguration = configuration(),
}: {
  client?: BrandingAdministrationClient
  accessToken?: string | null
  permissions?: ApplicationPermission[]
  initialConfiguration?: PublicBranding | null
} = {}) {
  const view = render(
    <BrandingProvider loader={async () => configuration()}>
      <VisualIdentityCenter
        accessToken={accessToken}
        permissions={permissions}
        client={client}
        initialConfiguration={initialConfiguration ?? undefined}
      />
    </BrandingProvider>,
  )
  return { ...view, client }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('style')
})

describe('VisualIdentityCenter', () => {
  it('keeps publishing and rollback unavailable when the session lacks branding write permission', () => {
    // Arrange
    const client = createClient()
    renderCenter({ client, permissions: ['branding:read'] })

    // Act
    const publish = screen.getByRole('button', { name: 'Publicar cambios' })
    const restore = screen.getByRole('button', { name: 'Restaurar revisión anterior' })

    // Assert
    expect(publish).toBeDisabled()
    expect(restore).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent(/permiso de escritura/i)
    expect(client.publishConfiguration).not.toHaveBeenCalled()
    expect(client.restoreRevision).not.toHaveBeenCalled()
  })

  it('edits a local preview without publishing until the administrator saves', async () => {
    // Arrange
    const user = userEvent.setup()
    const client = createClient()
    renderCenter({ client })

    // Act
    const primaryColor = screen.getByLabelText('Color HEX: Primario')
    await user.clear(primaryColor)
    await user.type(primaryColor, '#E0C037')

    // Assert
    expect(screen.getByTestId('preview-surface').style.getPropertyValue('--preview-primary')).toBe('#E0C037')
    expect(client.publishConfiguration).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Publicar cambios' })).toBeEnabled()
  })

  it('shows a selected institutional logo in the local preview before publication', async () => {
    // Arrange
    const user = userEvent.setup()
    renderCenter()
    vi.stubGlobal('URL', { createObjectURL: vi.fn().mockReturnValue('blob:logo-preview'), revokeObjectURL: vi.fn() })
    await user.click(screen.getByRole('tab', { name: 'Activos' }))

    // Act
    await user.upload(screen.getByLabelText('Logo principal'), new File(['png'], 'logo.png', { type: 'image/png' }))

    // Assert
    expect(screen.getByTestId('preview-logo')).toHaveAttribute('src', 'blob:logo-preview')
    expect(screen.getByRole('button', { name: 'Publicar cambios' })).toBeEnabled()
  })

  it('shows the published banner in the portal preview', () => {
    // Arrange
    const assetId = 'a7e7f06b-09a7-43db-a468-4c7b8ee3d301'
    const startsAt = new Date(Date.now() - 60_000).toISOString()
    const endsAt = new Date(Date.now() + 60_000).toISOString()
    renderCenter({ initialConfiguration: configuration({ banners: [{
      id: 'b7e7f06b-09a7-43db-a468-4c7b8ee3d301',
      assetId,
      title: 'Bienvenida al semestre',
      altText: 'Comunidad universitaria en el campus',
      placement: 'home-hero',
      order: 1,
      startsAt,
      endsAt,
    }] }) })

    // Act
    const previewBanner = screen.getByTestId('preview-banner')

    // Assert
    expect(previewBanner).toHaveAttribute('src', `/assets/${assetId}`)
    expect(previewBanner).toHaveAttribute('alt', 'Comunidad universitaria en el campus')
  })

  it('edits a known module label in the navigation preview', async () => {
    // Arrange
    const user = userEvent.setup()
    renderCenter()

    // Act
    await user.click(screen.getByRole('tab', { name: 'Módulos' }))
    const label = screen.getByLabelText('Nombre visible: Estudiantes')
    await user.clear(label)
    await user.type(label, 'Comunidad estudiantil')

    // Assert
    expect(screen.getByTestId('preview-navigation')).toHaveTextContent('Comunidad estudiantil')
    expect(label).toHaveValue('Comunidad estudiantil')
  })

  it('blocks publication when a module label is blank', async () => {
    // Arrange
    const user = userEvent.setup()
    const { client } = renderCenter()

    // Act
    await user.click(screen.getByRole('tab', { name: 'Módulos' }))
    await user.clear(screen.getByLabelText('Nombre visible: Inicio'))

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent('El nombre visible de Inicio es obligatorio')
    expect(screen.getByRole('button', { name: 'Publicar cambios' })).toBeDisabled()
    expect(client.publishConfiguration).not.toHaveBeenCalled()
  })

  it('blocks a color pair that does not meet the text contrast threshold', async () => {
    // Arrange
    const user = userEvent.setup()
    renderCenter()

    // Act
    const textColor = screen.getByLabelText('Color HEX: Texto')
    await user.clear(textColor)
    await user.type(textColor, '#AAAAAA')

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent('Texto / Superficie')
    expect(screen.getByRole('button', { name: 'Publicar cambios' })).toBeDisabled()
  })

  it('requires banner alternative text, an image, and a valid time window', async () => {
    // Arrange
    const user = userEvent.setup()
    renderCenter()
    vi.stubGlobal('URL', { createObjectURL: vi.fn().mockReturnValue('blob:banner-preview'), revokeObjectURL: vi.fn() })
    await user.click(screen.getByRole('tab', { name: 'Banners' }))
    await user.click(screen.getByRole('button', { name: 'Agregar banner' }))

    // Act
    await user.type(screen.getByLabelText('Título del banner nuevo'), 'Inicio de semestre')
    await user.type(screen.getByLabelText('Inicio de vigencia del banner nuevo'), '2026-10-04T12:00')
    await user.type(screen.getByLabelText('Fin de vigencia del banner nuevo'), '2026-10-04T11:00')
    await user.upload(screen.getByLabelText('Imagen del banner nuevo'), new File(['png'], 'banner.png', { type: 'image/png' }))

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent('requiere texto alternativo')
    expect(screen.getByRole('alert')).toHaveTextContent('La fecha de fin debe ser posterior')
    expect(screen.getByRole('button', { name: 'Publicar cambios' })).toBeDisabled()

    // Act: completing alt text and correcting the range makes the draft publishable.
    await user.type(screen.getByLabelText('Texto alternativo del banner nuevo'), 'Estudiantes en el campus universitario')
    const end = screen.getByLabelText('Fin de vigencia del banner nuevo')
    await user.clear(end)
    await user.type(end, '2026-10-04T13:00')

    // Assert
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publicar cambios' })).toBeEnabled()
  })

  it('labels banners by their current schedule in the editor', async () => {
    // Arrange
    const user = userEvent.setup()
    const assetId = 'a7e7f06b-09a7-43db-a468-4c7b8ee3d301'
    const now = Date.now()
    const start = (seconds: number) => new Date(now + seconds * 1000).toISOString()
    const initial = configuration({ banners: [
      { id: 'b7e7f06b-09a7-43db-a468-4c7b8ee3d301', assetId, title: 'Banner vigente', altText: 'Comunidad UPTC', placement: 'home-hero', order: 1, startsAt: start(-3600), endsAt: start(3600) },
      { id: 'c7e7f06b-09a7-43db-a468-4c7b8ee3d301', assetId, title: 'Banner vencido', altText: 'Actividad universitaria', placement: 'home-hero', order: 2, startsAt: start(-7200), endsAt: start(-3600) },
      { id: 'd7e7f06b-09a7-43db-a468-4c7b8ee3d301', assetId, title: 'Banner programado', altText: 'Nueva cohorte', placement: 'home-hero', order: 3, startsAt: start(3600), endsAt: start(7200) },
    ] })
    renderCenter({ initialConfiguration: initial })

    // Act
    await user.click(screen.getByRole('tab', { name: 'Banners' }))

    // Assert
    expect(screen.getByText('Banner vigente').parentElement).toHaveTextContent('Vigente')
    expect(screen.getByText('Banner vencido').parentElement).toHaveTextContent('Vencido')
    expect(screen.getByText('Banner programado').parentElement).toHaveTextContent('Programado')
  })

  it('preserves the draft and reports a revision conflict', async () => {
    // Arrange
    const user = userEvent.setup()
    const client = createClient({
      publishConfiguration: vi.fn().mockRejectedValue(new BrandingAdministrationError(409, 'revision_conflict')),
    })
    renderCenter({ client })
    await user.click(screen.getByRole('tab', { name: 'Módulos' }))
    const label = screen.getByLabelText('Nombre visible: Estudiantes')
    await user.clear(label)
    await user.type(label, 'Comunidad UPTC')

    // Act
    await user.click(screen.getByRole('button', { name: 'Publicar cambios' }))

    // Assert
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('La configuración cambió en otra sesión'))
    expect(label).toHaveValue('Comunidad UPTC')
    expect(client.publishConfiguration).toHaveBeenCalledWith(expect.objectContaining({ expectedRevision: 7 }), 'test-access-token')
  })

  it('restores the prior snapshot as a new revision', async () => {
    // Arrange
    const user = userEvent.setup()
    const restored = configuration({ revision: 8, institutionName: 'Versión anterior restaurada' })
    const client = createClient({ restoreRevision: vi.fn().mockResolvedValue(restored) })
    renderCenter({ client })

    // Act
    await user.click(screen.getByRole('button', { name: 'Restaurar revisión anterior' }))
    const dialog = screen.getByRole('dialog', { name: 'Restaurar revisión anterior' })
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar restauración' }))

    // Assert
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Revisión 8 publicada'))
    expect(client.restoreRevision).toHaveBeenCalledWith(6, 7, 'test-access-token')
  })

  it('supports keyboard navigation between semantic editor tabs', async () => {
    // Arrange
    const user = userEvent.setup()
    renderCenter()
    const colorsTab = screen.getByRole('tab', { name: 'Colores' })
    colorsTab.focus()

    // Act
    await user.keyboard('{ArrowRight}')

    // Assert
    expect(screen.getByRole('tab', { name: 'Activos' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel', { name: 'Activos' })).toBeVisible()
  })

  it('shows an actionable message when the administrative configuration cannot load', async () => {
    // Arrange
    const client = createClient({ getCurrentConfiguration: vi.fn().mockRejectedValue(new Error('offline')) })
    renderCenter({ client, initialConfiguration: null })

    // Act + Assert
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar la configuración administrativa'))
    expect(screen.getByRole('button', { name: 'Reintentar carga' })).toBeEnabled()
  })

  it('keeps editing local when institutional access is not configured', async () => {
    // Arrange
    const user = userEvent.setup()
    const { client } = renderCenter({ accessToken: null })

    // Act
    await user.clear(screen.getByLabelText('Nombre de la institución'))

    // Assert
    expect(screen.getByRole('button', { name: 'Publicar cambios' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('La publicación requiere acceso institucional')
    expect(client.publishConfiguration).not.toHaveBeenCalled()
  })
})
