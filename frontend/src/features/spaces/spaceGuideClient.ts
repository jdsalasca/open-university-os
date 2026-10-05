import type { SpaceDirectorySnapshot } from './spaceGuideContracts'
import { parseSpaceDirectorySnapshot } from './spaceGuideContracts'

export interface SpaceGuideClient {
  listSpaces(signal?: AbortSignal): Promise<SpaceDirectorySnapshot>
}

export class SpaceGuideApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'SpaceGuideApiError'
    this.status = status
  }
}

export function createSpaceGuideClient(fetcher: typeof fetch = fetch): SpaceGuideClient {
  return {
    async listSpaces(signal) {
      const response = await fetcher('/api/v1/spaces', {
        credentials: 'omit',
        headers: { Accept: 'application/json' },
        ...(signal ? { signal } : {}),
      })
      if (!response.ok) {
        throw new SpaceGuideApiError(response.status, 'No fue posible cargar la guía de espacios.')
      }
      return parseSpaceDirectorySnapshot(await response.json())
    },
  }
}

export const spaceGuideClient = createSpaceGuideClient()
