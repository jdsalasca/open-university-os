import { containsAsciiControlCharacters } from '../../shared/inputValidation'
import type {
  AcademicOfferingDraft,
  AcademicOfferingDraftAuditAction,
  AcademicOfferingDraftClient,
  AcademicOfferingDraftCommand,
  AcademicOfferingDraftReceipt,
  AcademicOfferingDraftSnapshot,
  AcademicOfferingDraftUpdateCommand,
} from './academicOfferingDraftContracts'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SECTION_CODE_PATTERN = /^[A-Z0-9][A-Z0-9._-]{0,23}$/
const AUDIT_ACTIONS = new Set<AcademicOfferingDraftAuditAction>(['OFFERING_DRAFT_CREATED', 'OFFERING_DRAFT_UPDATED'])

export class AcademicOfferingDraftApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'AcademicOfferingDraftApiError'
    this.status = status
    this.code = code
  }
}

export function createAcademicOfferingDraftClient(fetcher: typeof fetch = fetch): AcademicOfferingDraftClient {
  return {
    async listDrafts(periodId, query, accessToken, signal) {
      const parameters = new URLSearchParams({ periodId: requireUuid(periodId), limit: String(pageLimit(query.limit)) })
      if (query.before !== undefined) parameters.set('before', validateCursor(query.before))
      const response = await fetcher(`/api/v1/admin/academic-offerings?${parameters.toString()}`,
        requestOptions(accessToken, signal))
      const body = await responseBody(response)
      if (!isRecord(body) || !Array.isArray(body.drafts) || body.drafts.length > pageLimit(query.limit)
        || !isCursor(body.nextCursor)
        || (body.nextCursor !== null && body.drafts.length !== pageLimit(query.limit))) throw malformedResponse()
      const drafts = body.drafts.map(parseDraft)
      if (drafts.some((draft) => draft.periodId !== periodId.toLowerCase() || draft.status !== 'DRAFT')) {
        throw malformedResponse()
      }
      return { drafts, nextCursor: body.nextCursor }
    },

    async createDraft(command, accessToken, signal) {
      const normalized = normalizeCreateCommand(command)
      const response = await fetcher('/api/v1/admin/academic-offerings', jsonRequestOptions('POST', normalized, accessToken, signal))
      return parseReceipt(await responseBody(response))
    },

    async updateDraft(offeringId, command, accessToken, signal) {
      const id = requireUuid(offeringId)
      const normalized = normalizeUpdateCommand(command)
      const response = await fetcher(`/api/v1/admin/academic-offerings/${id}`,
        jsonRequestOptions('PUT', normalized, accessToken, signal))
      return parseReceipt(await responseBody(response))
    },

    async listAuditEvents(offeringId, query, accessToken, signal) {
      const id = requireUuid(offeringId)
      const parameters = new URLSearchParams({ limit: String(pageLimit(query.limit)) })
      if (query.before !== undefined) parameters.set('before', validateCursor(query.before))
      const response = await fetcher(`/api/v1/admin/academic-offerings/${id}/audit-events?${parameters.toString()}`,
        requestOptions(accessToken, signal))
      const body = await responseBody(response)
      if (!isRecord(body) || !Array.isArray(body.events) || body.events.length > pageLimit(query.limit)
        || !isCursor(body.nextCursor)
        || (body.nextCursor !== null && body.events.length !== pageLimit(query.limit))) throw malformedResponse()
      const events = body.events.map(parseAuditEvent)
      if (events.some((event) => event.offeringId !== id)) throw malformedResponse()
      return { events, nextCursor: body.nextCursor }
    },
  }
}

export const academicOfferingDraftClient = createAcademicOfferingDraftClient()

