import type {
  IdentityDirectoryEntry,
  RoleAccessClient,
  RoleAccessPermission,
  RoleAssignment,
  RoleAssignmentStatus,
  RoleProfile,
  RoleProfileKey,
  RoleScopeKind,
  StoredRoleScope,
} from './roleAccessContracts'
import { ROLE_PROFILE_KEYS, ROLE_SCOPE_KINDS } from './roleAccessContracts'
import { containsAsciiControlCharacters } from '../../shared/inputValidation'

const ROLE_KEYS = new Set<string>(ROLE_PROFILE_KEYS)
const SCOPE_KINDS = new Set<string>(ROLE_SCOPE_KINDS)
const ROLE_PERMISSIONS = new Set<string>(['identity:roles:read', 'identity:roles:write'])
const NON_ASSIGNABLE_PROFILES = new Set<RoleProfileKey>(['APPLICANT', 'ADMITTED', 'STUDENT'])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export class RoleAccessApiError extends Error {
  readonly status: number

  constructor(status: number, message = `Role access request failed with status ${status}.`) {
    super(message)
    this.name = 'RoleAccessApiError'
    this.status = status
  }
}

export function createRoleAccessClient(fetcher: typeof fetch = fetch): RoleAccessClient {
  return {
    async roleProfiles(accessToken, signal) {
      const response = await fetcher('/api/v1/admin/access/role-profiles', authorizedOptions(accessToken, signal))
      return parseRoleProfiles(await responseBody(response))
    },

    async searchIdentities(subjectPrefix, limit, accessToken, signal) {
      const query = new URLSearchParams({ subjectPrefix, limit: String(limit) })
      const response = await fetcher(`/api/v1/admin/access/identities?${query}`, authorizedOptions(accessToken, signal))
      return parseIdentityDirectory(await responseBody(response), subjectPrefix)
    },

    async assignments(userId, accessToken, signal) {
      if (!isUuid(userId)) throw malformedResponse()
      const query = new URLSearchParams({ userId })
      const response = await fetcher(`/api/v1/admin/access/assignments?${query}`, authorizedOptions(accessToken, signal))
      return parseAssignments(await responseBody(response), userId)
    },

    async assign(command, accessToken, signal) {
      if (!isUuid(command.targetUserId)) throw malformedResponse()
      const response = await fetcher('/api/v1/admin/access/assignments', jsonOptions('POST', command, accessToken, signal))
      const result = parseRoleAssignment(await responseBody(response))
      if (result.targetUserId.toLowerCase() !== command.targetUserId.toLowerCase()
        || result.profileKey !== command.profileKey) {
        throw malformedResponse()
      }
      return result
    },

    async revoke(assignmentId, command, accessToken, signal) {
      if (!isUuid(assignmentId)) throw malformedResponse()
      const response = await fetcher(
        `/api/v1/admin/access/assignments/${encodeURIComponent(assignmentId)}/revoke`,
        jsonOptions('PATCH', command, accessToken, signal),
      )
      const result = parseRoleAssignment(await responseBody(response))
      if (result.assignmentId.toLowerCase() !== assignmentId.toLowerCase() || result.status !== 'REVOKED') {
        throw malformedResponse()
      }
      return result
    },
  }
}

function parseRoleProfiles(value: unknown): RoleProfile[] {
  if (!Array.isArray(value) || value.length !== ROLE_PROFILE_KEYS.length) throw malformedResponse()
  const profiles = value.map(parseRoleProfile)
  const keys = new Set(profiles.map((profile) => profile.key))
  if (keys.size !== ROLE_PROFILE_KEYS.length || ROLE_PROFILE_KEYS.some((key) => !keys.has(key))) throw malformedResponse()
  return profiles
}

function parseRoleProfile(value: unknown): RoleProfile {
  if (!isRecord(value) || typeof value.key !== 'string' || !ROLE_KEYS.has(value.key)
    || typeof value.displayName !== 'string' || !isSafeLabel(value.displayName, 100)
    || typeof value.manuallyAssignable !== 'boolean'
    || value.manuallyAssignable !== !NON_ASSIGNABLE_PROFILES.has(value.key as RoleProfileKey)
    || !Array.isArray(value.allowedScopeKinds) || !Array.isArray(value.permissions)) {
    throw malformedResponse()
  }
  const scopes = value.allowedScopeKinds.map(parseScopeKind)
  const permissions = value.permissions.map(parseRolePermission)
  if (new Set(scopes).size !== scopes.length || new Set(permissions).size !== permissions.length) throw malformedResponse()
  const expectedScopes = NON_ASSIGNABLE_PROFILES.has(value.key as RoleProfileKey)
    ? []
    : value.key === 'ADMINISTRATOR'
      ? ['UNIVERSITY']
      : [...ROLE_SCOPE_KINDS]
  const expectedPermissions = value.key === 'ADMINISTRATOR'
    ? ['identity:roles:read', 'identity:roles:write']
    : []
  if (!sameValues(scopes, expectedScopes) || !sameValues(permissions, expectedPermissions)) throw malformedResponse()
  return {
    key: value.key as RoleProfileKey,
    displayName: value.displayName,
    manuallyAssignable: value.manuallyAssignable,
    allowedScopeKinds: scopes,
    permissions,
  }
}

