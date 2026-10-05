import type { NoticeAudience } from './noticesContracts'

export interface AdminNotice {
  noticeId: string
  title: string
  body: string
  sourceReference: string
  publishedFrom: string
  publishedThrough: string
  audiences: NoticeAudience[]
  publishedBy: string
  publishedAt: string
}

export interface PublishNoticeInput {
  title: string
  body: string
  sourceReference: string
  publishedFrom: string
  publishedThrough: string
  audiences: NoticeAudience[]
}

export interface NoticesAdminAuthorization {
  accessToken: string
  canRead: boolean
  canWrite: boolean
}
