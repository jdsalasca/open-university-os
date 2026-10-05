export type AdmissionsMilestoneKind = 'APPLICATION' | 'SELECTION' | 'ENROLLMENT'
export type AdmissionsCallRevisionStatus = 'DRAFT' | 'PUBLISHED'

export interface AdmissionsSource {
  label: string
  url: string
}

export interface AdmissionsCallMilestone {
  key: string
  kind: AdmissionsMilestoneKind
  startsOn: string
  endsOn: string
  title: string
  description: string
}

export interface AdmissionsCallContent {
  title: string
  callName: string
  updatedAt: string
  checkedAt: string
  source: AdmissionsSource
  confirmationSource: AdmissionsSource
  milestones: readonly AdmissionsCallMilestone[]
}

export interface AdmissionsCallRevision {
  id: string
  revisionNumber: number
  draftVersion: number
  status: AdmissionsCallRevisionStatus
  content: AdmissionsCallContent
  officialReference: string | null
  publishedAt: string | null
}

export interface AdmissionsCallAdmin {
  id: string
  callKey: string
  currentPublishedRevisionId: string | null
  latestRevision: AdmissionsCallRevision
  publishedRevision: AdmissionsCallRevision | null
}

export interface PublicAdmissionsCall {
  callId: string
  callKey: string
  revisionId: string
  revisionNumber: number
  content: AdmissionsCallContent
  officialReference: string
  publishedAt: string
}

export interface CreateAdmissionsCallCommand {
  callKey: string
  content: AdmissionsCallContent
}

export interface PublishAdmissionsCallCommand {
  expectedDraftVersion: number
  expectedPublishedRevisionId: string | null
  officialReference: string
}

export interface AdmissionsCallClient {
  getPublicCalls(signal?: AbortSignal): Promise<PublicAdmissionsCall[]>
  getAdminCalls(accessToken: string, signal?: AbortSignal): Promise<AdmissionsCallAdmin[]>
  createCall(command: CreateAdmissionsCallCommand, accessToken: string, signal?: AbortSignal): Promise<AdmissionsCallAdmin>
  createRevision(callId: string, content: AdmissionsCallContent, accessToken: string, signal?: AbortSignal): Promise<AdmissionsCallRevision>
  updateDraft(callId: string, revisionId: string, expectedDraftVersion: number, content: AdmissionsCallContent,
    accessToken: string, signal?: AbortSignal): Promise<AdmissionsCallRevision>
  publish(callId: string, revisionId: string, command: PublishAdmissionsCallCommand,
    accessToken: string, signal?: AbortSignal): Promise<AdmissionsCallRevision>
}

export class AdmissionsCallApiError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`Admissions API request failed with status ${status}`)
    this.name = 'AdmissionsCallApiError'
    this.status = status
  }
}

export interface AdmissionsCalendarAuthorization {
  accessToken: string
  canRead: boolean
  canWrite: boolean
}
