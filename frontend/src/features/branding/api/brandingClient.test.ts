import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPublicBranding } from './brandingClient'

afterEach(() => vi.unstubAllGlobals())

describe('getPublicBranding', () => {
  it('requests the versioned public branding contract', async () => {
    // Arrange
    const payload = {
      revision: 1,
      institutionName: 'Universidad UPTC',
      colors: { primary: '#FFCC29', ink: '#1A1A1A', surface: '#FFFFFF', text: '#1A1A1A', accent: '#FFCC29', focus: '#1A1A1A' },
      assets: { logoLight: null, logoDark: null, favicon: null },
      modules: [],
      banners: [],
    }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    // Act
    const result = await getPublicBranding()

    // Assert
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/branding', expect.objectContaining({ headers: { Accept: 'application/json' } }))
    expect(result.revision).toBe(1)
    expect(result.colors.primary).toBe('#FFCC29')
  })

  it('rejects an unsuccessful response instead of trusting an error body as branding', async () => {
    // Arrange
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"message":"offline"}', { status: 503 })))

    // Act + Assert
    await expect(getPublicBranding()).rejects.toThrow('Branding request failed with status 503')
  })
})
