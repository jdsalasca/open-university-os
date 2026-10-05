import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import fullSnapshot from './uptcUndergraduateCatalog.snapshot.json'
import { PublicUndergraduateDirectory } from './PublicUndergraduateDirectory'
import type { PublicUndergraduateCatalogSnapshot } from './publicUndergraduateCatalog'

const catalog: PublicUndergraduateCatalogSnapshot = {
  schemaVersion: 1,
  source: {
    pageUrl: 'https://www.uptc.edu.co/sitio/portal/sitios/programas_ofer/pregrado.html',
    pageUpdatedAt: '2026-09-15',
    capturedAt: '2026-10-02',
  },
  programs: [
    {
      id: 'engineering-001',
      name: 'Ingeniería Mecánica',
      faculty: 'Facultad de Ingeniería',
      facultyCode: '07',
      level: 'Profesional Universitario',
      modality: 'Presencial',
      placeLabel: 'Tunja',
      locationsSummary: 'Tunja',
      markedOffered: true,
      detailUrl: 'https://www.uptc.edu.co/sitio/portal/programas/engineering-001/',
    },
    {
      id: 'education-001',
      name: 'Licenciatura en Educación Básica',
      faculty: 'Ciencias de la Educación',
      facultyCode: '03',
      level: 'Profesional Universitario',
      modality: 'Virtual',
      placeLabel: 'Virtual',
      locationsSummary: 'Tunja, Bogotá y Duitama',
      markedOffered: false,
      detailUrl: 'https://www.uptc.edu.co/sitio/portal/programas/education-001/',
    },
  ],
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('PublicUndergraduateDirectory', () => {
  it('loads and validates the same-origin snapshot after showing an accessible loading state', async () => {
    // Arrange
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => fullSnapshot }) as Response)
    vi.stubGlobal('fetch', fetchMock)
    render(<PublicUndergraduateDirectory />)

    // Act
    expect(screen.getByRole('status')).toHaveTextContent(/cargando el directorio público/i)
    const heading = await screen.findByRole('heading', { name: /programas de pregrado uptc/i })

    // Assert
    expect(heading).toBeVisible()
    expect(screen.getByText(/72 con la marca “programa ofertado”/i)).toBeVisible()
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('offers retry after the static snapshot fails and recovers when it becomes available', async () => {
    // Arrange
    const user = userEvent.setup()
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ ok: true, json: async () => fullSnapshot } as Response)
    vi.stubGlobal('fetch', fetchMock)
    render(<PublicUndergraduateDirectory />)

    // Act
    const retry = await screen.findByRole('button', { name: 'Reintentar' })
    expect(screen.getByRole('alert')).toHaveTextContent(/consulta la publicación oficial/i)
    await user.click(retry)

    // Assert
    expect(await screen.findByRole('heading', { name: /programas de pregrado uptc/i })).toBeVisible()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('aborts the static snapshot request when the directory unmounts', () => {
    // Arrange
    let requestSignal: AbortSignal | null | undefined
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      requestSignal = init?.signal
      return await new Promise<Response>(() => {})
    })
    vi.stubGlobal('fetch', fetchMock)
    const view = render(<PublicUndergraduateDirectory />)

    // Act
    view.unmount()

    // Assert
    expect(requestSignal).toBeInstanceOf(AbortSignal)
    expect(requestSignal?.aborted).toBe(true)
  })

  it('shows source dates, the admission-status limitation, and official program links', () => {
    render(<PublicUndergraduateDirectory snapshot={catalog} />)

    expect(screen.getByRole('heading', { name: /programas de pregrado uptc/i })).toBeVisible()
    expect(screen.getByRole('link', { name: /consultar fechas de admisión/i })).toHaveAttribute('href', '#admisiones')
    expect(screen.getByText(/la fuente señala actualización: 15 de septiembre de 2026/i)).toBeVisible()
    expect(screen.getByText(/esta consulta se registró el 2 de octubre de 2026/i)).toBeVisible()
    expect(screen.getByText(/no confirma convocatoria abierta, fechas, cupos ni admisión/i)).toBeVisible()

    const programLink = screen.getByRole('link', { name: /ingeniería mecánica/i })
    expect(programLink).toHaveAttribute('href', catalog.programs[0]?.detailUrl)
    expect(programLink).toHaveAttribute('target', '_blank')
    expect(screen.queryByText(/demo|vista previa|datos ficticios/i)).not.toBeInTheDocument()
  })

  it('filters the visible programs by faculty and modality', async () => {
    const user = userEvent.setup()
    render(<PublicUndergraduateDirectory snapshot={catalog} />)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Facultad' }), 'Facultad de Ingeniería')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Modalidad' }), 'Presencial')

    const results = screen.getByRole('list', { name: /programas encontrados/i })
    expect(within(results).getByRole('link', { name: /ingeniería mecánica/i })).toBeVisible()
    expect(within(results).queryByRole('link', { name: /licenciatura en educación básica/i })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('1 resultado')
  })

  it('supports accent-insensitive search and communicates an empty result', async () => {
    const user = userEvent.setup()
    render(<PublicUndergraduateDirectory snapshot={catalog} />)

    await user.type(screen.getByRole('searchbox', { name: /buscar en el directorio de programas uptc/i }), 'educacion tunja')
    expect(screen.getByRole('link', { name: /licenciatura en educación básica/i })).toBeVisible()

    await user.clear(screen.getByRole('searchbox', { name: /buscar en el directorio de programas uptc/i }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Facultad' }), 'Facultad de Ingeniería')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Lugar en la ficha pública' }), 'Virtual')

    expect(screen.getByText(/no hay programas que coincidan/i)).toBeVisible()
  })
})
