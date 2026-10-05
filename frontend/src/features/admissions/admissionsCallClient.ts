import { AdmissionsCallApiError } from './admissionsCallContracts'
import type {
  AdmissionsCallAdmin,
  AdmissionsCallClient,
  AdmissionsCallContent,
  AdmissionsCallMilestone,
  AdmissionsCallRevision,
  AdmissionsMilestoneKind,
  AdmissionsSource,
  PublicAdmissionsCall,
} from './admissionsCallContracts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/
const MILESTONE_KINDS: readonly AdmissionsMilestoneKind[] = ['APPLICATION', 'SELECTION', 'ENROLLMENT']

export function createAdmissionsCallClient(fetcher: typeof fetch = fetch): AdmissionsCallClient {
  return {
    async getPublicCalls(signal) {
      const response = await fetcher('/api/v1/admissions/calls', requestOptions(signal))
      return parsePublicCalls(await responseBody(response))
    },

    async getAdminCalls(accessToken, signal) {
      const response = await fetcher('/api/v1/admin/admissions/calls', authorizedOptions(accessToken, signal))
      return parseAdminCalls(await responseBody(response))
    },

    async createCall(command, accessToken, signal) {
      const response = await fetcher('/api/v1/admin/admissions/calls', jsonRequest('POST', command, accessToken, signal))
      if (response.status !== 201) throw malformedResponse()
      return parseAdminCall(await responseBody(response))
    },

    async createRevision(callId, content, accessToken, signal) {
      const path = callPath(callId) + '/revisions'
      const response = await fetcher(path, jsonRequest('POST', { content }, accessToken, signal))
      if (response.status !== 201) throw malformedResponse()
      return parseRevision(await responseBody(response))
    },

    async updateDraft(callId, revisionId, expectedDraftVersion, content, accessToken, signal) {
      const path = revisionPath(callId, revisionId)
      const response = await fetcher(path,
        jsonRequest('PUT', { expectedDraftVersion, content }, accessToken, signal))
      return parseRevision(await responseBody(response))
    },

    async publish(callId, revisionId, command, accessToken, signal) {
      const path = revisionPath(callId, revisionId) + '/publish'
      const response = await fetcher(path, jsonRequest('POST', command, accessToken, signal))
      return parseRevision(await responseBody(response))
    },
  }
}

export const admissionsCallClient = createAdmissionsCallClient()

function requestOptions(signal?: AbortSignal): RequestInit {
  return { method: 'GET', cache: 'no-store', headers: new Headers({ Accept: 'application/json' }), signal }
}

function authorizedOptions(accessToken: string, signal?: AbortSignal): RequestInit {
  return { ...requestOptions(signal), headers: authorizedHeaders(accessToken) }
}

function authorizedHeaders(accessToken: string, includeJson = false): Headers {
  const token = accessToken.trim()
  if (token.length === 0) throw new TypeError('An in-memory access token is required.')
  const headers = new Headers({ Accept: 'application/json', Authorization: `Bearer ${token}` })
  if (includeJson) headers.set('Content-Type', 'application/json')
  return headers
}

function jsonRequest(method: 'POST' | 'PUT', body: unknown, accessToken: string, signal?: AbortSignal): RequestInit {
  return { method, cache: 'no-store', headers: authorizedHeaders(accessToken, true), body: JSON.stringify(body), signal }
}

async function responseBody(response: Response): Promise<unknown> {
  if (!response.ok) throw new AdmissionsCallApiError(response.status)
  try {
    return await response.json() as unknown
  } catch {
    throw malformedResponse()
  }
}

function parsePublicCalls(value: unknown): PublicAdmissionsCall[] {
  if (!Array.isArray(value) || value.length > 100) throw malformedResponse()
  return value.map((entry) => {
    if (!isRecord(entry) || !isUuid(entry.callId) || !isCallKey(entry.callKey) || !isUuid(entry.revisionId)
        || !isPositiveInteger(entry.revisionNumber) || !isNonEmptyText(entry.officialReference, 240)
        || !isInstant(entry.publishedAt)) throw malformedResponse()
    return {
      callId: entry.callId,
      callKey: entry.callKey,
      revisionId: entry.revisionId,
      revisionNumber: entry.revisionNumber,
      content: parseContent(entry.content),
      officialReference: entry.officialReference,
      publishedAt: entry.publishedAt,
    }
  })
}

function parseAdminCalls(value: unknown): AdmissionsCallAdmin[] {
  if (!Array.isArray(value) || value.length > 100) throw malformedResponse()
  return value.map(parseAdminCall)
}

