import type { VisibleNotice } from './noticesContracts'

export interface NoticesClient {
  getMyNotices(accessToken: string, signal?: AbortSignal): Promise<VisibleNotice[]>
}

export class NoticesApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'NoticesApiError'
    this.status = status
  }
}

const MAX_PAGE_SIZE = 100

export function createNoticesClient(fetcher: typeof fetch = fetch): NoticesClient {
  return {
    async getMyNotices(accessToken, signal) {
      const response = await fetcher(`/api/v1/notices?limit=${MAX_PAGE_SIZE}`, {
        credentials: 'omit',
        headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
        ...(signal ? { signal } : {}),
      })
      if (!response.ok) {
        throw new NoticesApiError(response.status, 'No fue posible consultar los avisos.')
      }
      const payload = (await response.json()) as { notices?: VisibleNotice[] }
      return payload.notices ?? []
    },
  }
}

export const noticesClient = createNoticesClient()