function normalizeCreateCommand(command: AcademicOfferingDraftCommand): AcademicOfferingDraftCommand {
  if (!isRecord(command)) throw invalidCommand()
  return {
    periodId: requireUuid(command.periodId),
    curriculumId: requireUuid(command.curriculumId),
    subjectId: requireUuid(command.subjectId),
    sectionCode: normalizeSectionCode(command.sectionCode),
    ...normalizeDatesAndDetails(command.startsOn, command.endsOn, command.proposedCapacity, command.sourceReference),
  }
}

function normalizeUpdateCommand(command: AcademicOfferingDraftUpdateCommand): AcademicOfferingDraftUpdateCommand {
  if (!isRecord(command) || !isPositiveInteger(command.expectedVersion)) throw invalidCommand()
  return {
    expectedVersion: command.expectedVersion,
    sectionCode: normalizeSectionCode(command.sectionCode),
    ...normalizeDatesAndDetails(command.startsOn, command.endsOn, command.proposedCapacity, command.sourceReference),
  }
}

function normalizeDatesAndDetails(startsOn: unknown, endsOn: unknown, proposedCapacity: unknown, sourceReference: unknown) {
  const reference = typeof sourceReference === 'string' ? sourceReference.trim() : ''
  if (!isDate(startsOn) || !isDate(endsOn) || endsOn < startsOn
    || !isPositiveInteger(proposedCapacity)
    || !isBoundedText(reference, 240) || containsAsciiControlCharacters(reference)) throw invalidCommand()
  return { startsOn, endsOn, proposedCapacity, sourceReference: reference }
}

function normalizeSectionCode(value: unknown): string {
  const sectionCode = typeof value === 'string' ? value.trim().toLocaleUpperCase('en-US') : ''
  if (!SECTION_CODE_PATTERN.test(sectionCode)) throw invalidCommand()
  return sectionCode
}

function parseDraft(input: unknown): AcademicOfferingDraft {
  if (!isRecord(input)
    || !isUuid(input.id)
    || !isUuid(input.periodId)
    || !isBoundedText(input.periodCode, 32)
    || (input.periodKind !== 'REGULAR' && input.periodKind !== 'INTERSEMESTRAL')
    || !isUuid(input.curriculumId)
    || !isBoundedText(input.curriculumVersion, 80)
    || !isProgramCode(input.programCode)
    || !isBoundedText(input.programName, 240)
    || !isUuid(input.subjectId)
    || !isProgramCode(input.subjectCode)
    || !isBoundedText(input.subjectName, 240)
    || typeof input.sectionCode !== 'string' || !SECTION_CODE_PATTERN.test(input.sectionCode)
    || !isDate(input.startsOn) || !isDate(input.endsOn) || input.endsOn < input.startsOn
    || !isPositiveInteger(input.proposedCapacity)
    || !isPositiveInteger(input.version)
    || input.status !== 'DRAFT'
    || !isBoundedText(input.sourceReference, 240) || containsAsciiControlCharacters(input.sourceReference)
    || !isBoundedText(input.updatedBy, 160)
    || !isIsoInstant(input.createdAt) || !isIsoInstant(input.updatedAt)) throw malformedResponse()
  return {
    id: input.id.toLowerCase(), periodId: input.periodId.toLowerCase(), periodCode: input.periodCode,
    periodKind: input.periodKind, curriculumId: input.curriculumId.toLowerCase(),
    curriculumVersion: input.curriculumVersion, programCode: input.programCode, programName: input.programName,
    subjectId: input.subjectId.toLowerCase(), subjectCode: input.subjectCode, subjectName: input.subjectName,
    sectionCode: input.sectionCode, startsOn: input.startsOn, endsOn: input.endsOn,
    proposedCapacity: input.proposedCapacity, version: input.version, status: 'DRAFT',
    sourceReference: input.sourceReference, updatedBy: input.updatedBy,
    createdAt: input.createdAt, updatedAt: input.updatedAt,
  }
}

