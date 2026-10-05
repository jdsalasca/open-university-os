import type {
  AcademicEntityStatus,
  AcademicDisplayOrderCommand,
  AcademicOperationsClient,
  AcademicOrganizationUnitCreateCommand,
  AcademicStructureRelationCloseCommand,
  AcademicSiteCreateCommand,
  AcademicStructureEntryCreateCommand,
  AcademicOrganizationRelation,
  AcademicOrganizationUnit,
  AcademicOrganizationUnitType,
  AcademicProgramAffiliationCreateCommand,
  AcademicStructureRelationCreateCommand,
  AcademicPeriod,
  AcademicPeriodAuditAction,
  AcademicPeriodHistory,
  AcademicStructureAuditAction,
  AcademicStructureAuditEvent,
  AcademicStructureAuditPage,
  AcademicStructureAuditQuery,
  AcademicPeriodKind,
  AcademicCalendarRevision,
  AcademicCalendarRevisionStatus,
  AcademicCalendarActivity,
  AcademicProgramAffiliation,
  AcademicProgramAffiliationReassignmentCommand,
  AcademicSite,
  AcademicSiteRelation,
  AcademicSiteType,
  AcademicStructureSnapshot,
} from './academicOperationsContracts'
import { containsAsciiControlCharacters } from '../../shared/inputValidation'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const UNIT_TYPES = new Set<AcademicOrganizationUnitType>(['FACULTY', 'SCHOOL', 'ACADEMIC_UNIT'])
const SITE_TYPES = new Set<AcademicSiteType>(['CENTRAL', 'SECCIONAL', 'REGIONAL', 'CREAD', 'CAMPUS', 'OTHER'])
const ENTITY_STATUSES = new Set<AcademicEntityStatus>(['ACTIVE', 'INACTIVE'])
const PERIOD_KINDS = new Set<AcademicPeriodKind>(['REGULAR', 'INTERSEMESTRAL'])
const PERIOD_STATUSES = new Set<AcademicPeriod['status']>(['DRAFT', 'APPROVED', 'OPEN', 'CLOSED', 'CANCELLED'])
const CALENDAR_REVISION_STATUSES = new Set<AcademicCalendarRevisionStatus>(['DRAFT', 'PUBLISHED'])
const PERIOD_AUDIT_ACTIONS = new Set<AcademicPeriodAuditAction>([
  'PERIOD_CREATED', 'CALENDAR_CREATED', 'CALENDAR_PUBLISHED', 'PERIOD_APPROVED',
  'PERIOD_OPENED', 'PERIOD_CLOSED', 'PERIOD_CANCELLED', 'PERIOD_CALENDAR_AMENDED',
])
const STRUCTURE_AUDIT_ACTIONS = new Set<AcademicStructureAuditAction>([
  'UNIT_CREATED', 'UNIT_RELATED', 'SITE_CREATED', 'SITE_RELATED', 'PROGRAM_AFFILIATED',
  'UNIT_ORDER_CHANGED', 'SITE_ORDER_CHANGED', 'UNIT_RELATION_ORDER_CHANGED', 'SITE_RELATION_ORDER_CHANGED',
  'PROGRAM_ORDER_CHANGED', 'UNIT_RELATION_CLOSED', 'SITE_RELATION_CLOSED', 'PROGRAM_AFFILIATION_CLOSED',
  'PROGRAM_AFFILIATION_REASSIGNED',
])

export class AcademicOperationsApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'AcademicOperationsApiError'
    this.status = status
  }
}

