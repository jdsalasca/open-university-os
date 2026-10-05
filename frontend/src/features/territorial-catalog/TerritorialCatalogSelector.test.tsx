import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  TerritorialDepartmentList,
  TerritorialEntityList,
} from './territorialCatalogContracts'
import type { TerritorialCatalogClient } from './territorialCatalogClient'
import { TerritorialCatalogSelector } from './TerritorialCatalogSelector'

afterEach(cleanup)

const source = {
  publisher: 'DANE',
  datasetName: 'DIVIPOLA según Marco Geoestadístico Nacional',
  datasetVersion: 'MGN 2025',
  snapshotRetrievedAt: '2026-10-02',
  serviceUrl: 'https://geoportal.dane.gov.co/mparcgis/rest/services/Divipola/Serv_DIVIPOLA_MGN_2025/FeatureServer',
  documentationUrl: 'https://www.dane.gov.co/index.php/sistema-estadistico-nacional-sen/normas-y-estandares/nomenclaturas-y-clasificaciones/nomenclaturas/codificacion-de-la-division-politica-administrativa-de-colombia-divipola',
} as const

const departmentList: TerritorialDepartmentList = {
  source,
  departments: [
    { code: '05', name: 'ANTIOQUIA' },
    { code: '15', name: 'BOYACÁ' },
    { code: '88', name: 'SAN ANDRÉS' },
    { code: '91', name: 'AMAZONAS' },
  ],
}

const entityLists: Record<string, TerritorialEntityList> = {
  '05': {
    source,
    department: { code: '05', name: 'ANTIOQUIA' },
    entities: [{ code: '05001', departmentCode: '05', localCode: '001', name: 'MEDELLÍN', type: 'MUNICIPIO', dataYear: 2025 }],
  },
  '15': {
    source,
    department: { code: '15', name: 'BOYACÁ' },
    entities: [
      { code: '15001', departmentCode: '15', localCode: '001', name: 'TUNJA', type: 'MUNICIPIO', dataYear: 2025 },
      { code: '15762', departmentCode: '15', localCode: '762', name: 'SOTAQUIRÁ', type: 'MUNICIPIO', dataYear: 2024 },
    ],
  },
  '88': {
    source,
    department: { code: '88', name: 'SAN ANDRÉS' },
    entities: [{ code: '88001', departmentCode: '88', localCode: '001', name: 'SAN ANDRÉS', type: 'ISLA', dataYear: 2025 }],
  },
  '91': {
    source,
    department: { code: '91', name: 'AMAZONAS' },
    entities: [{ code: '91263', departmentCode: '91', localCode: '263', name: 'EL ENCANTO', type: 'AREA_NO_MUNICIPALIZADA', dataYear: 2024 }],
  },
}

function createClient(): TerritorialCatalogClient {
  return {
    listDepartments: vi.fn<TerritorialCatalogClient['listDepartments']>().mockResolvedValue(departmentList),
    listEntities: vi.fn<TerritorialCatalogClient['listEntities']>().mockImplementation(async (code) => {
      const result = entityLists[code]
      if (!result) throw new Error('Departamento no disponible en el fixture.')
      return result
    }),
  }
}

