import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_BRANDING } from '../branding/contracts'
import type { PublicBranding } from '../branding/contracts'
import { WorkspaceHomePage } from './WorkspaceHomePage'

afterEach(cleanup)

function branding(overrides: Partial<PublicBranding> = {}): PublicBranding {
  return { ...DEFAULT_BRANDING, ...overrides }
}

describe('WorkspaceHomePage', () => {
  it('gives students a public route to the official academic service directory', () => {
    // Arrange
    render(<WorkspaceHomePage
      branding={branding()}
      permissions={[]}
      isLocalPreview={false}
      now={Date.parse('2026-10-02T14:00:00Z')}
    />)

    // Act
    const publicSection = screen.getByRole('region', { name: /explora la universidad/i })

    // Assert
    expect(within(publicSection).getByRole('link', { name: /servicios académicos/i })).toHaveAttribute(
      'href', '#estudiantes',
    )
  })

  it('presents public routes without exposing administration to an identity with no permissions', () => {
    // Arrange
    render(<WorkspaceHomePage
      branding={branding()}
      permissions={[]}
      isLocalPreview={false}
      now={Date.parse('2026-10-02T14:00:00Z')}
    />)

    // Act
    const publicSection = screen.getByRole('region', { name: /explora la universidad/i })

    // Assert
    expect(within(publicSection).getByRole('link', { name: /admisiones/i })).toHaveAttribute('href', '#admisiones')
    expect(within(publicSection).getByRole('link', { name: /programas de pregrado/i })).toHaveAttribute('href', '#programas')
    expect(within(publicSection).getByRole('link', { name: /programas de pregrado/i })).toHaveTextContent(/oferta pública/i)
    expect(within(publicSection).getByRole('link', { name: /guía de espacios/i })).toHaveAttribute('href', '#espacios')
    expect(screen.queryByRole('region', { name: /herramientas administrativas/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/synthetic-subject|correo@/i)).not.toBeInTheDocument()
  })

  it('shows administrative routes only for the corresponding effective permissions', () => {
    // Arrange
    render(<WorkspaceHomePage
      branding={branding()}
      permissions={['academic:period:read', 'admissions:calendar:read']}
      isLocalPreview={false}
      now={Date.parse('2026-10-02T14:00:00Z')}
    />)

    // Act
    const administration = screen.getByRole('region', { name: /herramientas administrativas/i })

    // Assert
    expect(within(administration).getByRole('link', { name: /estructura, periodos y oferta/i })).toHaveAttribute('href', '#academia')
    expect(within(administration).getByRole('link', { name: /gestionar admisiones/i })).toHaveAttribute('href', '#admisiones')
    expect(within(administration).queryByRole('link', { name: /accesos y perfiles/i })).not.toBeInTheDocument()
    expect(within(administration).queryByRole('link', { name: /identidad visual/i })).not.toBeInTheDocument()
  })

  it('uses the lowest-order home banner active at the inclusive start and exclusive end instant', () => {
    // Arrange
    const currentTime = Date.parse('2026-10-02T14:00:00Z')
    const config = branding({ banners: [
      {
        id: '10000000-0000-4000-8000-000000000001',
        assetId: '20000000-0000-4000-8000-000000000001',
        title: 'Vigente segundo',
        altText: 'Personas en el campus',
        placement: 'home-hero',
        order: 2,
        startsAt: '2026-10-02T13:00:00Z',
        endsAt: '2026-10-02T15:00:00Z',
      },
      {
        id: '10000000-0000-4000-8000-000000000002',
        assetId: '20000000-0000-4000-8000-000000000002',
        title: 'Inicio en este instante',
        altText: 'Estudiantes caminando por el campus',
        placement: 'home-hero',
        order: 1,
        startsAt: '2026-10-02T14:00:00Z',
        endsAt: '2026-10-02T15:00:00Z',
      },
      {
        id: '10000000-0000-4000-8000-000000000003',
        assetId: '20000000-0000-4000-8000-000000000003',
        title: 'Ya terminó',
        altText: 'Banner vencido',
        placement: 'home-hero',
        order: 0,
        startsAt: '2026-10-02T12:00:00Z',
        endsAt: '2026-10-02T14:00:00Z',
      },
      {
        id: '10000000-0000-4000-8000-000000000004',
        assetId: '20000000-0000-4000-8000-000000000004',
        title: 'Aún no inicia',
        altText: 'Banner programado',
        placement: 'home-hero',
        order: 0,
        startsAt: '2026-10-02T15:00:00Z',
        endsAt: null,
      },
    ] })

    // Act
    render(<WorkspaceHomePage branding={config} permissions={[]} isLocalPreview={false} now={currentTime} />)

    // Assert
    expect(screen.getByRole('heading', { name: 'Inicio en este instante' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Estudiantes caminando por el campus' })).toHaveAttribute(
      'src', '/assets/20000000-0000-4000-8000-000000000002',
    )
    expect(screen.queryByRole('heading', { name: 'Ya terminó' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Aún no inicia' })).not.toBeInTheDocument()
  })

  it('does not show configured public modules that are hidden or unavailable', () => {
    // Arrange
    const config = branding({
      modules: DEFAULT_BRANDING.modules.map((module) => module.key === 'spaces'
        ? { ...module, available: false }
        : module.key === 'admissions'
          ? { ...module, visible: false }
          : module),
    })
    render(<WorkspaceHomePage branding={config} permissions={[]} isLocalPreview={false} />)

    // Act
    const publicSection = screen.getByRole('region', { name: /explora la universidad/i })

    // Assert
    expect(within(publicSection).queryByRole('link', { name: /convocatorias de pregrado/i })).not.toBeInTheDocument()
    expect(within(publicSection).queryByRole('link', { name: /guía de espacios/i })).not.toBeInTheDocument()
    expect(within(publicSection).getByRole('link', { name: /programas de pregrado/i })).toBeInTheDocument()
    expect(within(publicSection).getByRole('link', { name: /programas de pregrado/i })).not.toHaveTextContent(/vista previa|demo|ficticio/i)
  })

  it('does not surface synthetic workflows as university services in the local portal', () => {
    render(<WorkspaceHomePage branding={branding()} permissions={[]}
      isLocalPreview={true} />)

    expect(screen.queryByRole('region', { name: /laboratorios locales de muestra/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /aspirante y equipo|mi semana y mis materias|registro de calificaciones/i })).not.toBeInTheDocument()
    // El aviso ya no declara `role="status"`: sobre un `<aside>` ese rol pisa el landmark
    // `complementary` y axe-core lo marca como `aria-allowed-role`. Se consulta por su nombre y se
    // comprueba que sigue siendo una region viva.
    const aviso = screen.getByRole('complementary', { name: /vista previa con datos sintéticos/i })
    expect(aviso).toHaveTextContent(/no representa un rol institucional/i)
    expect(aviso).toHaveAttribute('aria-live', 'polite')
  })
})