export function createAcademicOperationsClient(fetcher: typeof fetch = fetch): AcademicOperationsClient {
  const periodWorkflow = createLazyAcademicPeriodWorkflow(fetcher)
  return {
    async getStructure(signal) {
      const response = await fetcher('/api/v1/academic-structure', requestOptions(signal))
      return parseAcademicStructure(await responseBody(response))
    },

    async getAdminStructure(accessToken, signal) {
      const response = await fetcher('/api/v1/admin/academic-structure', authorizedRequestOptions(accessToken, signal))
      return parseAcademicStructure(await responseBody(response))
    },

    async createOrganizationUnit(command, accessToken, signal) {
      const response = await fetcher('/api/v1/admin/academic-structure/units',
        jsonPostRequestOptions(normalizeStructureEntryCommand(command, UNIT_TYPES), accessToken, signal))
      const body = await responseBody(response)
      if (!isRecord(body) || !isUuid(body.id)) throw malformedResponse()
      return body.id
    },

    async createChildUnit(parentUnitId, command, accessToken, signal) {
      const path = childUnitPath(parentUnitId)
      const response = await fetcher(path,
        jsonPostRequestOptions(normalizeStructureEntryCommand(command, UNIT_TYPES), accessToken, signal))
      const body = await responseBody(response)
      if (!isRecord(body) || !isUuid(body.id)) throw malformedResponse()
      return body.id
    },

    async closeOrganizationRelation(parentUnitId, childUnitId, command, accessToken, signal) {
      await closeStructureRelation('unit', parentUnitId, childUnitId, command, accessToken, signal, fetcher)
    },

    async createSite(command, accessToken, signal) {
      const response = await fetcher('/api/v1/admin/academic-structure/sites',
        jsonPostRequestOptions(normalizeStructureEntryCommand(command, SITE_TYPES), accessToken, signal))
      const body = await responseBody(response)
      if (!isRecord(body) || !isUuid(body.id)) throw malformedResponse()
      return body.id
    },

    async closeSiteRelation(parentSiteId, childSiteId, command, accessToken, signal) {
      await closeStructureRelation('site', parentSiteId, childSiteId, command, accessToken, signal, fetcher)
    },

    async relateOrganizationUnits(parentUnitId, childUnitId, command, accessToken, signal) {
      const path = structureRelationPath('unit', parentUnitId, childUnitId)
      const response = await fetcher(path,
        jsonPostRequestOptions(normalizeStructureRelationCommand(command), accessToken, signal))
      await createdResponse(response)
    },

    async relateSites(parentSiteId, childSiteId, command, accessToken, signal) {
      const path = structureRelationPath('site', parentSiteId, childSiteId)
      const response = await fetcher(path,
        jsonPostRequestOptions(normalizeStructureRelationCommand(command), accessToken, signal))
      await createdResponse(response)
    },

    async affiliateProgram(programId, command, accessToken, signal) {
      const path = programAffiliationPath(programId)
      const normalized = normalizeProgramAffiliationCreateCommand(command)
      const response = await fetcher(path, jsonPostRequestOptions(normalized, accessToken, signal))
      const body = await responseBody(response)
      if (!isRecord(body) || !isUuid(body.id) || body.id.toLowerCase() !== programId.toLowerCase()) {
        throw malformedResponse()
      }
    },

    async closeProgramAffiliation(programId, affiliationId, command, accessToken, signal) {
      await closeDatedRelationship(programAffiliationClosePath(programId, affiliationId), command,
        accessToken, signal, fetcher)
    },

    async reassignProgramAffiliation(programId, affiliationId, command, accessToken, signal) {
      const path = programAffiliationReassignmentPath(programId, affiliationId)
      const normalized = normalizeProgramAffiliationReassignmentCommand(command)
      const response = await fetcher(path, jsonPostRequestOptions(normalized, accessToken, signal))
      const body = await responseBody(response)
      if (response.status !== 201 || !isRecord(body) || !isUuid(body.id)) throw malformedResponse()
      return body.id
    },

    async getOpenPeriods(signal) {
      const response = await fetcher('/api/v1/academic-periods', requestOptions(signal))
      return parseOpenAcademicPeriods(await responseBody(response))
    },

    async getAdminPeriods(accessToken, signal) {
      const response = await fetcher('/api/v1/admin/academic-periods', authorizedRequestOptions(accessToken, signal))
      return parseAdminAcademicPeriods(await responseBody(response))
    },

    async getPeriodHistory(periodId, accessToken, signal) {
      const response = await fetcher(periodHistoryPath(periodId), authorizedRequestOptions(accessToken, signal))
      return parseAcademicPeriodHistory(await responseBody(response), periodId)
    },

    async getStructureAuditEvents(query, accessToken, signal) {
      const normalized = normalizeStructureAuditQuery(query)
      const response = await fetcher(structureAuditPath(normalized), authorizedRequestOptions(accessToken, signal))
      return parseStructureAuditPage(await responseBody(response), normalized.limit ?? 50)
    },

    async createPeriod(command, accessToken, signal) {
      return (await periodWorkflow()).createPeriod(command, accessToken, signal)
    },

    async createCalendar(periodId, command, accessToken, signal) {
      return (await periodWorkflow()).createCalendar(periodId, command, accessToken, signal)
    },

    async publishCalendar(periodId, revisionId, accessToken, signal) {
      return (await periodWorkflow()).publishCalendar(periodId, revisionId, accessToken, signal)
    },

    async approvePeriod(periodId, command, accessToken, signal) {
      return (await periodWorkflow()).approvePeriod(periodId, command, accessToken, signal)
    },

    async openPeriod(periodId, accessToken, signal) {
      const response = await fetcher(periodActionPath(periodId, 'open'), postRequestOptions(accessToken, signal))
      return parseTransitionResponse(await responseBody(response), 'OPEN')
    },

    async closePeriod(periodId, accessToken, signal) {
      const response = await fetcher(periodActionPath(periodId, 'close'), postRequestOptions(accessToken, signal))
      return parseTransitionResponse(await responseBody(response), 'CLOSED')
    },

    async changeOrganizationUnitOrder(unitId, command, accessToken, signal) {
      await noContentResponse(await fetcher(
        structureOrderPath('unit', unitId),
        orderRequestOptions(command, accessToken, signal),
      ))
    },

    async changeSiteOrder(siteId, command, accessToken, signal) {
      await noContentResponse(await fetcher(
        structureOrderPath('site', siteId),
        orderRequestOptions(command, accessToken, signal),
      ))
    },

    async changeOrganizationRelationOrder(parentUnitId, childUnitId, command, accessToken, signal) {
      await noContentResponse(await fetcher(
        structureOrderPath('organization-relation', parentUnitId, childUnitId),
        orderRequestOptions(command, accessToken, signal),
      ))
    },

    async changeSiteRelationOrder(parentSiteId, childSiteId, command, accessToken, signal) {
      await noContentResponse(await fetcher(
        structureOrderPath('site-relation', parentSiteId, childSiteId),
        orderRequestOptions(command, accessToken, signal),
      ))
    },

    async changeProgramAffiliationOrder(programId, affiliationId, command, accessToken, signal) {
      await noContentResponse(await fetcher(
        structureOrderPath('program-affiliation', programId, affiliationId),
        orderRequestOptions(command, accessToken, signal),
      ))
    },
  }
}

