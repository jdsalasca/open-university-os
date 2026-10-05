import { describe, expect, it, vi } from 'vitest'
import { createNoticesAdminClient } from './noticesAdminClient'
import type { PublishNoticeInput } from './noticesAdminContracts'

function fakeFetcher(payload: unknown) {
  return vi.fn(async () => ({ ok: true, status: 201, json: async () => payload }) as unknown as Response)
}

const INPUT: PublishNoticeInput = {
  title: 'Matrícula 2027-I',
  body: 'La matrícula abre el 12 de enero.',
  sourceReference: 'Resolución 111 de 2026',
  publishedFrom: '2026-10-01',
  publishedThrough: '2026-12-31',
  audiences: [{ kind: 'UNIVERSITY', reference: null }],
}

describe('noticesAdminClient', () => {
  it('lists the administered notices with the session bearer', async () => {
    // Arrange
    const fetcher = fakeFetcher({ notices: [{ noticeId: 'n-1' }] })
    const client = createNoticesAdminClient(fetcher)

    // Act
    const notices = await client.getRecent('token')

    // Assert
    expect(notices).toEqual([{ noticeId: 'n-1' }])
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/admin/notices?limit=100'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token' }) }),
    )
  })

  it('publishes a notice with its institutional reference and audiences', async () => {
    // Arrange
    const fetcher = fakeFetcher({ noticeId: 'n-2' })
    const client = createNoticesAdminClient(fetcher)

    // Act
    await client.publish(INPUT, 'token')

    // Assert
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/admin/notices'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(INPUT),
      }),
    )
  })
})
