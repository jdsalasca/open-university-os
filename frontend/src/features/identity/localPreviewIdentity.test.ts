import { describe, expect, it, vi } from 'vitest'
import type { IdentityClient } from './identityContracts'
import type { LocalPreviewSessionClient } from './localPreviewSessionClient'
import { createLocalPreviewIdentity } from './localPreviewIdentity'

describe('createLocalPreviewIdentity', () => {
  it('loads permissions from the current identity endpoint and returns a local preview session', async () => {
    // Arrange
    const sessionClient: LocalPreviewSessionClient = {
      create: vi.fn().mockResolvedValue({ accessToken: 'opaque-local-token', expiresAt: Math.floor(Date.now() / 1000) + 300 }),
      revoke: vi.fn(),
    }
    const identityClient: IdentityClient = {
      current: vi.fn().mockResolvedValue({ subject: 'local-preview-developer', permissions: ['academic:structure:read'] }),
    }
    const controller = new AbortController()

    // Act
    const session = await createLocalPreviewIdentity(sessionClient, identityClient, controller.signal)

    // Assert
    expect(identityClient.current).toHaveBeenCalledWith('opaque-local-token', controller.signal)
    expect(session).toMatchObject({
      accessToken: 'opaque-local-token',
      state: { status: 'authenticated', subject: 'local-preview-developer', permissions: ['academic:structure:read'], sessionType: 'local-preview' },
    })
    expect(sessionClient.revoke).not.toHaveBeenCalled()
  })

  it('revokes an issued token when identity lookup fails', async () => {
    // Arrange
    const sessionClient: LocalPreviewSessionClient = {
      create: vi.fn().mockResolvedValue({ accessToken: 'opaque-local-token', expiresAt: Math.floor(Date.now() / 1000) + 300 }),
      revoke: vi.fn().mockResolvedValue(undefined),
    }
    const identityClient: IdentityClient = { current: vi.fn().mockRejectedValue(new Error('identity unavailable')) }

    // Act
    const attempt = createLocalPreviewIdentity(sessionClient, identityClient, new AbortController().signal)

    // Assert
    await expect(attempt).rejects.toThrow('identity unavailable')
    expect(sessionClient.revoke).toHaveBeenCalledWith('opaque-local-token')
  })

  it('revokes an already-expired session without requesting the current identity', async () => {
    // Arrange
    const sessionClient: LocalPreviewSessionClient = {
      create: vi.fn().mockResolvedValue({ accessToken: 'expired-local-token', expiresAt: Math.floor(Date.now() / 1000) - 1 }),
      revoke: vi.fn().mockResolvedValue(undefined),
    }
    const identityClient: IdentityClient = { current: vi.fn() }

    // Act
    const attempt = createLocalPreviewIdentity(sessionClient, identityClient, new AbortController().signal)

    // Assert
    await expect(attempt).rejects.toThrow('The local preview session has expired.')
    expect(identityClient.current).not.toHaveBeenCalled()
    expect(sessionClient.revoke).toHaveBeenCalledWith('expired-local-token')
  })
})