describe('TerritorialCatalogSelector', () => {
  it('keeps labels associated with unique field IDs across selector instances', async () => {
    // Arrange
    const user = userEvent.setup()
    const client = createClient()
    render(
      <>
        <TerritorialCatalogSelector client={client} />
        <TerritorialCatalogSelector client={client} />
      </>,
    )

    // Act
    const departmentFields = await screen.findAllByLabelText('Departamento de referencia')
    await waitFor(() => {
      expect(screen.getAllByRole('option', { name: 'ANTIOQUIA · 05' })).toHaveLength(2)
    })
    await user.selectOptions(departmentFields[0]!, '05')
    await user.selectOptions(departmentFields[1]!, '15')
    await screen.findAllByLabelText('Buscar entidad territorial')
    const entityFields = screen.getAllByLabelText('Entidad territorial')
    const searchFields = screen.getAllByLabelText('Buscar entidad territorial')
    const fieldIds = [...departmentFields, ...entityFields, ...searchFields].map((field) => field.id)

    // Assert
    expect(fieldIds).toHaveLength(6)
    expect(new Set(fieldIds).size).toBe(6)
  })

  it('loads only the selected department, normalizes search, and clears its previous entity after a change', async () => {
    // Arrange
    const user = userEvent.setup()
    const client = createClient()
    render(<TerritorialCatalogSelector client={client} />)
    const departmentSelect = await screen.findByLabelText('Departamento de referencia')

    // Act
    await user.selectOptions(departmentSelect, '15')
    expect(await screen.findByRole('option', { name: /SOTAQUIRÁ/ })).toBeInTheDocument()
    const entitySelect = screen.getByLabelText('Entidad territorial')
    await user.selectOptions(entitySelect, '15762')
    expect(await screen.findByText('15762', { selector: 'strong' })).toBeVisible()
    await user.type(screen.getByLabelText('Buscar entidad territorial'), 'sotaquira')

    // Assert
    expect(screen.getByRole('option', { name: /SOTAQUIRÁ/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /TUNJA/ })).not.toBeInTheDocument()
    expect(client.listEntities).toHaveBeenCalledWith('15', expect.any(AbortSignal))
    expect(client.listEntities).not.toHaveBeenCalledWith('05', expect.anything())

    // Act: changing department clears the dependent selection and search.
    await user.selectOptions(departmentSelect, '05')

    // Assert
    expect(await screen.findByRole('option', { name: /MEDELLÍN/ })).toBeInTheDocument()
    expect(entitySelect).toHaveValue('')
    expect(screen.queryByText('15762', { selector: 'strong' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Buscar entidad territorial')).toHaveValue('')
  })

  it('labels an island and a non-municipalized area as distinct reference types', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<TerritorialCatalogSelector client={createClient()} />)
    const departmentSelect = await screen.findByLabelText('Departamento de referencia')

    // Act and assert: island.
    await user.selectOptions(departmentSelect, '88')
    const islandOption = await screen.findByRole('option', { name: /Isla · SAN ANDRÉS · 88001/ })
    expect(islandOption).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Entidad territorial'), '88001')
    expect(await screen.findByText(/Isla · referencia de 2025/)).toBeVisible()

    // Act and assert: non-municipalized area.
    await user.selectOptions(departmentSelect, '91')
    const areaOption = await screen.findByRole('option', { name: /Área no municipalizada · EL ENCANTO/ })
    expect(areaOption).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Entidad territorial'), '91263')
    expect(await screen.findByText(/Área no municipalizada · referencia de 2024/)).toBeVisible()
  })

  it('offers a department retry after a source request fails', async () => {
    // Arrange
    const user = userEvent.setup()
    const client = createClient()
    vi.mocked(client.listDepartments)
      .mockRejectedValueOnce(new Error('temporary unavailable'))
      .mockResolvedValueOnce(departmentList)
    render(<TerritorialCatalogSelector client={client} />)

    // Act
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo consultar/i))
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    // Assert
    expect(await screen.findByRole('option', { name: /ANTIOQUIA/ })).toBeInTheDocument()
    expect(client.listDepartments).toHaveBeenCalledTimes(2)
  })

  it('offers an entity retry after the selected department request fails', async () => {
    // Arrange
    const user = userEvent.setup()
    const client = createClient()
    vi.mocked(client.listEntities)
      .mockRejectedValueOnce(new Error('temporary unavailable'))
      .mockResolvedValueOnce(entityLists['15']!)
    render(<TerritorialCatalogSelector client={client} />)
    const select1 = await screen.findByLabelText('Departamento de referencia')
    await waitFor(() => expect(select1).toBeEnabled())
    await user.selectOptions(select1, '15')

    // Act
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/no se pudieron cargar las entidades/i))
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    // Assert
    expect(await screen.findByRole('option', { name: /TUNJA/ })).toBeInTheDocument()
    expect(client.listEntities).toHaveBeenCalledTimes(2)
  })

  it('clears an unmatched search and restores the current department entities', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<TerritorialCatalogSelector client={createClient()} />)
    const select2 = await screen.findByLabelText('Departamento de referencia')
    await waitFor(() => expect(select2).toBeEnabled())
    await user.selectOptions(select2, '15')
    await screen.findByRole('option', { name: /TUNJA/ })

    // Act
    await user.type(screen.getByLabelText('Buscar entidad territorial'), 'no existe')

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent(/no hay entidades que coincidan/i)
    await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }))
    expect(screen.getByRole('option', { name: /TUNJA/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /SOTAQUIRÁ/ })).toBeInTheDocument()
  })

  it('aborts an in-flight department request and ignores its stale response after selection changes', async () => {
    // Arrange
    const user = userEvent.setup()
    const client = createClient()
    let resolveBoyaca: ((value: TerritorialEntityList) => void) | undefined
    let boyacaSignal: AbortSignal | undefined
    vi.mocked(client.listEntities).mockImplementation((code, signal) => {
      if (code === '15') {
        boyacaSignal = signal
        return new Promise((resolve) => { resolveBoyaca = resolve })
      }
      return Promise.resolve(entityLists[code]!)
    })
    render(<TerritorialCatalogSelector client={client} />)
    const departmentSelect = await screen.findByLabelText('Departamento de referencia')

    // Act
    await user.selectOptions(departmentSelect, '15')
    await waitFor(() => expect(client.listEntities).toHaveBeenCalledWith('15', expect.any(AbortSignal)))
    await user.selectOptions(departmentSelect, '05')
    expect(await screen.findByRole('option', { name: /MEDELLÍN/ })).toBeInTheDocument()
    await act(async () => {
      resolveBoyaca?.(entityLists['15']!)
      await Promise.resolve()
    })

    // Assert
    expect(boyacaSignal?.aborted).toBe(true)
    expect(screen.queryByText('15001', { selector: 'strong' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Entidad territorial')).toHaveValue('')
  })
})
