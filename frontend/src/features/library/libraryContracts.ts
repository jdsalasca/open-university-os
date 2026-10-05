export interface LibraryTitle {
  titleId: string
  title: string
  authors: string[]
  edition: string
  publicationYear: number | null
  sourceReference: string
}

export interface LibraryCopy {
  copyId: string
  titleId: string
  barcode: string
  location: string
  active: boolean
  withdrawnBy: string | null
  withdrawnReference: string | null
  withdrawnAt: string | null
}

export interface LibraryLoan {
  loanId: string
  copyId: string
  borrowerUserId: string
  lentOn: string
  dueOn: string
  returnedOn: string | null
  overdue: boolean
  sourceReference: string
}

export interface LibraryAuthorization {
  accessToken: string
  canRead: boolean
  canWrite: boolean
}

export interface RegisterLibraryTitleInput {
  title: string
  authors: string[]
  edition: string
  publicationYear: number | null
  sourceReference: string
}

export interface RegisterLibraryCopyInput {
  barcode: string
  location: string
  sourceReference: string
}
