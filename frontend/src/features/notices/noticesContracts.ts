export type NoticeAudienceKind = 'UNIVERSITY' | 'SITE' | 'FACULTY' | 'PROGRAM'

export interface NoticeAudience {
  kind: NoticeAudienceKind
  reference: string | null
}

/** What a reader receives: the content of a notice, never who issued it. */
export interface VisibleNotice {
  noticeId: string
  title: string
  body: string
  publishedFrom: string
  publishedThrough: string
  audiences: NoticeAudience[]
}