type AcademicPeriodWorkflowClient = Pick<AcademicOperationsClient,
  'createPeriod' | 'createCalendar' | 'publishCalendar' | 'approvePeriod'>

function createLazyAcademicPeriodWorkflow(fetcher: typeof fetch): () => Promise<AcademicPeriodWorkflowClient> {
  let workflow: Promise<AcademicPeriodWorkflowClient> | null = null
  return () => {
    workflow ??= import('./academicPeriodClient')
      .then(({ createAcademicPeriodWorkflowClient }) => createAcademicPeriodWorkflowClient(fetcher))
    return workflow
  }
}

async function closeStructureRelation(kind: 'unit' | 'site', parentId: string, childId: string,
  command: AcademicStructureRelationCloseCommand, accessToken: string, signal: AbortSignal | undefined,
  fetcher: typeof fetch): Promise<void> {
  const path = `${structureRelationPath(kind, parentId, childId)}/close`
  await closeDatedRelationship(path, command, accessToken, signal, fetcher)
}

async function closeDatedRelationship(path: string, command: AcademicStructureRelationCloseCommand,
  accessToken: string, signal: AbortSignal | undefined, fetcher: typeof fetch): Promise<void> {
  await noContentResponse(await fetcher(
    path,
    jsonPatchRequestOptions(normalizeStructureRelationCloseCommand(command), accessToken, signal),
  ))
}

export const academicOperationsClient = createAcademicOperationsClient()

export function parseAcademicStructure(input: unknown): AcademicStructureSnapshot {
  if (!isRecord(input)
    || !Array.isArray(input.units)
    || !Array.isArray(input.organizationRelations)
    || !Array.isArray(input.sites)
    || !Array.isArray(input.siteRelations)
    || !Array.isArray(input.programAffiliations)) throw malformedResponse()

  const units = input.units.map(parseOrganizationUnit)
  const sites = input.sites.map(parseSite)
  const organizationRelations = input.organizationRelations.map(parseOrganizationRelation)
  const siteRelations = input.siteRelations.map(parseSiteRelation)
  const programAffiliations = input.programAffiliations.map(parseProgramAffiliation)
  assertUnique(units.map((unit) => unit.id))
  assertUnique(units.map((unit) => unit.code))
  assertUnique(sites.map((site) => site.id))
  assertUnique(sites.map((site) => site.code))

  const unitIds = new Set(units.map((unit) => unit.id))
  const siteIds = new Set(sites.map((site) => site.id))
  if (organizationRelations.some((relation) => !unitIds.has(relation.parentUnitId)
    || !unitIds.has(relation.childUnitId))
    || siteRelations.some((relation) => !siteIds.has(relation.parentSiteId)
      || !siteIds.has(relation.childSiteId))
    || programAffiliations.some((affiliation) => !unitIds.has(affiliation.organizationUnitId)
      || !siteIds.has(affiliation.siteId))) throw malformedResponse()

  return { units, organizationRelations, sites, siteRelations, programAffiliations }
}

export function parseOpenAcademicPeriods(input: unknown): AcademicPeriod[] {
  if (!Array.isArray(input)) throw malformedResponse()
  const periods = input.map((period) => parseAcademicPeriod(period, 'OPEN'))
  assertUnique(periods.map((period) => period.id))
  assertUnique(periods.map((period) => period.code))
  return periods
}

export function parseAdminAcademicPeriods(input: unknown): AcademicPeriod[] {
  if (!Array.isArray(input)) throw malformedResponse()
  const periods = input.map((period) => parseAcademicPeriod(period))
  assertUnique(periods.map((period) => period.id))
  assertUnique(periods.map((period) => period.code))
  return periods
}

