import snapshot from './uptcUndergraduateCatalog.snapshot.json'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchPublicUndergraduateCatalog,
  parsePublicUndergraduateCatalog,
} from './publicUndergraduateCatalogClient'
import type { PublicUndergraduateCatalogSnapshot } from './publicUndergraduateCatalog'

afterEach(() => vi.unstubAllGlobals())

describe('publicUndergraduateCatalogClient', () => {
  it('fetches the same-origin static snapshot and validates the official records', async () => {
    // Arrange
    const controller = new AbortController()
    const fetchMock = vi.fn<typeof fetch>(async (_input, _init) => ({ ok: true, json: async () => snapshot }) as Response)
    vi.stubGlobal('fetch', fetchMock)

    // Act
    const result = await fetchPublicUndergraduateCatalog(controller.signal)

    // Assert
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0]?.[0]).toEqual(expect.stringMatching(/uptcUndergraduateCatalog\.snapshot\.json/))
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      signal: controller.signal,
      cache: 'force-cache',
      headers: { Accept: 'application/json' },
    }))
    expect(result.programs).toHaveLength(79)
    expect(result.programs.filter((program) => program.markedOffered)).toHaveLength(72)
  })

  it('rejects a static resource response that is not successful', async () => {
    // Arrange
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 }) as Response))

    // Act
    const request = fetchPublicUndergraduateCatalog()

    // Assert
    await expect(request).rejects.toThrow(/HTTP 503/)
  })

  it('rejects duplicate identities or program detail links outside the official UPTC host', () => {
    // Arrange
    const duplicate = structuredClone(snapshot) as PublicUndergraduateCatalogSnapshot
    duplicate.programs[1] = { ...duplicate.programs[1]!, id: duplicate.programs[0]!.id }
    const foreignLink = structuredClone(snapshot) as PublicUndergraduateCatalogSnapshot
    foreignLink.programs[0]!.detailUrl = 'https://example.com/program'

    // Act and Assert
    expect(() => parsePublicUndergraduateCatalog(duplicate)).toThrow(/identificador de programa duplicado/i)
    expect(() => parsePublicUndergraduateCatalog(foreignLink)).toThrow(/enlace oficial/i)
  })

  it('rejects calendar-impossible dates while accepting leap days', () => {
    // Arrange
    const impossibleDate = structuredClone(snapshot) as PublicUndergraduateCatalogSnapshot
    impossibleDate.source.capturedAt = '2026-02-30'
    const leapDay = structuredClone(snapshot) as PublicUndergraduateCatalogSnapshot
    leapDay.source.capturedAt = '2024-02-29'

    // Act and Assert
    expect(() => parsePublicUndergraduateCatalog(impossibleDate)).toThrow(/fecha o lista inválida/i)
    expect(() => parsePublicUndergraduateCatalog(leapDay)).not.toThrow()
  })
})
