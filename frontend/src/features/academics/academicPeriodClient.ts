import type {
  AcademicCalendarActivity,
  AcademicCalendarDraftCommand,
  AcademicOperationsClient,
  AcademicPeriodApprovalCommand,
  AcademicPeriodCreateCommand,
} from './academicOperationsContracts'
import { containsAsciiControlCharacters } from '../../shared/inputValidation'
import {
  jsonPostRequestOptions,
  malformedResponse,
  parseAcademicPeriod,
  parseCalendarRevision,
  postRequestOptions,
  responseBody,
} from './academicOperationsClient'

type AcademicPeriodWorkflowClient = Pick<AcademicOperationsClient,
  'createPeriod' | 'createCalendar' | 'publishCalendar' | 'approvePeriod'>

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PERIOD_KINDS = new Set(['REGULAR', 'INTERSEMESTRAL'])

export function createAcademicPeriodWorkflowClient(fetcher: typeof fetch): AcademicPeriodWorkflowClient {
  return {
    async createPeriod(command, accessToken, signal) {
      const response = await fetcher('/api/v1/admin/academic-periods',
        jsonPostRequestOptions(normalizePeriodCreateCommand(command), accessToken, signal))
      return parseAcademicPeriod(await responseBody(response), 'DRAFT')
    },

    async createCalendar(periodId, command, accessToken, signal) {
      const response = await fetcher(periodCalendarPath(periodId),
        jsonPostRequestOptions(normalizeCalendarDraftCommand(command), accessToken, signal))
      const revision = parseCalendarRevision(await responseBody(response))
      if (revision.periodId.toLowerCase() !== periodId.toLowerCase()) throw malformedResponse()
      return revision
    },

    async publishCalendar(periodId, revisionId, accessToken, signal) {
      const response = await fetcher(periodCalendarActionPath(periodId, revisionId),
        postRequestOptions(accessToken, signal))
      const revision = parseCalendarRevision(await responseBody(response))
      if (revision.periodId.toLowerCase() !== periodId.toLowerCase() || revision.status !== 'PUBLISHED') {
        throw malformedResponse()
      }
      return revision
    },

    async approvePeriod(periodId, command, accessToken, signal) {
      const response = await fetcher(periodApprovalPath(periodId),
        jsonPostRequestOptions(normalizePeriodApprovalCommand(command), accessToken, signal))
      return parseAcademicPeriod(await responseBody(response), 'APPROVED')
    },
  }
}

function normalizePeriodCreateCommand(command: AcademicPeriodCreateCommand): AcademicPeriodCreateCommand {
  if (!isRecord(command)) throw new Error('The academic period request is invalid.')
  const code = typeof command.code === 'string' ? command.code.trim().toLocaleUpperCase('en-US') : ''
  if (!isIdentifier(code)
    || !isOneOf(PERIOD_KINDS, command.kind)
    || !Number.isInteger(command.academicYear) || command.academicYear < 1900 || command.academicYear > 9999
    || !isPositiveInteger(command.sequenceNumber)
    || command.sequenceNumber > 99
    || (command.kind === 'REGULAR' && command.sequenceNumber > 2)
    || !isDate(command.startsOn) || !isDate(command.endsOn) || command.endsOn < command.startsOn
    || containsAsciiControlCharacters(code)) {
    throw new Error('The academic period request is invalid.')
  }
  return { ...command, code }
}

function normalizeCalendarDraftCommand(command: AcademicCalendarDraftCommand): AcademicCalendarDraftCommand {
  if (!isRecord(command) || !Array.isArray(command.activities) || command.activities.length > 200) {
    throw new Error('The academic calendar request is invalid.')
  }
  const officialReference = command.officialReference === null
    ? null
    : typeof command.officialReference === 'string' ? command.officialReference.trim() : ''
  if (officialReference !== null
    && (!isBoundedText(officialReference, 240) || containsAsciiControlCharacters(officialReference))) {
    throw new Error('The academic calendar reference is invalid.')
  }
  const activities = command.activities.map((activity) => {
    if (!isRecord(activity)) throw new Error('The academic calendar activity is invalid.')
    const key = typeof activity.key === 'string' ? activity.key.trim().toLocaleUpperCase('en-US') : ''
    const label = typeof activity.label === 'string' ? activity.label.trim() : ''
    if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(key)
      || !isBoundedText(label, 160)
      || containsAsciiControlCharacters(label)
      || !isLocalDateTime(activity.startsAt) || !isLocalDateTime(activity.endsAt)
      || activity.endsAt < activity.startsAt
      || !(activity.organizationUnitId === null || isUuid(activity.organizationUnitId))
      || !(activity.siteId === null || isUuid(activity.siteId))) {
      throw new Error('The academic calendar activity is invalid.')
    }
    return { ...activity, key, label } as AcademicCalendarActivity
  })
  if (new Set(activities.map(({ key }) => key)).size !== activities.length) {
    throw new Error('Academic calendar activity keys must be unique.')
  }
  return { officialReference, activities }
}

function normalizePeriodApprovalCommand(command: AcademicPeriodApprovalCommand): AcademicPeriodApprovalCommand {
  if (!isRecord(command) || !isUuid(command.calendarRevisionId)) {
    throw new Error('The academic period approval request is invalid.')
  }
  const approvalReference = typeof command.approvalReference === 'string' ? command.approvalReference.trim() : ''
  if (!isBoundedText(approvalReference, 240) || containsAsciiControlCharacters(approvalReference)) {
    throw new Error('An institutional approval reference is required and must be valid.')
  }
  return { calendarRevisionId: command.calendarRevisionId, approvalReference }
}

function periodCalendarPath(periodId: string): string {
  if (!isUuid(periodId)) throw malformedResponse()
  return '/api/v1/admin/academic-periods/' + periodId.toLowerCase() + '/calendars'
}

function periodCalendarActionPath(periodId: string, revisionId: string): string {
  if (!isUuid(periodId) || !isUuid(revisionId)) throw malformedResponse()
  return periodCalendarPath(periodId) + '/' + revisionId.toLowerCase() + '/publish'
}

function periodApprovalPath(periodId: string): string {
  if (!isUuid(periodId)) throw malformedResponse()
  return '/api/v1/admin/academic-periods/' + periodId.toLowerCase() + '/approve'
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

function isLocalDateTime(input: unknown): input is string {
  return typeof input === 'string'
    && /^\d{4}-\d\d-\d\dT(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?$/.test(input)
    && isDate(input.slice(0, 10))
}

function isOneOf<T extends string>(values: ReadonlySet<T>, input: unknown): input is T {
  return typeof input === 'string' && values.has(input as T)
}

function isPositiveInteger(input: unknown): input is number {
  return Number.isSafeInteger(input) && Number(input) > 0
}

