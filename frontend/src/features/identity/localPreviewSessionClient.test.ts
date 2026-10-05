import { describe, expect, it, vi } from 'vitest'
import { createLocalPreviewSessionClient } from './localPreviewSessionClient'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const accessToken = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

describe('local preview session client', () => {
  it('requests an ephemeral session without cookies and validates its short-lived token', async () => {
    // Arrange
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({
      accessToken,
      expiresAt: Math.floor(Date.now() / 1000) + 60,
    }))
    const client = createLocalPreviewSessionClient(fetcher)
    const controller = new AbortController()

    // Act
    const session = await client.create(controller.signal)

    // Assert
    expect(session).toEqual({ accessToken, expiresAt: expect.any(Number) })
    expect(fetcher).toHaveBeenCalledWith('/api/v1/dev/local-preview-session', {
      method: 'POST',
      credentials: 'omit',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
  })

  it('rejects malformed, expired, or unsuccessful session responses', async () => {
    // Arrange
    const fetcher = vi.fn()
    const client = createLocalPreviewSessionClient(fetcher)

    // Act + Assert
    fetcher.mockResolvedValueOnce(jsonResponse({ accessToken: 'short', expiresAt: Date.now() / 1000 + 60 }))
    await expect(client.create()).rejects.toThrow(/malformed/i)
    fetcher.mockResolvedValueOnce(jsonResponse({ accessToken, expiresAt: 1 }))
    await expect(client.create()).rejects.toThrow(/malformed|expired/i)
    fetcher.mockResolvedValueOnce(jsonResponse({}, 401))
    await expect(client.create()).rejects.toThrow(/401/)
  })

  it('revokes the bearer using an authorization header and no browser credentials', async () => {
    // Arrange
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    const client = createLocalPreviewSessionClient(fetcher)
    const controller = new AbortController()

    // Act
    await client.revoke(accessToken, controller.signal)

    // Assert
    expect(fetcher).toHaveBeenCalledWith('/api/v1/dev/local-preview-session', {
      method: 'DELETE',
      credentials: 'omit',
      cache: 'no-store',
      headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    })
  })
})