function parseAcademicPeriodHistory(input: unknown, expectedPeriodId: string): AcademicPeriodHistory {
  if (!isUuid(expectedPeriodId)
    || !isRecord(input)
    || !Array.isArray(input.calendarRevisions)
    || !Array.isArray(input.auditEvents)) throw malformedResponse()

  const period = parseAcademicPeriod(input.period)
  if (period.id.toLowerCase() !== expectedPeriodId.toLowerCase()) throw malformedResponse()
  const calendarRevisions = input.calendarRevisions.map(parseCalendarRevision)
  if (calendarRevisions.some((revision) => revision.periodId.toLowerCase() !== expectedPeriodId.toLowerCase())) {
    throw malformedResponse()
  }
  assertUnique(calendarRevisions.map(({ id }) => id.toLowerCase()))
  if (new Set(calendarRevisions.map(({ version }) => version)).size !== calendarRevisions.length) {
    throw malformedResponse()
  }
  const auditEvents = input.auditEvents.map(parsePeriodAuditEvent)
  assertUnique(auditEvents.map(({ id }) => String(id)))
  return { period, calendarRevisions, auditEvents }
}

function parseStructureAuditPage(input: unknown, limit: number): AcademicStructureAuditPage {
  if (!isRecord(input)
    || !Array.isArray(input.events)
    || input.events.length > limit
    || !(input.nextCursor === null || isOpaqueAuditCursor(input.nextCursor))) throw malformedResponse()
  return {
    events: input.events.map(parseStructureAuditEvent),
    nextCursor: input.nextCursor,
  }
}

function parseStructureAuditEvent(input: unknown): AcademicStructureAuditEvent {
  if (!isRecord(input)
    || !isUuid(input.entityId)
    || !isOneOf(STRUCTURE_AUDIT_ACTIONS, input.actionKey)
    || !isBoundedText(input.actor, 180)
    || containsAsciiControlCharacters(input.actor)
    || !isIsoInstant(input.occurredAt)
    || !isBoundedText(input.reference, 240)
    || containsAsciiControlCharacters(input.reference)
    || !isBoundedText(input.summary, 240)
    || containsAsciiControlCharacters(input.summary)) throw malformedResponse()
  return input as unknown as AcademicStructureAuditEvent
}

function normalizeStructureAuditQuery(query: AcademicStructureAuditQuery): Required<Pick<AcademicStructureAuditQuery, 'limit'>>
  & Omit<AcademicStructureAuditQuery, 'limit'> {
  if (!isRecord(query)) throw new Error('The academic structure audit query is invalid.')
  const rawLimit = query.limit
  const limit = rawLimit === undefined ? 50 : rawLimit
  if (typeof limit !== 'number' || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('The academic structure audit page limit must be between 1 and 100.')
  }
  const before = query.before
  if (before !== undefined && !isOpaqueAuditCursor(before)) throw malformedResponse()
  const entityId = query.entityId
  if (entityId !== undefined && !isUuid(entityId)) throw new Error('The academic structure audit entity ID is invalid.')
  const actionKey = query.actionKey
  if (actionKey !== undefined && !isOneOf(STRUCTURE_AUDIT_ACTIONS, actionKey)) {
    throw new Error('The academic structure audit action is invalid.')
  }
  return { limit, ...(entityId ? { entityId: entityId.toLowerCase() } : {}),
    ...(actionKey ? { actionKey } : {}), ...(before ? { before } : {}) }
}

function isOpaqueAuditCursor(input: unknown): input is string {
  return typeof input === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(input)
}

export function parseCalendarRevision(input: unknown): AcademicCalendarRevision {
  if (!isRecord(input)
    || !isUuid(input.id)
    || !isUuid(input.periodId)
    || !isPositiveInteger(input.version)
    || !(input.officialReference === null || isBoundedText(input.officialReference, 240))
    || !isOneOf(CALENDAR_REVISION_STATUSES, input.status)
    || !Array.isArray(input.activities)
    || input.activities.length > 200) throw malformedResponse()
  const activities = input.activities.map(parseCalendarActivity)
  assertUnique(activities.map(({ key }) => key))
  return { ...input, activities } as AcademicCalendarRevision
}

function parseCalendarActivity(input: unknown): AcademicCalendarActivity {
  if (!isRecord(input)
    || typeof input.key !== 'string'
    || !/^[A-Z][A-Z0-9_]{0,63}$/.test(input.key)
    || !isBoundedText(input.label, 160)
    || !isLocalDateTime(input.startsAt)
    || !isLocalDateTime(input.endsAt)
    || input.endsAt < input.startsAt
    || !(input.organizationUnitId === null || isUuid(input.organizationUnitId))
    || !(input.siteId === null || isUuid(input.siteId))) throw malformedResponse()
  return input as unknown as AcademicCalendarActivity
}

