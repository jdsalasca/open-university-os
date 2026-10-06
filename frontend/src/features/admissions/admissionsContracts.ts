export type AdmissionsMilestoneKind = 'application' | 'selection' | 'enrollment'

export interface AdmissionsCalendarSource {
  label: string
  url: string
}

export interface AdmissionsMilestone {
  id: string
  startsOn: string
  endsOn: string
  dateLabel: string
  title: string
  description: string
  kind: AdmissionsMilestoneKind
}

export interface PublicAdmissionsCalendar {
  title?: string
  callName: string
  revisionNumber?: number
  officialReference?: string
  updatedAt: string
  checkedAt: string
  source: AdmissionsCalendarSource
  confirmationSource: AdmissionsCalendarSource
  officialActSource?: AdmissionsCalendarSource
  sourceNote?: string
  milestones: readonly AdmissionsMilestone[]
}
