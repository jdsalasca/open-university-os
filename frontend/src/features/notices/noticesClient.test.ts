import { describe, expect, it, vi } from 'vitest'
import { createNoticesClient } from './noticesClient'

function fakeFetcher(payload: unknown) {
  return vi.fn(async () => ({ ok: true, status: 200, json: async () => payload }) as unknown as Response)
}

describe('noticesClient', () => {
  it('reads my notices with the session bearer and unwraps the notices list', async () => {
    // Arrange
    const fetcher = fakeFetcher({ notices: [{ noticeId: 'n-1' }] })
    const client = createNoticesClient(fetcher)

    // Act
    const notices = await client.getMyNotices('token')

    // Assert
    expect(notices).toEqual([{ noticeId: 'n-1' }])
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/notices?limit=100'),
      expect.objectContaining({
        credentials: 'omit',
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      }),
    )
  })

  it('treats a missing notices list as empty instead of breaking the page', async () => {
    // Arrange
    const client = createNoticesClient(fakeFetcher({}))

    // Act + Assert
    expect(await client.getMyNotices('token')).toEqual([])
  })
})