function parsePeriodAuditEvent(input: unknown): AcademicPeriodHistory['auditEvents'][number] {
  if (!isRecord(input)
    || !isPositiveInteger(input.id)
    || !isOneOf(PERIOD_AUDIT_ACTIONS, input.actionKey)
    || !isBoundedText(input.actorSub, 180)
    || !isIsoInstant(input.occurredAt)
    || !(input.reference === null || isBoundedText(input.reference, 240))
    || !isBoundedText(input.summary, 240)) throw malformedResponse()
  return input as unknown as AcademicPeriodHistory['auditEvents'][number]
}

function parseOrganizationUnit(input: unknown): AcademicOrganizationUnit {
  if (!isRecord(input)
    || !isUuid(input.id)
    || !isIdentifier(input.code)
    || !isOneOf(UNIT_TYPES, input.type)
    || !isBoundedText(input.displayName, 240)
    || !isNonNegativeInteger(input.displayOrder)
    || !isOneOf(ENTITY_STATUSES, input.status)
    || !isDate(input.validFrom)
    || !(input.validThrough === null || isDate(input.validThrough))
    || compareDates(input.validThrough, input.validFrom) < 0) throw malformedResponse()
  return input as unknown as AcademicOrganizationUnit
}

function parseSite(input: unknown): AcademicSite {
  if (!isRecord(input)
    || !isUuid(input.id)
    || !isIdentifier(input.code)
    || !isOneOf(SITE_TYPES, input.type)
    || !isBoundedText(input.displayName, 240)
    || !isNonNegativeInteger(input.displayOrder)
    || !isOneOf(ENTITY_STATUSES, input.status)
    || !isDate(input.validFrom)
    || !(input.validThrough === null || isDate(input.validThrough))
    || compareDates(input.validThrough, input.validFrom) < 0) throw malformedResponse()
  return input as unknown as AcademicSite
}

function parseOrganizationRelation(input: unknown): AcademicOrganizationRelation {
  if (!isRecord(input)
    || !isUuid(input.parentUnitId)
    || !isUuid(input.childUnitId)
    || input.parentUnitId === input.childUnitId
    || !isNonNegativeInteger(input.displayOrder)
    || !isDate(input.validFrom)
    || !(input.validThrough === null || isDate(input.validThrough))
    || compareDates(input.validThrough, input.validFrom) < 0) throw malformedResponse()
  return input as unknown as AcademicOrganizationRelation
}

function parseSiteRelation(input: unknown): AcademicSiteRelation {
  if (!isRecord(input)
    || !isUuid(input.parentSiteId)
    || !isUuid(input.childSiteId)
    || input.parentSiteId === input.childSiteId
    || !isNonNegativeInteger(input.displayOrder)
    || !isDate(input.validFrom)
    || !(input.validThrough === null || isDate(input.validThrough))
    || compareDates(input.validThrough, input.validFrom) < 0) throw malformedResponse()
  return input as unknown as AcademicSiteRelation
}

function parseProgramAffiliation(input: unknown): AcademicProgramAffiliation {
  if (!isRecord(input)
    || !isUuid(input.id)
    || !isUuid(input.programId)
    || !isUuid(input.organizationUnitId)
    || !isUuid(input.siteId)
    || !isNonNegativeInteger(input.displayOrder)
    || !isDate(input.validFrom)
    || !(input.validThrough === null || isDate(input.validThrough))
    || compareDates(input.validThrough, input.validFrom) < 0
    || !isBoundedText(input.sourceReference, 240)) throw malformedResponse()
  return input as unknown as AcademicProgramAffiliation
}

export function parseAcademicPeriod(input: unknown, expectedStatus?: AcademicPeriod['status']): AcademicPeriod {
  if (!isRecord(input)
    || !isUuid(input.id)
    || !isIdentifier(input.code)
    || !isOneOf(PERIOD_KINDS, input.kind)
    || !Number.isInteger(input.academicYear)
    || Number(input.academicYear) < 1900
    || Number(input.academicYear) > 9999
    || !Number.isInteger(input.sequenceNumber)
    || Number(input.sequenceNumber) < 1
    || (input.kind === 'REGULAR' && Number(input.sequenceNumber) > 2)
    || !isDate(input.startsOn)
    || !isDate(input.endsOn)
    || input.endsOn < input.startsOn
    || !isOneOf(PERIOD_STATUSES, input.status)
    || (expectedStatus !== undefined && input.status !== expectedStatus)
    || !hasValidPeriodReferences(input)
    || (input.status === 'DRAFT' && !hasNoPeriodReferences(input))
    || (['APPROVED', 'OPEN', 'CLOSED'].includes(String(input.status)) && !hasCompletePeriodReferences(input))
    || !isIsoInstant(input.createdAt)) throw malformedResponse()
  return input as unknown as AcademicPeriod
}

function hasNoPeriodReferences(input: Record<string, unknown>): boolean {
  return input.calendarRevisionId === null
    && input.calendarRevisionNumber === null
    && input.approvalReference === null
    && input.officialReference === null
}

