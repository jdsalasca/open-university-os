import type { AcademicPeriodKind } from './academicOperationsContracts'

export type AcademicOfferingDraftAuditAction = 'OFFERING_DRAFT_CREATED' | 'OFFERING_DRAFT_UPDATED'

export interface AcademicOfferingDraft {
  id: string
  periodId: string
  periodCode: string
  periodKind: AcademicPeriodKind
  curriculumId: string
  curriculumVersion: string
  programCode: string
  programName: string
  subjectId: string
  subjectCode: string
  subjectName: string
  sectionCode: string
  startsOn: string
  endsOn: string
  proposedCapacity: number
  version: number
  status: 'DRAFT'
  sourceReference: string
  updatedBy: string
  createdAt: string
  updatedAt: string
}

export interface AcademicOfferingDraftQuery {
  limit?: number
  before?: string
}

export interface AcademicOfferingDraftPage {
  drafts: AcademicOfferingDraft[]
  nextCursor: string | null
}

export interface AcademicOfferingDraftCommand {
  periodId: string
  curriculumId: string
  subjectId: string
  sectionCode: string
  startsOn: string
  endsOn: string
  proposedCapacity: number
  sourceReference: string
}

export interface AcademicOfferingDraftUpdateCommand {
  expectedVersion: number
  sectionCode: string
  startsOn: string
  endsOn: string
  proposedCapacity: number
  sourceReference: string
}

export interface AcademicOfferingDraftReceipt {
  id: string
  version: number
  status: 'DRAFT'
}

export interface AcademicOfferingDraftSnapshot {
  sectionCode: string
  startsOn: string
  endsOn: string
  proposedCapacity: number
  version: number
}

export interface AcademicOfferingDraftAuditEvent {
  id: number
  offeringId: string
  actionKey: AcademicOfferingDraftAuditAction
  actor: string
  occurredAt: string
  sourceReference: string
  before: AcademicOfferingDraftSnapshot | null
  after: AcademicOfferingDraftSnapshot
}

export interface AcademicOfferingAuditPage {
  events: AcademicOfferingDraftAuditEvent[]
  nextCursor: string | null
}

export interface AcademicOfferingDraftClient {
  listDrafts(periodId: string, query: AcademicOfferingDraftQuery, accessToken: string,
    signal?: AbortSignal): Promise<AcademicOfferingDraftPage>
  createDraft(command: AcademicOfferingDraftCommand, accessToken: string,
    signal?: AbortSignal): Promise<AcademicOfferingDraftReceipt>
  updateDraft(offeringId: string, command: AcademicOfferingDraftUpdateCommand, accessToken: string,
    signal?: AbortSignal): Promise<AcademicOfferingDraftReceipt>
  listAuditEvents(offeringId: string, query: AcademicOfferingDraftQuery, accessToken: string,
    signal?: AbortSignal): Promise<AcademicOfferingAuditPage>
}

export interface AcademicOfferingAuthorization {
  accessToken: string
  canRead: boolean
  canWrite: boolean
}
