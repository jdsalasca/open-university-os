import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import snapshot from './uptcPostgraduateCatalog.snapshot.json'
import { PublicPostgraduateDirectory } from './PublicPostgraduateDirectory'
import type { PublicPostgraduateCatalogSnapshot } from './publicPostgraduateCatalog'

const catalog: PublicPostgraduateCatalogSnapshot = {
  schemaVersion: 1,
  source: {
    pageUrl: 'https://www.uptc.edu.co/sitio/portal/sitios/programas_ofer/posgrados.html',
    pageUpdatedAt: '2026-08-03',
    capturedAt: '2026-10-04',
  },
  programs: [
    {
      programCode: '13105',
      name: 'Maestría en Educación Ambiental',
      facultyOrUnit: 'Ciencias de la Educación',
      facultyCode: '03',
      level: 'Maestría',
      modality: 'Presencial',
      placeLabel: 'Tunja',
      locationsSummary: 'Tunja',
      detailUrl: 'https://www.uptc.edu.co/sitio/portal/programas/13105/',
    },
    {
      programCode: '14999',
      name: 'Especialización en Gestión Ambiental',
      facultyOrUnit: 'Ciencias de la Salud',
      facultyCode: '05',
      level: 'Especialización',
      modality: 'Virtual',
      placeLabel: 'Virtual',
      locationsSummary: 'Duitama',
      detailUrl: 'https://www.uptc.edu.co/sitio/portal/programas/14999/',
    },
  ],
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('PublicPostgraduateDirectory', () => {
  it('shows attributed snapshot dates and makes no claim about calls or availability', () => {
    // Arrange

    // Act
    render(<PublicPostgraduateDirectory snapshot={snapshot as PublicPostgraduateCatalogSnapshot} />)

    // Assert
    expect(screen.getByRole('heading', { name: /programas de posgrado uptc/i })).toBeVisible()
    expect(screen.getByText(/139 programas en el directorio/i)).toBeVisible()
    const sourceNote = screen.getByRole('note')
    expect(sourceNote).toHaveTextContent(/actualización: 3 de agosto de 2026/i)
    expect(sourceNote).toHaveTextContent(/la consulta se registró el 4 de octubre de 2026/i)
    expect(sourceNote).toHaveTextContent(/no confirma oferta abierta, convocatoria, fechas, cupos, admisión ni matrícula/i)
    expect(screen.queryByText(/programa ofertado|cupo disponible/i)).not.toBeInTheDocument()
  })

  it('combines a search without accents with public unit, place, modality and level filters', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<PublicPostgraduateDirectory snapshot={catalog} />)

    // Act
    await user.type(screen.getByRole('searchbox', { name: /buscar en el directorio de posgrado/i }), 'educacion tunja')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Facultad o unidad publicada' }), 'Ciencias de la Educación')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Lugar publicado' }), 'Tunja')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Modalidad' }), 'Presencial')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Nivel académico' }), 'Maestría')

    // Assert
    expect(screen.getByRole('link', { name: /maestría en educación ambiental/i })).toHaveAttribute('href', catalog.programs[0]?.detailUrl)
    expect(screen.queryByRole('link', { name: /gestión ambiental/i })).not.toBeInTheDocument()
  })

  it('retries after the static snapshot request fails', async () => {
    // Arrange
    const user = userEvent.setup()
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ ok: true, json: async () => snapshot } as Response)
    vi.stubGlobal('fetch', fetchMock)
    render(<PublicPostgraduateDirectory />)

    // Act
    const retry = await screen.findByRole('button', { name: 'Reintentar' })
    await user.click(retry)
    await screen.findByRole('heading', { name: /programas de posgrado uptc/i })

    // Assert
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
    const view = render(<PublicPostgraduateDirectory />)

    // Act
    view.unmount()

    // Assert
    expect(requestSignal).toBeInstanceOf(AbortSignal)
    expect(requestSignal?.aborted).toBe(true)
  })
})