function parseIdentityDirectory(value: unknown, prefix: string): IdentityDirectoryEntry[] {
  if (!Array.isArray(value)) throw malformedResponse()
  const seenUsers = new Set<string>()
  const identities: IdentityDirectoryEntry[] = []
  for (const entry of value) {
    if (!isRecord(entry) || !isUuid(entry.userId) || !isIssuer(entry.issuer)
      || !isSubject(entry.subject) || !entry.subject.startsWith(prefix)) {
      throw malformedResponse()
    }
    const key = entry.userId.toLowerCase()
    if (seenUsers.has(key)) continue
    seenUsers.add(key)
    identities.push({ userId: entry.userId, issuer: entry.issuer, subject: entry.subject })
  }
  return identities
}

function parseAssignments(value: unknown, targetUserId: string): RoleAssignment[] {
  if (!Array.isArray(value)) throw malformedResponse()
  return value.map((assignment) => {
    const parsed = parseRoleAssignment(assignment)
    if (parsed.targetUserId.toLowerCase() !== targetUserId.toLowerCase()) throw malformedResponse()
    return parsed
  })
}

function parseRoleAssignment(value: unknown): RoleAssignment {
  if (!isRecord(value) || !isUuid(value.assignmentId) || !isUuid(value.targetUserId)
    || typeof value.profileKey !== 'string' || !ROLE_KEYS.has(value.profileKey)
    || !Array.isArray(value.scopes) || value.scopes.length === 0
    || !isRoleAssignmentStatus(value.status) || !isIsoDate(value.validFrom)
    || !(value.validThrough === null || isIsoDate(value.validThrough))
    || (typeof value.validThrough === 'string' && value.validThrough < value.validFrom)
    || !isSafeLabel(value.sourceReference, 512) || !isInstant(value.createdAt)
    || typeof value.version !== 'number' || !Number.isSafeInteger(value.version) || value.version < 1) {
    throw malformedResponse()
  }
  const scopes = value.scopes.map(parseStoredScope)
  const scopeKinds = new Set(scopes.map((scope) => scope.kind))
  if (scopeKinds.size !== scopes.length) throw malformedResponse()
  return {
    assignmentId: value.assignmentId,
    targetUserId: value.targetUserId,
    profileKey: value.profileKey as RoleProfileKey,
    scopes,
    status: value.status,
    validFrom: value.validFrom,
    validThrough: value.validThrough,
    sourceReference: value.sourceReference,
    createdAt: value.createdAt,
    version: value.version,
  }
}

function parseStoredScope(value: unknown): StoredRoleScope {
  if (!isRecord(value) || typeof value.kind !== 'string') throw malformedResponse()
  const kind = parseScopeKind(value.kind)
  const stableReference = value.stableReference
  if (kind === 'UNIVERSITY') {
    if (stableReference !== null) throw malformedResponse()
  } else if (!isSafeLabel(stableReference, 256) || stableReference.trim() !== stableReference) {
    throw malformedResponse()
  }
  return { kind, stableReference: stableReference as string | null }
}

function authorizedOptions(accessToken: string, signal?: AbortSignal): RequestInit {
  return {
    credentials: 'omit',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${requireAccessToken(accessToken)}`,
      'Accept-Language': 'es-CO',
    },
    signal,
  }
}

function jsonOptions(method: 'POST' | 'PATCH', body: unknown, accessToken: string, signal?: AbortSignal): RequestInit {
  const authorized = authorizedOptions(accessToken, signal)
  return {
    ...authorized,
    method,
    headers: {
      ...authorized.headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }
}

function requireAccessToken(accessToken: string): string {
  if (typeof accessToken !== 'string' || !accessToken.trim() || accessToken.trim() !== accessToken) {
    throw new Error('Institutional authentication is required.')
  }
  return accessToken
}

async function responseBody(response: Response): Promise<unknown> {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    if (response.ok) throw malformedResponse()
  }
  if (!response.ok) {
    const message = isRecord(body) && typeof body.message === 'string' ? body.message : undefined
    throw new RoleAccessApiError(response.status, message)
  }
  return body
}

function parseScopeKind(value: unknown): RoleScopeKind {
  if (typeof value !== 'string' || !SCOPE_KINDS.has(value)) throw malformedResponse()
  return value as RoleScopeKind
}

function parseRolePermission(value: unknown): RoleAccessPermission {
  if (typeof value !== 'string' || !ROLE_PERMISSIONS.has(value)) throw malformedResponse()
  return value as RoleAccessPermission
}

function isIssuer(value: unknown): value is string {
  if (!isSafeLabel(value, 2048)) return false
  try {
    const issuer = new URL(value)
    return issuer.protocol === 'https:' && issuer.hostname.length > 0 && !issuer.username && !issuer.password
      && !issuer.search && !issuer.hash
  } catch {
    return false
  }
}

function isSubject(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 255
    && value.trim().length > 0 && /^[\x20-\x7e]+$/.test(value)
}

function isSafeLabel(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength
    && value.trim() === value && !containsAsciiControlCharacters(value)
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
}

function isInstant(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value)
    && Number.isFinite(Date.parse(value))
}

function isRoleAssignmentStatus(value: unknown): value is RoleAssignmentStatus {
  return value === 'ACTIVE' || value === 'REVOKED'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sameValues(actual: string[], expected: string[]): boolean {
  return actual.length === expected.length && actual.every((value) => expected.includes(value))
}

function malformedResponse(): Error {
  return new Error('The role access response is malformed.')
}

export const roleAccessClient = createRoleAccessClient()
