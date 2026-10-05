import { APPLICATION_PERMISSIONS } from './identityContracts'
import type { ApplicationPermission, CurrentIdentity, IdentityClient } from './identityContracts'
import { containsAsciiControlCharacters } from '../../shared/inputValidation'

const ALLOWED_PERMISSIONS = new Set<string>(APPLICATION_PERMISSIONS)
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export class IdentityApiError extends Error {
  readonly status: number

  constructor(status: number, message = `Identity request failed with status ${status}.`) {
    super(message)
    this.name = 'IdentityApiError'
    this.status = status
  }
}

export function createIdentityClient(fetcher: typeof fetch = fetch): IdentityClient {
  return {
    async current(accessToken, signal) {
      const token = accessToken.trim()
      if (!token) throw new Error('Institutional authentication is required.')

      const response = await fetcher('/api/v1/me', {
        credentials: 'omit',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        signal,
      })
      if (!response.ok) throw new IdentityApiError(response.status)

      let payload: unknown
      try {
        payload = await response.json()
      } catch {
        throw malformedIdentity()
      }
      return parseCurrentIdentity(payload)
    },
  }
}

export function parseCurrentIdentity(value: unknown): CurrentIdentity {
  if (!isRecord(value)
    || !isUuid(value.userId)
    || !isBoundedSubject(value.subject)
    || !Array.isArray(value.permissions)) {
    throw malformedIdentity()
  }

  const rejected = value.permissions.find(
    (permission) => typeof permission !== 'string' || !ALLOWED_PERMISSIONS.has(permission))
  if (rejected !== undefined) {
    throw malformedIdentity(describePermission(rejected))
  }
  if (new Set(value.permissions).size !== value.permissions.length) {
    throw malformedIdentity('duplicate permissions')
  }

  return {
    userId: value.userId,
    subject: value.subject,
    permissions: value.permissions as ApplicationPermission[],
  }
}

/** The value comes from the server, so it is only echoed back when it is short and printable. */
function describePermission(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 60
    || containsAsciiControlCharacters(value)) {
    return 'unknown permission'
  }
  return `unknown permission "${value}"`
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

export const identityClient = createIdentityClient()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isBoundedSubject(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 255
    && value.trim() === value
    && !containsAsciiControlCharacters(value)
}

function malformedIdentity(detail?: string): Error {
  return new Error(`The current identity response is malformed.${detail ? ` (${detail})` : ''}`)
}