function hasCompletePeriodReferences(input: Record<string, unknown>): boolean {
  return isUuid(input.calendarRevisionId)
    && isPositiveInteger(input.calendarRevisionNumber)
    && isBoundedText(input.approvalReference, 240)
    && isBoundedText(input.officialReference, 240)
}

function hasValidPeriodReferences(input: Record<string, unknown>): boolean {
  return hasNoPeriodReferences(input) || hasCompletePeriodReferences(input)
}

export async function responseBody(response: Response): Promise<unknown> {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    if (response.ok) throw malformedResponse()
    body = null
  }
  if (!response.ok) {
    const message = isRecord(body) && isBoundedText(body.message, 500)
      ? body.message
      : `Academic operations request failed (${response.status}).`
    throw new AcademicOperationsApiError(response.status, message)
  }
  return body
}

function requestOptions(signal?: AbortSignal): RequestInit {
  return {
    credentials: 'omit',
    headers: { Accept: 'application/json' },
    ...(signal ? { signal } : {}),
  }
}

function authorizedRequestOptions(accessToken: string, signal?: AbortSignal): RequestInit {
  return {
    ...requestOptions(signal),
    headers: { Accept: 'application/json', Authorization: `Bearer ${requireAccessToken(accessToken)}` },
  }
}

export function postRequestOptions(accessToken: string, signal?: AbortSignal): RequestInit {
  return { ...authorizedRequestOptions(accessToken, signal), method: 'POST' }
}

function orderRequestOptions(
  command: AcademicDisplayOrderCommand,
  accessToken: string,
  signal?: AbortSignal,
): RequestInit {
  return jsonPatchRequestOptions(normalizeOrderCommand(command), accessToken, signal)
}