function parseReceipt(input: unknown): AcademicOfferingDraftReceipt {
  if (!isRecord(input) || !isUuid(input.id) || !isPositiveInteger(input.version) || input.status !== 'DRAFT') {
    throw malformedResponse()
  }
  return { id: input.id.toLowerCase(), version: input.version, status: 'DRAFT' }
}

function parseAuditEvent(input: unknown) {
  if (!isRecord(input) || !Number.isSafeInteger(input.id) || Number(input.id) < 1
    || !isUuid(input.offeringId) || typeof input.actionKey !== 'string' || !AUDIT_ACTIONS.has(input.actionKey as AcademicOfferingDraftAuditAction)
    || !isBoundedText(input.actor, 160) || !isIsoInstant(input.occurredAt)
    || !isBoundedText(input.sourceReference, 240) || containsAsciiControlCharacters(input.sourceReference)
    || !(input.before === null || isSnapshot(input.before)) || !isSnapshot(input.after)) throw malformedResponse()
  return {
    id: Number(input.id), offeringId: input.offeringId.toLowerCase(),
    actionKey: input.actionKey as AcademicOfferingDraftAuditAction, actor: input.actor,
    occurredAt: input.occurredAt, sourceReference: input.sourceReference,
    before: input.before as AcademicOfferingDraftSnapshot | null,
    after: input.after as AcademicOfferingDraftSnapshot,
  }
}

function isSnapshot(input: unknown): input is AcademicOfferingDraftSnapshot {
  return isRecord(input) && typeof input.sectionCode === 'string' && SECTION_CODE_PATTERN.test(input.sectionCode)
    && isDate(input.startsOn) && isDate(input.endsOn) && input.endsOn >= input.startsOn
    && isPositiveInteger(input.proposedCapacity) && isPositiveInteger(input.version)
}

function jsonRequestOptions(method: 'POST' | 'PUT', body: unknown, accessToken: string, signal?: AbortSignal): RequestInit {
  return {
    ...requestOptions(accessToken, signal), method,
    headers: { Accept: 'application/json', Authorization: `Bearer ${requireAccessToken(accessToken)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

function requestOptions(accessToken: string, signal?: AbortSignal): RequestInit {
  const token = requireAccessToken(accessToken)
  return {
    credentials: 'omit', headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    ...(signal ? { signal } : {}),
  }
}

function requireAccessToken(value: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value || containsAsciiControlCharacters(value)) {
    throw new Error('A valid institutional access token is required.')
  }
  return value
}

async function responseBody(response: Response): Promise<unknown> {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    if (response.ok) throw malformedResponse()
    body = null
  }
  if (!response.ok) {
    const error = isRecord(body) ? body : {}
    throw new AcademicOfferingDraftApiError(response.status,
      typeof error.error === 'string' ? error.error : `http_${response.status}`,
      typeof error.message === 'string' ? error.message : 'No se pudo completar la solicitud académica.')
  }
  return body
}

function pageLimit(value: number | undefined): number {
  const limit = value ?? 25
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('The academic offering page limit is invalid.')
  return limit
}

function validateCursor(value: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 256 || containsAsciiControlCharacters(value)) {
    throw new Error('The academic offering cursor is invalid.')
  }
  return value
}

function isCursor(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && value.length > 0 && value.length <= 256
    && !containsAsciiControlCharacters(value))
}

function requireUuid(value: unknown): string {
  if (!isUuid(value)) throw invalidCommand()
  return value.toLowerCase()
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (month < 1 || month > 12) return false
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day >= 1 && day <= days[month - 1]!
}

function isIsoInstant(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(value)
    && isDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value))
}

function isProgramCode(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z0-9][A-Z0-9._-]{0,63}$/.test(value)
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0 && Number(value) <= 2_147_483_647
}

function isBoundedText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalidCommand(): Error {
  return new Error('The academic offering draft command is invalid.')
}

function malformedResponse(): Error {
  return new Error('The academic offering draft response is malformed.')
}
