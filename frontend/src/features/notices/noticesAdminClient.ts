import type { AdminNotice, PublishNoticeInput } from './noticesAdminContracts'

export interface NoticesAdminClient {
  getRecent(accessToken: string, signal?: AbortSignal): Promise<AdminNotice[]>
  publish(input: PublishNoticeInput, accessToken: string): Promise<AdminNotice>
}

export class NoticesAdminApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'NoticesAdminApiError'
    this.status = status
  }
}

const BASE = '/api/v1/admin/notices'
const MAX_PAGE_SIZE = 100

export function createNoticesAdminClient(fetcher: typeof fetch = fetch): NoticesAdminClient {
  async function request<T>(path: string, accessToken: string, init: RequestInit = {}): Promise<T> {
    const response = await fetcher(path, {
      ...init,
      credentials: 'omit',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    })
    if (!response.ok) {
      throw new NoticesAdminApiError(response.status, 'No fue posible completar la operación de avisos.')
    }
    return (await response.json()) as T
  }

  return {
    async getRecent(accessToken, signal) {
      const payload = await request<{ notices?: AdminNotice[] }>(`${BASE}?limit=${MAX_PAGE_SIZE}`, accessToken,
        { ...(signal ? { signal } : {}) })
      return payload.notices ?? []
    },
    publish: (input, accessToken) =>
      request<AdminNotice>(BASE, accessToken, { method: 'POST', body: JSON.stringify(input) }),
  }
}

export const noticesAdminClient = createNoticesAdminClient()