function jsonPatchRequestOptions(body: unknown, accessToken: string, signal?: AbortSignal): RequestInit {
  return {
    credentials: 'omit',
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${requireAccessToken(accessToken)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  }
}

function normalizeStructureRelationCloseCommand(
  command: AcademicStructureRelationCloseCommand,
): AcademicStructureRelationCloseCommand {
  if (!isRecord(command)
    || !isDate(command.validFrom)
    || !isDate(command.effectiveThrough)
    || command.effectiveThrough < command.validFrom) {
    throw new Error('The academic organization relation closure interval is invalid.')
  }
  const sourceReference = typeof command.sourceReference === 'string' ? command.sourceReference.trim() : ''
  if (!isBoundedText(sourceReference, 240) || containsAsciiControlCharacters(sourceReference)) {
    throw new Error('An institutional source reference is required and must be valid.')
  }
  return { validFrom: command.validFrom, effectiveThrough: command.effectiveThrough, sourceReference }
}

export function jsonPostRequestOptions(body: unknown, accessToken: string, signal?: AbortSignal): RequestInit {
  return {
    credentials: 'omit',
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${requireAccessToken(accessToken)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  }
}

function normalizeStructureEntryCommand<Type extends AcademicOrganizationUnitCreateCommand['type'] | AcademicSiteCreateCommand['type']>(
  command: unknown,
  allowedTypes: ReadonlySet<Type>,
): AcademicStructureEntryCreateCommand<Type> {
  if (!isRecord(command)) throw new Error('The academic structure entry request is invalid.')
  const code = typeof command.code === 'string' ? command.code.trim().toLocaleUpperCase('en-US') : ''
  const displayName = typeof command.displayName === 'string' ? command.displayName.trim() : ''
  const sourceReference = typeof command.sourceReference === 'string' ? command.sourceReference.trim() : ''
  if (!isIdentifier(code)
    || !isOneOf(allowedTypes, command.type)
    || !isBoundedText(displayName, 240)
    || !isNonNegativeInteger(command.displayOrder)
    || Number(command.displayOrder) > 2_147_483_647
    || !isDate(command.validFrom)
    || !(command.validThrough === null || isDate(command.validThrough))
    || (command.validThrough !== null && command.validThrough < command.validFrom)
    || !isBoundedText(sourceReference, 240)
    || containsAsciiControlCharacters(code)
    || containsAsciiControlCharacters(displayName)
    || containsAsciiControlCharacters(sourceReference)) {
    throw new Error('The academic structure entry request is invalid.')
  }
  return {
    code,
    type: command.type as Type,
    displayName,
    displayOrder: command.displayOrder,
    validFrom: command.validFrom,
    validThrough: command.validThrough,
    sourceReference,
  }
}

function normalizeStructureRelationCommand(command: AcademicStructureRelationCreateCommand): AcademicStructureRelationCreateCommand {
  if (!isRecord(command)
    || !isNonNegativeInteger(command.displayOrder)
    || Number(command.displayOrder) > 2_147_483_647
    || !isDate(command.validFrom)
    || !(command.validThrough === null || isDate(command.validThrough))
    || (command.validThrough !== null && command.validThrough < command.validFrom)) {
    throw new Error('The academic structure relation request is invalid.')
  }
  const sourceReference = typeof command.sourceReference === 'string' ? command.sourceReference.trim() : ''
  if (!isBoundedText(sourceReference, 240) || containsAsciiControlCharacters(sourceReference)) {
    throw new Error('An institutional source reference is required and must be valid.')
  }
  return {
    displayOrder: command.displayOrder,
    validFrom: command.validFrom,
    validThrough: command.validThrough,
    sourceReference,
  }
}

function structureRelationPath(kind: 'unit' | 'site', parentId: string, childId: string): string {
  if (!isUuid(parentId) || !isUuid(childId)) {
    throw new Error('The academic structure relation identifiers are invalid.')
  }
  const canonicalParentId = parentId.toLowerCase()
  const canonicalChildId = childId.toLowerCase()
  if (canonicalParentId === canonicalChildId) {
    throw new Error('The academic structure relation identifiers are invalid.')
  }
  const resource = kind === 'unit' ? 'units' : 'sites'
  return `/api/v1/admin/academic-structure/${resource}/${canonicalParentId}/children/${canonicalChildId}`
}

function childUnitPath(parentId: string): string {
  if (!isUuid(parentId)) throw new Error('The academic parent unit identifier is invalid.')
  return `/api/v1/admin/academic-structure/units/${parentId.toLowerCase()}/children`
}

function programAffiliationPath(programId: string): string {
  if (!isUuid(programId)) throw new Error('The academic program affiliation identifier is invalid.')
  return `/api/v1/admin/academic-structure/programs/${programId.toLowerCase()}/affiliations`
}

function programAffiliationClosePath(programId: string, affiliationId: string): string {
  if (!isUuid(affiliationId)) throw new Error('The academic program affiliation identifier is invalid.')
  return `${programAffiliationPath(programId)}/${affiliationId.toLowerCase()}/close`
}

function programAffiliationReassignmentPath(programId: string, affiliationId: string): string {
  if (!isUuid(affiliationId)) throw new Error('The academic program affiliation identifier is invalid.')
  return `${programAffiliationPath(programId)}/${affiliationId.toLowerCase()}/reassign`
}

function normalizeProgramAffiliationCreateCommand(
  command: AcademicProgramAffiliationCreateCommand,
): AcademicProgramAffiliationCreateCommand {
  if (!isRecord(command) || !isUuid(command.organizationUnitId) || !isUuid(command.siteId)) {
    throw new Error('The academic program affiliation identifiers are invalid.')
  }
  const normalizedRelation = normalizeStructureRelationCommand(command)
  if (normalizedRelation.displayOrder > 100_000) {
    throw new Error('The academic program affiliation display order is invalid.')
  }
  return {
    organizationUnitId: command.organizationUnitId.toLowerCase(),
    siteId: command.siteId.toLowerCase(),
    ...normalizedRelation,
  }
}

function normalizeProgramAffiliationReassignmentCommand(
  command: AcademicProgramAffiliationReassignmentCommand,
): AcademicProgramAffiliationReassignmentCommand {
  if (!isRecord(command)
    || !isDate(command.expectedValidFrom)
    || !(command.expectedValidThrough === null || isDate(command.expectedValidThrough))
    || !isDate(command.effectiveFrom)
    || command.effectiveFrom <= command.expectedValidFrom
    || (command.expectedValidThrough !== null && command.effectiveFrom > command.expectedValidThrough)
    || !isUuid(command.organizationUnitId)
    || !isUuid(command.siteId)
    || !isNonNegativeInteger(command.displayOrder)
    || Number(command.displayOrder) > 100_000) {
    throw new Error('The academic program affiliation reassignment request is invalid.')
  }
  const sourceReference = typeof command.sourceReference === 'string' ? command.sourceReference.trim() : ''
  if (!isBoundedText(sourceReference, 240) || containsAsciiControlCharacters(sourceReference)) {
    throw new Error('An institutional source reference is required and must be valid.')
  }
  return {
    expectedValidFrom: command.expectedValidFrom,
    expectedValidThrough: command.expectedValidThrough,
    effectiveFrom: command.effectiveFrom,
    organizationUnitId: command.organizationUnitId.toLowerCase(),
    siteId: command.siteId.toLowerCase(),
    displayOrder: command.displayOrder,
    sourceReference,
  }
}

function normalizeOrderCommand(command: AcademicDisplayOrderCommand): AcademicDisplayOrderCommand {
  if (!isRecord(command)
    || !isNonNegativeInteger(command.expectedDisplayOrder)
    || !isNonNegativeInteger(command.displayOrder)
    || Number(command.displayOrder) > 100_000) {
    throw new Error('The academic structure order request is invalid.')
  }
  if (typeof command.sourceReference !== 'string'
    || command.sourceReference.trim().length === 0
    || command.sourceReference.trim().length > 240
    || containsAsciiControlCharacters(command.sourceReference.trim())) {
    throw new Error('An institutional source reference is required and must be valid.')
  }
  return {
    expectedDisplayOrder: command.expectedDisplayOrder,
    displayOrder: command.displayOrder,
    sourceReference: command.sourceReference.trim(),
  }
}

async function noContentResponse(response: Response): Promise<void> {
  if (response.status === 204) return
  await responseBody(response)
  throw malformedResponse()
}

async function createdResponse(response: Response): Promise<void> {
  if (response.status === 201) {
    const body = await response.text()
    if (!body) return
    throw malformedResponse()
  }
  await responseBody(response)
  throw malformedResponse()
}

function structureOrderPath(kind: 'unit' | 'site' | 'organization-relation' | 'site-relation' | 'program-affiliation',
  primaryId: string, secondaryId?: string): string {
  if (!isUuid(primaryId) || (secondaryId !== undefined && !isUuid(secondaryId))) throw malformedResponse()
  switch (kind) {
    case 'unit': return `/api/v1/admin/academic-structure/units/${primaryId}/order`
    case 'site': return `/api/v1/admin/academic-structure/sites/${primaryId}/order`
    case 'organization-relation':
      if (!secondaryId) throw malformedResponse()
      return `/api/v1/admin/academic-structure/units/${primaryId}/children/${secondaryId}/order`
    case 'site-relation':
      if (!secondaryId) throw malformedResponse()
      return `/api/v1/admin/academic-structure/sites/${primaryId}/children/${secondaryId}/order`
    case 'program-affiliation':
      if (!secondaryId) throw malformedResponse()
      return `/api/v1/admin/academic-structure/programs/${primaryId}/affiliations/${secondaryId}/order`
  }
}

function periodActionPath(periodId: string, action: 'open' | 'close'): string {
  if (!isUuid(periodId)) throw malformedResponse()
  return `/api/v1/admin/academic-periods/${periodId}/${action}`
}

function periodHistoryPath(periodId: string): string {
  if (!isUuid(periodId)) throw malformedResponse()
  return `/api/v1/admin/academic-periods/${periodId}/history`
}

function structureAuditPath(query: AcademicStructureAuditQuery): string {
  const parameters = new URLSearchParams()
  parameters.set('limit', String(query.limit))
  if (query.entityId) parameters.set('entityId', query.entityId)
  if (query.actionKey) parameters.set('actionKey', query.actionKey)
  if (query.before) parameters.set('before', query.before)
  return `/api/v1/admin/academic-structure/audit-events?${parameters.toString()}`
}

function requireAccessToken(accessToken: string): string {
  if (accessToken.trim() !== accessToken || accessToken.length === 0 || containsAsciiControlCharacters(accessToken)) {
    throw new Error('A valid institutional access token is required.')
  }
  return accessToken
}

function parseTransitionResponse(input: unknown, expectedStatus: 'OPEN' | 'CLOSED'): AcademicPeriod {
  return parseAcademicPeriod(input, expectedStatus)
}

function assertUnique(values: readonly string[]) {
  if (new Set(values).size !== values.length) throw malformedResponse()
}

function compareDates(end: unknown, start: string): number {
  return end === null ? 1 : String(end).localeCompare(start)
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
}

function isUuid(input: unknown): input is string {
  return typeof input === 'string' && UUID_PATTERN.test(input)
}

function isIdentifier(input: unknown): input is string {
  return typeof input === 'string' && /^[A-Z0-9][A-Z0-9._-]{0,63}$/.test(input)
}

function isBoundedText(input: unknown, maxLength: number): input is string {
  return typeof input === 'string' && input.trim().length > 0 && [...input].length <= maxLength
}

function isDate(input: unknown): input is string {
  if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return false
  const [year, month, day] = input.split('-').map(Number)
  const date = new Date(Date.UTC(year!, month! - 1, day!))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day
}

function isIsoInstant(input: unknown): input is string {
  return typeof input === 'string' && /^\d{4}-\d\d-\d\dT/.test(input) && Number.isFinite(Date.parse(input))
}

function isLocalDateTime(input: unknown): input is string {
  return typeof input === 'string'
    && /^\d{4}-\d\d-\d\dT(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?$/.test(input)
    && isDate(input.slice(0, 10))
}

function isOneOf<T extends string>(values: ReadonlySet<T>, input: unknown): input is T {
  return typeof input === 'string' && values.has(input as T)
}

function isNonNegativeInteger(input: unknown): input is number {
  return Number.isSafeInteger(input) && Number(input) >= 0
}

function isPositiveInteger(input: unknown): input is number {
  return Number.isSafeInteger(input) && Number(input) > 0
}

export function malformedResponse() {
  return new Error('The academic operations response is malformed.')
}
