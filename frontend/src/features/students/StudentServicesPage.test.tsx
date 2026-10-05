import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../../App'
import { BrandingProvider } from '../branding/BrandingProvider'
import { DEFAULT_BRANDING } from '../branding/contracts'

function renderStudentServicesPage() {
  window.history.replaceState(null, '', '#estudiantes')
  render(
    <BrandingProvider loader={async () => DEFAULT_BRANDING}>
      <App />
    </BrandingProvider>,
  )
}

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '#inicio')
})

describe('StudentServicesPage', () => {
  it('shows student services across categories as source-attributed cards', async () => {
    // Arrange
    renderStudentServicesPage()

    // Act
    await screen.findByRole('heading', { name: 'Servicios para acompañar tu vida universitaria' })

    // Assert
    const cards = screen.getAllByRole('article')
    expect(cards).toHaveLength(11)
    expect(cards.map((card) => within(card).getByRole('heading').textContent)).toEqual([
      'Bienestar Universitario',
      'Bienestar Virtual',
      'Cultura',
      'Actividad Física',
      'Apoyo socioeconómico',
      'Préstamo y consulta bibliográfica',
      'Biblioteca digital y catálogo',
      'Horarios y calificaciones en UPTConecta',
      'SIRA estudiante',
      'Inscripción de materias',
      'Fechas académicas de pregrado',
    ])
    expect(screen.getByRole('searchbox', { name: 'Buscar servicios estudiantiles' })).toBeVisible()
    expect(screen.queryAllByRole('form')).toHaveLength(0)

    const sourceLinks = screen.getAllByRole('link', { name: /en el portal oficial UPTC/i })
    expect(sourceLinks).toHaveLength(11)
    for (const link of sourceLinks) {
      const sourceUrl = new URL(link.getAttribute('href') ?? '')
      expect(sourceUrl.protocol).toBe('https:')
      expect(['uptc.edu.co', 'www.uptc.edu.co']).toContain(sourceUrl.hostname)
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })

  it('shows official entry points for UPTConecta, SIRA, subject registration and the undergraduate calendar', async () => {
    // Arrange
    renderStudentServicesPage()

    // Act
    await screen.findByRole('heading', { name: 'Servicios para acompañar tu vida universitaria' })

    // Assert
    expect(screen.getAllByRole('article')).toHaveLength(11)
    const officialRoutes = [
      {
        title: 'Cultura',
        href: 'https://www.uptc.edu.co/sitio/portal/sitios/universidad/rectoria/bie_uni/lineas_accion/cultura/',
      },
      {
        title: 'Actividad Física',
        href: 'https://www.uptc.edu.co/sitio/portal/sitios/universidad/rectoria/bie_uni/lineas_accion/act_fisica/index.html',
      },
      {
        title: 'Horarios y calificaciones en UPTConecta',
        href: 'https://www.uptc.edu.co/sitio/portal/cal_not_eve/noticias/det/UPTConecta-la-App-institucional-incorpora-nuevos-servicios-para-la-comunidad-upetecista/',
      },
      {
        title: 'SIRA estudiante',
        href: 'https://www.uptc.edu.co/sitio/portal/campus_virtual/',
      },
      {
        title: 'Inscripción de materias',
        href: 'https://uptc.edu.co/sitio/portal/sitios/estudiantes/sis_inf/',
      },
      {
        title: 'Fechas académicas de pregrado',
        href: 'https://uptc.edu.co/sitio/portal/sitios/universidad/vic_aca/adm_reg/2estu/est_pre.html',
      },
    ]

    for (const route of officialRoutes) {
      const heading = screen.getByRole('heading', { name: route.title })
      const card = heading.closest('article')
      expect(card).not.toBeNull()
      const link = within(card!).getByRole('link')
      expect(link).toHaveAttribute('href', route.href)
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }

    expect(screen.queryAllByRole('form')).toHaveLength(0)
    expect(screen.queryByLabelText(/contraseña|documento|código estudiantil/i)).not.toBeInTheDocument()
  })

  it('finds the new wellbeing lines by distinct accent-insensitive terms', async () => {
    // Arrange
    const user = userEvent.setup()
    renderStudentServicesPage()
    await screen.findByRole('heading', { name: 'Servicios para acompañar tu vida universitaria' })
    const search = screen.getByRole('searchbox', { name: 'Buscar servicios estudiantiles' })

    // Act
    await user.type(search, 'interculturalidad')

    // Assert
    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'Cultura' })).toBeVisible()

    // Act
    await user.clear(search)
    await user.type(search, 'musculacion')

    // Assert
    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'Actividad Física' })).toBeVisible()
  })

  it('filters institutional systems by category and accent-insensitive text', async () => {
    // Arrange
    const user = userEvent.setup()
    renderStudentServicesPage()
    await screen.findByRole('heading', { name: 'Servicios para acompañar tu vida universitaria' })

    // Act
    await user.click(screen.getByRole('button', { name: 'Sistemas institucionales' }))
    await user.type(screen.getByRole('searchbox', { name: 'Buscar servicios estudiantiles' }), 'CALIFICACIONES')

    // Assert
    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'Horarios y calificaciones en UPTConecta' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'SIRA estudiante' })).not.toBeInTheDocument()
  })

  it('separates socioeconomic support and attributes its official source date', async () => {
    // Arrange
    renderStudentServicesPage()

    // Act
    const supportHeading = await screen.findByRole('heading', { name: 'Apoyo socioeconómico' })
    const supportCard = supportHeading.closest('article')
    const wellbeingCard = screen.getByRole('heading', { name: 'Bienestar Virtual' }).closest('article')

    // Assert
    expect(supportCard).not.toBeNull()
    expect(within(supportCard!).getByRole('link', { name: /consultar apoyo socioeconómico en el portal oficial uptc/i }))
      .toHaveAttribute('href', 'https://www.uptc.edu.co/sitio/portal/sitios/universidad/rectoria/bie_uni/lineas_accion/apoyo/')
    expect(within(supportCard!).getByText('actualizada 20 jul 2025')).toHaveAttribute('datetime', '2025-07-20')
    expect(within(wellbeingCard!).getByText(/rutas virtuales publicadas/i)).not.toHaveTextContent(/apoyo socioeconómico/i)
    expect(within(supportCard!).getByText(/confirma.*vigencia|confirma.*requisitos/i)).toBeVisible()
  })

  it('matches accented service names with case-insensitive, unaccented text', async () => {
    // Arrange
    const user = userEvent.setup()
    renderStudentServicesPage()
    await screen.findByRole('heading', { name: 'Servicios para acompañar tu vida universitaria' })

    // Act
    await user.type(screen.getByRole('searchbox', { name: 'Buscar servicios estudiantiles' }), 'PRESTAMO')

    // Assert
    const cards = screen.getAllByRole('article')
    expect(cards.map((card) => within(card).getByRole('heading').textContent)).toEqual([
      'Préstamo y consulta bibliográfica',
    ])
    expect(screen.getByText('1', { selector: 'strong' })).toBeVisible()
    expect(screen.getByText('servicio disponible')).toBeVisible()
  })

  it('combines a category filter with the local text search', async () => {
    // Arrange
    const user = userEvent.setup()
    renderStudentServicesPage()
    await screen.findByRole('heading', { name: 'Servicios para acompañar tu vida universitaria' })

    // Act
    await user.click(screen.getByRole('button', { name: 'Biblioteca' }))
    const search = screen.getByRole('searchbox', { name: 'Buscar servicios estudiantiles' })
    await user.type(search, 'PRESTAMO')

    // Assert
    expect(screen.getAllByRole('article').map((card) => within(card).getByRole('heading').textContent)).toEqual([
      'Préstamo y consulta bibliográfica',
    ])
    expect(screen.queryByRole('heading', { name: 'Bienestar Universitario' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Bienestar Virtual' })).not.toBeInTheDocument()
  })

  it('explains an empty result and resets the search and category together', async () => {
    // Arrange
    const user = userEvent.setup()
    renderStudentServicesPage()
    await screen.findByRole('heading', { name: 'Servicios para acompañar tu vida universitaria' })

    // Act
    await user.click(screen.getByRole('button', { name: 'Biblioteca' }))
    const search = screen.getByRole('searchbox', { name: 'Buscar servicios estudiantiles' })
    await user.type(search, 'sin coincidencias')

    // Assert
    expect(screen.getByText('0', { selector: 'strong' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('No encontramos servicios con esos filtros.')
    await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda y filtros' }))
    expect(screen.getAllByRole('article')).toHaveLength(11)
    expect(search).toHaveValue('')
    expect(search).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true')
  })
})