function parseAdminCall(value: unknown): AdmissionsCallAdmin {
  if (!isRecord(value) || !isUuid(value.id) || !isCallKey(value.callKey)
      || !(value.currentPublishedRevisionId === null || isUuid(value.currentPublishedRevisionId))) {
    throw malformedResponse()
  }
  const latestRevision = parseRevision(value.latestRevision)
  const publishedRevision = value.publishedRevision === null ? null : parseRevision(value.publishedRevision)
  if ((publishedRevision === null) !== (value.currentPublishedRevisionId === null)) throw malformedResponse()
  if (publishedRevision && (publishedRevision.status !== 'PUBLISHED'
      || publishedRevision.id !== value.currentPublishedRevisionId)) throw malformedResponse()
  if (latestRevision.status === 'PUBLISHED' && latestRevision.id !== value.currentPublishedRevisionId) {
    throw malformedResponse()
  }
  if (latestRevision.revisionNumber < (publishedRevision?.revisionNumber ?? 0)) throw malformedResponse()
  return { id: value.id, callKey: value.callKey, currentPublishedRevisionId: value.currentPublishedRevisionId,
    latestRevision, publishedRevision }
}

function parseRevision(value: unknown): AdmissionsCallRevision {
  if (!isRecord(value) || !isUuid(value.id) || !isPositiveInteger(value.revisionNumber)
      || !isPositiveInteger(value.draftVersion) || (value.status !== 'DRAFT' && value.status !== 'PUBLISHED')
      || !(value.officialReference === null || isNonEmptyText(value.officialReference, 240))
      || !(value.publishedAt === null || isInstant(value.publishedAt))) throw malformedResponse()
  if ((value.status === 'PUBLISHED') !== (value.officialReference !== null && value.publishedAt !== null)) {
    throw malformedResponse()
  }
  return {
    id: value.id,
    revisionNumber: value.revisionNumber,
    draftVersion: value.draftVersion,
    status: value.status,
    content: parseContent(value.content),
    officialReference: value.officialReference,
    publishedAt: value.publishedAt,
  }
}

function parseContent(value: unknown): AdmissionsCallContent {
  if (!isRecord(value) || !isNonEmptyText(value.title, 160) || !isNonEmptyText(value.callName, 160)
      || !isLocalDate(value.updatedAt) || !isLocalDate(value.checkedAt) || value.updatedAt > value.checkedAt
      || !Array.isArray(value.milestones) || value.milestones.length > 50) throw malformedResponse()
  const milestones = value.milestones.map(parseMilestone)
  if (new Set(milestones.map((item) => item.key)).size !== milestones.length) throw malformedResponse()
  return {
    title: value.title,
    callName: value.callName,
    updatedAt: value.updatedAt,
    checkedAt: value.checkedAt,
    source: parseSource(value.source),
    confirmationSource: parseSource(value.confirmationSource),
    milestones,
  }
}

function parseSource(value: unknown): AdmissionsSource {
  if (!isRecord(value) || !isNonEmptyText(value.label, 120) || !isHttpsUrl(value.url)) throw malformedResponse()
  return { label: value.label, url: value.url }
}

function parseMilestone(value: unknown): AdmissionsCallMilestone {
  if (!isRecord(value) || !isNonEmptyText(value.key, 64) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.key)
      || !MILESTONE_KINDS.includes(value.kind as AdmissionsMilestoneKind)
      || !isLocalDate(value.startsOn) || !isLocalDate(value.endsOn) || value.endsOn < value.startsOn
      || !isNonEmptyText(value.title, 160) || !isNonEmptyText(value.description, 500)) throw malformedResponse()
  return {
    key: value.key,
    kind: value.kind as AdmissionsMilestoneKind,
    startsOn: value.startsOn,
    endsOn: value.endsOn,
    title: value.title,
    description: value.description,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

function isCallKey(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function isNonEmptyText(value: unknown, maximumLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maximumLength
    && !hasControlCharacters(value)
}

function hasControlCharacters(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0)
    if (codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f)) return true
  }
  return false
}

function isLocalDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 0))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === (month ?? 0) - 1
    && parsed.getUTCDate() === day
}

function isInstant(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 500) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname.length > 0 && !url.username && !url.password
      && (!url.port || Number(url.port) <= 443)
  } catch {
    return false
  }
}

function callPath(callId: string): string {
  if (!isUuid(callId)) throw new TypeError('A valid admissions call identifier is required.')
  return `/api/v1/admin/admissions/calls/${encodeURIComponent(callId)}`
}

function revisionPath(callId: string, revisionId: string): string {
  if (!isUuid(revisionId)) throw new TypeError('A valid admissions revision identifier is required.')
  return `${callPath(callId)}/revisions/${encodeURIComponent(revisionId)}`
}

function malformedResponse(): TypeError {
  return new TypeError('La respuesta de admisiones tiene un formato inválido.')
}
