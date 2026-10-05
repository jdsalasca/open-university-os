import { describe, expect, it, vi } from 'vitest'

const clientModules = import.meta.glob<typeof import('./identityClient')>('./identityClient.ts')

async function loadClient() {
  const loader = clientModules['./identityClient.ts']
  expect(loader, 'the typed identity client is implemented').toBeTypeOf('function')
  return loader!()
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('identity client', () => {
  it('requests current permissions with the bearer token and validates the response', async () => {
    // Arrange
    const { createIdentityClient } = await loadClient()
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({
      userId: '7b717347-ae70-4a76-9a1d-01b9f178c0d2',
      subject: 'subject-42',
      permissions: ['branding:read', 'academic:period:write'],
    }))
    const client = createIdentityClient(fetcher)
    const signal = new AbortController().signal

    // Act
    const result = await client.current('synthetic-access-token', signal)

    // Assert
    expect(result).toEqual({
      userId: '7b717347-ae70-4a76-9a1d-01b9f178c0d2',
      subject: 'subject-42',
      permissions: ['branding:read', 'academic:period:write'],
    })
    expect(fetcher).toHaveBeenCalledWith('/api/v1/me', {
      credentials: 'omit',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer synthetic-access-token',
      },
      signal,
    })
  })

  it.each([401, 403, 503])('rejects an HTTP %i response without trusting its body', async (status) => {
    // Arrange
    const { createIdentityClient } = await loadClient()
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ subject: 'forged', permissions: ['branding:write'] }, status))
    const client = createIdentityClient(fetcher)

    // Act + Assert
    await expect(client.current('synthetic-access-token')).rejects.toMatchObject({ status })
  })

  it('rejects malformed identity payloads and permissions outside the backend contract', async () => {
    // Arrange
    const { createIdentityClient } = await loadClient()
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ subject: '', permissions: [] }))
      .mockResolvedValueOnce(jsonResponse({ subject: 'subject-42', permissions: ['academic:student:admin'] }))
      .mockResolvedValueOnce(jsonResponse({ userId: 'not-a-uuid', subject: 'subject-42', permissions: [] }))
    const client = createIdentityClient(fetcher)

    // Act + Assert
    await expect(client.current('synthetic-access-token')).rejects.toThrow(/malformed/i)
    await expect(client.current('synthetic-access-token')).rejects.toThrow(/malformed/i)
    await expect(client.current('synthetic-access-token')).rejects.toThrow(/malformed/i)
  })

  it('does not send an empty bearer token', async () => {
    // Arrange
    const { createIdentityClient } = await loadClient()
    const fetcher = vi.fn()
    const client = createIdentityClient(fetcher)

    // Act + Assert
    await expect(client.current('  ')).rejects.toThrow(/authentication is required/i)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('passes cancellation through to the browser request', async () => {
    // Arrange
    const { createIdentityClient } = await loadClient()
    const fetcher = vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError'))
    const client = createIdentityClient(fetcher)
    const controller = new AbortController()
    controller.abort()

    // Act + Assert
    await expect(client.current('synthetic-access-token', controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetcher).toHaveBeenCalledWith('/api/v1/me', expect.objectContaining({ signal: controller.signal }))
  })
})
