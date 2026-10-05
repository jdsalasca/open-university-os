import snapshot from './uptcPostgraduateCatalog.snapshot.json'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchPublicPostgraduateCatalog,
  parsePublicPostgraduateCatalog,
} from './publicPostgraduateCatalogClient'
import type { PublicPostgraduateCatalogSnapshot } from './publicPostgraduateCatalog'

afterEach(() => vi.unstubAllGlobals())

describe('publicPostgraduateCatalogClient', () => {
  it('loads and validates the attributed same-origin snapshot', async () => {
    // Arrange
    const fetchMock = vi.fn<typeof fetch>(async () => ({ ok: true, json: async () => snapshot }) as Response)
    vi.stubGlobal('fetch', fetchMock)

    // Act
    const result = await fetchPublicPostgraduateCatalog()

    // Assert
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0]?.[0]).toEqual(expect.stringMatching(/uptcPostgraduateCatalog\.snapshot\.json/))
    expect(result.programs).toHaveLength(139)
    expect(result.source.pageUpdatedAt).toBe('2026-08-03')
    expect(result.source.capturedAt).toBe('2026-10-04')
  })

  it('reports the HTTP error when the static asset cannot be loaded', async () => {
    // Arrange
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 }) as Response))

    // Act
    const request = fetchPublicPostgraduateCatalog()

    // Assert
    await expect(request).rejects.toThrow(/HTTP 503/)
  })

  it('rejects duplicate program codes and links outside the official UPTC host', () => {
    // Arrange
    const duplicate = structuredClone(snapshot) as PublicPostgraduateCatalogSnapshot
    duplicate.programs[1] = { ...duplicate.programs[1]!, programCode: duplicate.programs[0]!.programCode }
    const foreignLink = structuredClone(snapshot) as PublicPostgraduateCatalogSnapshot
    foreignLink.programs[0]!.detailUrl = 'https://example.com/program'

    // Act and Assert
    expect(() => parsePublicPostgraduateCatalog(duplicate)).toThrow(/código de programa duplicado/i)
    expect(() => parsePublicPostgraduateCatalog(foreignLink)).toThrow(/enlace oficial/i)
  })

  it('rejects impossible dates and empty snapshots', () => {
    // Arrange
    const impossibleDate = structuredClone(snapshot) as PublicPostgraduateCatalogSnapshot
    impossibleDate.source.pageUpdatedAt = '2026-02-30'
    const empty = structuredClone(snapshot) as PublicPostgraduateCatalogSnapshot
    empty.programs = []

    // Act and Assert
    expect(() => parsePublicPostgraduateCatalog(impossibleDate)).toThrow(/fecha o lista inválida/i)
    expect(() => parsePublicPostgraduateCatalog(empty)).toThrow(/fecha o lista inválida/i)
  })
})
