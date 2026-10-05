import { describe, expect, it, vi } from 'vitest'
import { createSpaceGuideClient, SpaceGuideApiError } from './spaceGuideClient'

const payload = {
  officialOfficeDirectoryUrl: 'https://www.uptc.edu.co/sitio/portal/sitios/directorio/',
  requestPathways: [{
    id: 'library-rooms',
    kind: 'LIBRARY_ROOM',
    title: 'Salas y espacios de biblioteca',
    audience: 'Comunidad UPTC según las condiciones de cada sala',
    summary: 'Consulta los términos y la disponibilidad con la biblioteca correspondiente.',
    availabilityNote: 'Esta guía no confirma reservas.',
    sources: [{
      label: 'Servicios de Biblioteca Presencial UPTC',
      url: 'https://www.uptc.edu.co/sitio/portal/sitios/universidad/vic_aca/bibl/4_bpd/blbl_pres.html',
      checkedAt: '2026-10-01',
      sourceUpdatedAt: null,
    }],
  }],
  locations: [{
    id: 'cread-bogota',
    kind: 'CREAD',
    name: 'CREAD Bogotá',
    municipality: 'Bogotá',
    department: null,
    address: 'Carrera 13 No. 24-15',
    locationDetail: 'Instalaciones INCCA',
    mapQuery: 'Carrera 13 No. 24-15, Bogotá',
    source: {
      label: 'Localización y sedes UPTC',
      url: 'https://uptc.edu.co/sitio/portal/sitios/localizacion/',
      checkedAt: '2026-10-01',
      sourceUpdatedAt: null,
    },
  }],
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('public space guide client', () => {
  it('loads and validates the public directory without credentials or cookies', async () => {
    // Arrange
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(payload))
    const client = createSpaceGuideClient(fetcher)
    const controller = new AbortController()

    // Act
    const result = await client.listSpaces(controller.signal)

    // Assert
    expect(result.locations[0]).toMatchObject({ id: 'cread-bogota', department: null })
    expect(result.locations[0].announcement).toBeNull()
    expect(result.requestPathways[0]).toMatchObject({ id: 'library-rooms', kind: 'LIBRARY_ROOM' })
    expect(fetcher).toHaveBeenCalledWith('/api/v1/spaces', {
      credentials: 'omit',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
  })

  it('preserves separately announced capacities and validates their official location references', async () => {
    // Arrange
    const announcement = {
      capacities: [
        { areaName: 'Zona de estudio teórico e histórico', announcedCapacityPersons: 30 },
        { areaName: 'Zona de atención central', announcedCapacityPersons: 8 },
        { areaName: 'Sala de estudio', announcedCapacityPersons: 25 },
      ],
      locationNote: 'El comunicado ubica los nuevos espacios en el segundo piso; la ficha de biblioteca aún indica el primero. Confirma antes de desplazarte.',
      locationReferences: [{
        label: 'Biblioteca presencial UPTC · Biblioteca Especializada en Música',
        url: 'https://www.uptc.edu.co/sitio/portal/sitios/universidad/vic_aca/bibl/4_bpd/blbl_pres.html',
        checkedAt: '2026-10-03',
        sourceUpdatedAt: '2022-08-11',
      }],
    }
    const payloadWithAnnouncement = structuredClone(payload) as typeof payload & { locations: Array<Record<string, unknown>> }
    payloadWithAnnouncement.locations[0] = {
      ...payloadWithAnnouncement.locations[0],
      id: 'service-music-library-2026',
      kind: 'SERVICE',
      address: null as unknown as string,
      locationDetail: 'Segundo piso del Edificio de Música, según comunicado UPTC.',
      mapQuery: null as unknown as string,
      announcement,
    }
    const client = createSpaceGuideClient(vi.fn().mockResolvedValue(jsonResponse(payloadWithAnnouncement)))

    // Act
    const result = await client.listSpaces()

    // Assert
    expect(result.locations[0].announcement).toEqual(announcement)
  })

  it('rejects an announced capacity that is zero or negative', async () => {
    // Arrange
    for (const announcedCapacityPersons of [0, -1]) {
      const invalidPayload = structuredClone(payload) as typeof payload & { locations: Array<Record<string, unknown>> }
      invalidPayload.locations[0].announcement = {
        capacities: [{ areaName: 'Sala de estudio', announcedCapacityPersons }],
        locationNote: 'Confirma la ubicación con Biblioteca.',
        locationReferences: [{
          label: 'Biblioteca presencial UPTC',
          url: 'https://www.uptc.edu.co/sitio/portal/sitios/universidad/vic_aca/bibl/4_bpd/blbl_pres.html',
          checkedAt: '2026-10-03',
          sourceUpdatedAt: '2022-08-11',
        }],
      }
      const client = createSpaceGuideClient(vi.fn().mockResolvedValue(jsonResponse(invalidPayload)))

      // Act + Assert
      await expect(client.listSpaces()).rejects.toThrow('Un área anunciada no cumple el contrato público.')
    }
  })

  it('rejects announced capacities on a regular location with an address or map query', async () => {
    // Arrange
    const invalidPayload = structuredClone(payload) as typeof payload & { locations: Array<Record<string, unknown>> }
    invalidPayload.locations[0].announcement = {
      capacities: [{ areaName: 'Sala de estudio', announcedCapacityPersons: 25 }],
      locationNote: 'Confirma la ubicación con Biblioteca.',
      locationReferences: [{
        label: 'Biblioteca presencial UPTC',
        url: 'https://www.uptc.edu.co/sitio/portal/sitios/universidad/vic_aca/bibl/4_bpd/blbl_pres.html',
        checkedAt: '2026-10-03',
        sourceUpdatedAt: '2022-08-11',
      }],
    }
    const client = createSpaceGuideClient(vi.fn().mockResolvedValue(jsonResponse(invalidPayload)))

    // Act + Assert
    await expect(client.listSpaces()).rejects.toThrow('El anuncio de un espacio no cumple el contrato público.')
  })

  it('rejects a source URL outside the official UPTC domain', async () => {
    // Arrange
    const invalidPayload = structuredClone(payload)
    invalidPayload.locations[0].source.url = 'https://uptc.edu.co.attacker.example/locations'
    const client = createSpaceGuideClient(vi.fn().mockResolvedValue(jsonResponse(invalidPayload)))

    // Act + Assert
    await expect(client.listSpaces()).rejects.toThrow('La fuente de un espacio no cumple el contrato público.')
  })

  it('rejects a request pathway source outside the official UPTC domain', async () => {
    // Arrange
    const invalidPayload = structuredClone(payload)
    invalidPayload.requestPathways[0].sources[0].url = 'https://uptc.edu.co.attacker.example/reservas'
    const client = createSpaceGuideClient(vi.fn().mockResolvedValue(jsonResponse(invalidPayload)))

    // Act + Assert
    await expect(client.listSpaces()).rejects.toThrow('La fuente de una solicitud de espacio no cumple el contrato público.')
  })

  it('rejects a map query for an entry with no published street address', async () => {
    // Arrange
    const invalidPayload = structuredClone(payload)
    invalidPayload.locations[0].address = null as unknown as string
    invalidPayload.locations[0].mapQuery = 'Biblioteca municipal, Rondón'
    const client = createSpaceGuideClient(vi.fn().mockResolvedValue(jsonResponse(invalidPayload)))

    // Act + Assert
    await expect(client.listSpaces()).rejects.toThrow('Un espacio de la respuesta no cumple el contrato público.')
  })

  it('rejects impossible or future source dates', async () => {
    // Arrange
    const invalidPayload = structuredClone(payload)
    invalidPayload.locations[0].source.checkedAt = '2026-02-31'
    const client = createSpaceGuideClient(vi.fn().mockResolvedValue(jsonResponse(invalidPayload)))

    // Act + Assert
    await expect(client.listSpaces()).rejects.toThrow('La fuente de un espacio no cumple el contrato público.')
  })

  it('surfaces an HTTP error when the public catalog is temporarily unavailable', async () => {
    // Arrange
    const client = createSpaceGuideClient(vi.fn().mockResolvedValue(jsonResponse({}, 503)))

    // Act + Assert
    await expect(client.listSpaces()).rejects.toMatchObject<Partial<SpaceGuideApiError>>({
      name: 'SpaceGuideApiError',
      status: 503,
    })
  })
})
