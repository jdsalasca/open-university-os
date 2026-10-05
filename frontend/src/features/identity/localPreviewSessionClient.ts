import { containsAsciiControlCharacters } from '../../shared/inputValidation'

export interface LocalPreviewSession {
  accessToken: string
  expiresAt: number
}

export interface LocalPreviewSessionClient {
  create(signal?: AbortSignal): Promise<LocalPreviewSession>
  revoke(accessToken: string, signal?: AbortSignal): Promise<void>
}

const SESSION_ENDPOINT = '/api/v1/dev/local-preview-session'
const OPAQUE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

export class LocalPreviewSessionApiError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`Local preview session request failed with status ${status}.`)
    this.name = 'LocalPreviewSessionApiError'
    this.status = status
  }
}

export function createLocalPreviewSessionClient(fetcher: typeof fetch = fetch): LocalPreviewSessionClient {
  return {
    async create(signal) {
      const response = await fetcher(SESSION_ENDPOINT, {
        method: 'POST',
        credentials: 'omit',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal,
      })
      if (!response.ok) throw new LocalPreviewSessionApiError(response.status)

      let payload: unknown
      try {
        payload = await response.json()
      } catch {
        throw malformedSession()
      }
      if (!isRecord(payload)
        || typeof payload.accessToken !== 'string'
        || !OPAQUE_TOKEN_PATTERN.test(payload.accessToken)
        || containsAsciiControlCharacters(payload.accessToken)
        || !Number.isSafeInteger(payload.expiresAt)
        || (payload.expiresAt as number) <= Math.floor(Date.now() / 1000)) {
        throw malformedSession()
      }
      return { accessToken: payload.accessToken, expiresAt: payload.expiresAt as number }
    },

    async revoke(accessToken, signal) {
      const token = accessToken.trim()
      if (!OPAQUE_TOKEN_PATTERN.test(token) || containsAsciiControlCharacters(token)) {
        throw malformedSession()
      }
      const response = await fetcher(SESSION_ENDPOINT, {
        method: 'DELETE',
        credentials: 'omit',
        cache: 'no-store',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        signal,
      })
      if (!response.ok) throw new LocalPreviewSessionApiError(response.status)
    },
  }
}

export const localPreviewSessionClient = createLocalPreviewSessionClient()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function malformedSession(): Error {
  return new Error('The local preview session response is malformed or expired.')
}
