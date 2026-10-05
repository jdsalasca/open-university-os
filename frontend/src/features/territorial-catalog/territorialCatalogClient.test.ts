import { describe, expect, it, vi } from 'vitest'
import { createTerritorialCatalogClient, TerritorialCatalogApiError } from './territorialCatalogClient'

const source = {
  publisher: 'DANE',
  datasetName: 'DIVIPOLA según Marco Geoestadístico Nacional',
  datasetVersion: 'MGN 2025',
  snapshotRetrievedAt: '2026-10-02',
  serviceUrl: 'https://geoportal.dane.gov.co/mparcgis/rest/services/Divipola/Serv_DIVIPOLA_MGN_2025/FeatureServer',
  documentationUrl: 'https://www.dane.gov.co/index.php/sistema-estadistico-nacional-sen/normas-y-estandares/nomenclaturas-y-clasificaciones/nomenclaturas/codificacion-de-la-division-politica-administrativa-de-colombia-divipola',
} as const

const departments = {
  source,
  departments: [
    { code: '05', name: 'ANTIOQUIA' },
    { code: '15', name: 'BOYACÁ' },
  ],
} as const

const boyaca = {
  source,
  department: { code: '15', name: 'BOYACÁ' },
  entities: [
    { code: '15001', departmentCode: '15', localCode: '001', name: 'TUNJA', type: 'MUNICIPIO', dataYear: 2025 },
    { code: '15762', departmentCode: '15', localCode: '762', name: 'SOTAQUIRÁ', type: 'MUNICIPIO', dataYear: 2024 },
  ],
} as const

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('territorial catalog client', () => {
  it('loads departments and a department-specific list without credentials while forwarding cancellation', async () => {
    // Arrange
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(departments))
      .mockResolvedValueOnce(jsonResponse(boyaca))
    const client = createTerritorialCatalogClient(fetcher)
    const controller = new AbortController()

    // Act
    const departmentResult = await client.listDepartments(controller.signal)
    const entityResult = await client.listEntities('15', controller.signal)

    // Assert
    expect(departmentResult.departments[0]?.code).toBe('05')
    expect(entityResult.entities[0]).toMatchObject({ code: '15001', localCode: '001', type: 'MUNICIPIO' })
    expect(fetcher).toHaveBeenNthCalledWith(1, '/api/v1/territorial-catalog/departments', expect.objectContaining({
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
    }))
    expect(fetcher).toHaveBeenNthCalledWith(2,
      '/api/v1/territorial-catalog/departments/15/entities', expect.objectContaining({
        method: 'GET',
        credentials: 'omit',
        signal: controller.signal,
      }))
  })

  it('rejects an entity response belonging to a different department', async () => {
    // Arrange
    const invalid = {
      ...boyaca,
      entities: boyaca.entities.map((entity, index) => index === 0
        ? { ...entity, departmentCode: '05' }
        : entity),
    }
    const client = createTerritorialCatalogClient(vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(invalid)))

    // Act + Assert
    await expect(client.listEntities('15')).rejects.toThrow(/respuesta.*territorial/i)
  })

  it('rejects a duplicate territorial identifier rather than showing an ambiguous option', async () => {
    // Arrange
    const invalid = { ...boyaca, entities: [boyaca.entities[0], boyaca.entities[0]] }
    const client = createTerritorialCatalogClient(vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(invalid)))

    // Act + Assert
    await expect(client.listEntities('15')).rejects.toThrow(/respuesta.*territorial/i)
  })

  it('rejects a source URL that imitates the DANE domain', async () => {
    // Arrange
    const invalid = { ...departments, source: {
      ...source,
      serviceUrl: 'https://geoportal.dane.gov.co.attacker.example/service',
    } }
    const client = createTerritorialCatalogClient(vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(invalid)))

    // Act + Assert
    await expect(client.listDepartments()).rejects.toThrow(/respuesta.*territorial/i)
  })

  it('does not issue a request for a malformed department code', async () => {
    // Arrange
    const fetcher = vi.fn<typeof fetch>()
    const client = createTerritorialCatalogClient(fetcher)

    // Act + Assert
    await expect(client.listEntities('../15')).rejects.toThrow(/código de departamento/i)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('preserves an HTTP status when the reference API is unavailable', async () => {
    // Arrange
    const client = createTerritorialCatalogClient(vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 503)))

    // Act + Assert
    await expect(client.listDepartments()).rejects.toMatchObject<Partial<TerritorialCatalogApiError>>({
      name: 'TerritorialCatalogApiError',
      status: 503,
    })
  })
})
