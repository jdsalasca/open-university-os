export type AcademicLevel = 'PREGRADO'
export type StudyModality = 'PRESENCIAL'
export type AcademicCurriculumStatus = 'DRAFT' | 'PUBLISHED'
export type AcademicCatalogPermission = 'academic:catalog:read' | 'academic:catalog:write'

export interface AcademicProgram {
  id: string
  programCode: string
  academicLevel: AcademicLevel
  studyModality: StudyModality
  campusCode: string
  programName: string
  faculty: string
  campusName: string
}

export interface AcademicCurriculum {
  id: string
  programId: string
  programCode: string
  academicLevel: AcademicLevel
  studyModality: StudyModality
  campusCode: string
  programName: string
  faculty: string
  campusName: string
  curriculumVersion: string
  cohortFrom: string
  cohortThrough: string | null
  approvalReference: string
  status: AcademicCurriculumStatus
  entryCount: number
  createdAt: string
  publishedAt: string | null
}

export interface AcademicCurriculumEntry {
  subjectId: string
  subjectRevisionId: string
  subjectCode: string
  subjectName: string
  credits: number
  semester: number
  formationSpace: string
  component: string
  choiceGroup: string | null
  rowOrder: number
}

export interface AcademicCurriculumDetails {
  curriculum: AcademicCurriculum
  entries: AcademicCurriculumEntry[]
}

export interface AcademicCurriculumEntriesPage {
  curriculumId: string
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  entries: AcademicCurriculumEntry[]
}

export interface AcademicCurriculumDraftsPage {
  pageSize: number
  totalItems: number
  drafts: AcademicCurriculum[]
  nextCursor: string | null
}

export interface AcademicCurriculumDraftsPageQuery {
  pageSize: number
  after?: string
}

export interface AcademicCurriculumEntriesPageQuery {
  page: number
  pageSize: number
  search: string
  semester?: number
}

export interface CurriculumImportPreviewEntry {
  sourceRowNumber: number
  rowOrder: number
  semester: number
  subjectCode: string
  subjectName: string
  credits: number
  formationSpace: string
  component: string
  choiceGroup: string | null
}

export type CurriculumVersionComparisonChangedField =
  | 'NAME'
  | 'CREDITS'
  | 'SEMESTER'
  | 'ORDER'
  | 'FORMATION_SPACE'
  | 'COMPONENT'
  | 'CHOICE_GROUP'

export interface CurriculumVersionComparisonSample {
  subjectCode: string
  subjectName?: string
  semester?: number
  changedFields: CurriculumVersionComparisonChangedField[]
}

export interface CurriculumVersionComparisonReference {
  curriculumId: string
  curriculumVersion: string
  cohortFrom: string
  cohortThrough: string | null
  publishedAt: string
}

export interface CurriculumVersionComparisonCounts {
  added: number
  removed: number
  modified: number
  unchanged: number
}

export type CurriculumVersionComparison =
  | {
    status: 'NO_REFERENCE'
    reference: null
    counts: null
    addedSamples: CurriculumVersionComparisonSample[]
    removedSamples: CurriculumVersionComparisonSample[]
    modifiedSamples: CurriculumVersionComparisonSample[]
    unchangedSamples: CurriculumVersionComparisonSample[]
  }
  | {
    status: 'COMPARED'
    reference: CurriculumVersionComparisonReference
    counts: CurriculumVersionComparisonCounts
    addedSamples: CurriculumVersionComparisonSample[]
    removedSamples: CurriculumVersionComparisonSample[]
    modifiedSamples: CurriculumVersionComparisonSample[]
    unchangedSamples: CurriculumVersionComparisonSample[]
  }

export interface CurriculumImportPreview {
  programCode: string
  academicLevel: AcademicLevel
  studyModality: StudyModality
  sniesCode: string | null
  programName: string
  faculty: string
  campusCode: string
  campusName: string
  curriculumVersion: string
  cohortFrom: string
  cohortThrough: string | null
  approvalReference: string
  entryCount: number
  semesters: number[]
  sampleEntries: CurriculumImportPreviewEntry[]
  comparison?: CurriculumVersionComparison
}

export const MAX_PUBLIC_CURRICULUM_PAGE_SIZE = 100
export const MAX_PUBLIC_CURRICULUM_SEARCH_CODE_POINTS = 120
export const DEFAULT_ADMIN_DRAFT_PAGE_SIZE = 25
export const MAX_ADMIN_DRAFT_PAGE_SIZE = 100

export interface AcademicCatalogIssue {
  rowNumber: number | null
  column: string | null
  code: string
}

export interface CatalogAuthorization {
  accessToken: string
  permissions: readonly AcademicCatalogPermission[]
}

export interface AcademicCatalogClient {
  listPrograms(signal?: AbortSignal): Promise<AcademicProgram[]>
  listCurricula(programId: string, signal?: AbortSignal): Promise<AcademicCurriculum[]>
  getPublishedCurriculum(id: string, signal?: AbortSignal): Promise<AcademicCurriculum>
  listPublishedCurriculumEntries(
    id: string,
    query: AcademicCurriculumEntriesPageQuery,
    signal?: AbortSignal
  ): Promise<AcademicCurriculumEntriesPage>
  listDrafts(
    accessToken: string,
    query: AcademicCurriculumDraftsPageQuery,
    signal?: AbortSignal
  ): Promise<AcademicCurriculumDraftsPage>
  getCurriculum(id: string, accessToken: string, signal?: AbortSignal): Promise<AcademicCurriculumDetails>
  previewCsv(file: File, accessToken: string, signal?: AbortSignal): Promise<CurriculumImportPreview>
  importCsv(file: File, accessToken: string, signal?: AbortSignal): Promise<AcademicCurriculum>
  publishCurriculum(id: string, accessToken: string, signal?: AbortSignal): Promise<AcademicCurriculumDetails>
}

export const MAX_CURRICULUM_CSV_BYTES = 2 * 1024 * 1024

export interface CurriculumCsvFileError {
  status: number
  code: 'unsupported_file_type' | 'file_too_large' | 'empty_file'
  message: string
}

export function validateCurriculumCsvFile(file: File): CurriculumCsvFileError | null {
  if (!file.name.toLocaleLowerCase('en-US').endsWith('.csv')
    || !['', 'text/csv', 'application/vnd.ms-excel'].includes(file.type.toLocaleLowerCase('en-US'))) {
    return { status: 400, code: 'unsupported_file_type', message: 'Selecciona un archivo con formato CSV.' }
  }
  if (file.size > MAX_CURRICULUM_CSV_BYTES) {
    return { status: 413, code: 'file_too_large', message: 'El archivo debe pesar como máximo 2 MiB.' }
  }
  if (file.size === 0) {
    return { status: 400, code: 'empty_file', message: 'El archivo CSV está vacío.' }
  }
  return null
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PROGRAM_CODE_PATTERN = /^[A-Z0-9][A-Z0-9._-]{0,63}$/
const COHORT_PATTERN = /^\d{4}-[12]$/

export function parseAcademicPrograms(input: unknown): AcademicProgram[] {
  if (!Array.isArray(input)) throw malformedResponse()
  return input.map((item) => {
    if (!isRecord(item)
      || !isUuid(item.id)
      || !isProgramCode(item.programCode)
      || item.academicLevel !== 'PREGRADO'
      || item.studyModality !== 'PRESENCIAL'
      || !isProgramCode(item.campusCode)
      || !isBoundedText(item.programName, 240)
      || !isBoundedText(item.faculty, 160)
      || !isBoundedText(item.campusName, 160)) throw malformedResponse()

    return {
      id: item.id,
      programCode: item.programCode,
      academicLevel: 'PREGRADO',
      studyModality: 'PRESENCIAL',
      campusCode: item.campusCode,
      programName: item.programName,
      faculty: item.faculty,
      campusName: item.campusName,
    }
  })
}

export function parseAcademicCurricula(input: unknown): AcademicCurriculum[] {
  if (!Array.isArray(input)) throw malformedResponse()
  return input.map(parseAcademicCurriculum)
}

export function parseAcademicCurriculumDraftsPage(
  input: unknown,
  query: AcademicCurriculumDraftsPageQuery,
): AcademicCurriculumDraftsPage {
  if (!Number.isSafeInteger(query.pageSize)
    || query.pageSize < 1
    || query.pageSize > MAX_ADMIN_DRAFT_PAGE_SIZE
    || (query.after !== undefined
      && (typeof query.after !== 'string' || query.after.length === 0 || query.after.length > 256))
    || !isRecord(input)
    || !Number.isSafeInteger(input.pageSize)
    || input.pageSize !== query.pageSize
    || !isNonNegativeInteger(input.totalItems)
    || !Array.isArray(input.drafts)
    || input.drafts.length > input.pageSize
    || !(input.nextCursor === null
      || (typeof input.nextCursor === 'string'
        && input.nextCursor.length > 0
        && input.nextCursor.length <= 256
        && input.drafts.length === input.pageSize))) throw malformedResponse()

  const drafts = input.drafts.map(parseAcademicCurriculum)
  if (drafts.some((draft) => draft.status !== 'DRAFT')) throw malformedResponse()

  return {
    pageSize: input.pageSize,
    totalItems: input.totalItems,
    drafts,
    nextCursor: input.nextCursor,
  }
}

export function parseAcademicCurriculumDetails(input: unknown): AcademicCurriculumDetails {
  if (!isRecord(input) || !Array.isArray(input.entries)) throw malformedResponse()
  return {
    curriculum: parseAcademicCurriculum(input.curriculum),
    entries: input.entries.map(parseAcademicCurriculumEntry),
  }
}

export function parseAcademicCurriculumEntriesPage(
  input: unknown,
  expectedCurriculumId: string,
  query: AcademicCurriculumEntriesPageQuery
): AcademicCurriculumEntriesPage {
  if (!isUuid(expectedCurriculumId)
    || !isRecord(input)
    || !isUuid(input.curriculumId)
    || input.curriculumId.toLocaleLowerCase('en-US') !== expectedCurriculumId.toLocaleLowerCase('en-US')
    || !Number.isSafeInteger(query.page)
    || query.page < 1
    || query.page > 2_147_483_647
    || !Number.isSafeInteger(query.pageSize)
    || query.pageSize < 1
    || query.pageSize > MAX_PUBLIC_CURRICULUM_PAGE_SIZE
    || !Number.isSafeInteger(input.page)
    || input.page !== query.page
    || !Number.isSafeInteger(input.pageSize)
    || input.pageSize !== query.pageSize
    || !isNonNegativeInteger(input.totalItems)
    || !isNonNegativeInteger(input.totalPages)
    || input.totalPages !== (input.totalItems === 0 ? 0 : Math.ceil(input.totalItems / input.pageSize))
    || !Array.isArray(input.entries)
    || input.entries.length > input.pageSize
    || input.entries.length > input.totalItems) throw malformedResponse()

  return {
    curriculumId: input.curriculumId,
    page: input.page,
    pageSize: input.pageSize,
    totalItems: input.totalItems,
    totalPages: input.totalPages,
    entries: input.entries.map(parseAcademicCurriculumEntry),
  }
}

export async function parseCurriculumImportPreview(input: unknown): Promise<CurriculumImportPreview> {
  if (!isRecord(input)
    || !isProgramCode(input.programCode)
    || input.academicLevel !== 'PREGRADO'
    || input.studyModality !== 'PRESENCIAL'
    || !(input.sniesCode === null || isBoundedText(input.sniesCode, 32))
    || !isBoundedText(input.programName, 240)
    || !isBoundedText(input.faculty, 160)
    || !isProgramCode(input.campusCode)
    || !isBoundedText(input.campusName, 160)
    || !isBoundedText(input.curriculumVersion, 80)
    || !isCohort(input.cohortFrom)
    || !(input.cohortThrough === null || isCohort(input.cohortThrough))
    || !isBoundedText(input.approvalReference, 240)
    || !isPositiveInteger(input.entryCount)
    || !Array.isArray(input.semesters)
    || !Array.isArray(input.sampleEntries)
    || input.sampleEntries.length === 0
    || input.sampleEntries.length > Math.min(10, input.entryCount)) throw malformedResponse()

  const semesters = input.semesters
  if (semesters.length === 0
    || semesters.length > input.entryCount
    || !semesters.every((semester, index) => Number.isInteger(semester)
      && Number(semester) >= 1
      && Number(semester) <= 32767
      && (index === 0 || Number(semester) > Number(semesters[index - 1])))) throw malformedResponse()

  const sampleEntries = input.sampleEntries.map(parseCurriculumImportPreviewEntry)
  if (sampleEntries.some((entry) => !semesters.includes(entry.semester))) throw malformedResponse()
  const entryCount = input.entryCount
  const comparisonInput = input.comparison
  const comparison = comparisonInput === undefined
    ? undefined
    : await import('./curriculumVersionComparisonContract')
      .then(({ parseCurriculumVersionComparison }) => parseCurriculumVersionComparison(comparisonInput, entryCount))

  return {
    programCode: input.programCode,
    academicLevel: 'PREGRADO',
    studyModality: 'PRESENCIAL',
    sniesCode: input.sniesCode,
    programName: input.programName,
    faculty: input.faculty,
    campusCode: input.campusCode,
    campusName: input.campusName,
    curriculumVersion: input.curriculumVersion,
    cohortFrom: input.cohortFrom,
    cohortThrough: input.cohortThrough,
    approvalReference: input.approvalReference,
    entryCount: input.entryCount,
    semesters: [...semesters],
    sampleEntries,
    ...(comparison === undefined ? {} : { comparison }),
  }
}

export function parseAcademicCurriculum(input: unknown): AcademicCurriculum {
  if (!isRecord(input)
    || !isUuid(input.id)
    || !isUuid(input.programId)
    || !isProgramCode(input.programCode)
    || input.academicLevel !== 'PREGRADO'
    || input.studyModality !== 'PRESENCIAL'
    || !isProgramCode(input.campusCode)
    || !isBoundedText(input.programName, 240)
    || !isBoundedText(input.faculty, 160)
    || !isBoundedText(input.campusName, 160)
    || !isBoundedText(input.curriculumVersion, 80)
    || !isCohort(input.cohortFrom)
    || !(input.cohortThrough === null || isCohort(input.cohortThrough))
    || !isBoundedText(input.approvalReference, 240)
    || (input.status !== 'DRAFT' && input.status !== 'PUBLISHED')
    || !isNonNegativeInteger(input.entryCount)
    || !isIsoInstant(input.createdAt)
    || !(input.publishedAt === null || isIsoInstant(input.publishedAt))) throw malformedResponse()

  return {
    id: input.id,
    programId: input.programId,
    programCode: input.programCode,
    academicLevel: 'PREGRADO',
    studyModality: 'PRESENCIAL',
    campusCode: input.campusCode,
    programName: input.programName,
    faculty: input.faculty,
    campusName: input.campusName,
    curriculumVersion: input.curriculumVersion,
    cohortFrom: input.cohortFrom,
    cohortThrough: input.cohortThrough,
    approvalReference: input.approvalReference,
    status: input.status,
    entryCount: input.entryCount,
    createdAt: input.createdAt,
    publishedAt: input.publishedAt,
  }
}

function parseAcademicCurriculumEntry(input: unknown): AcademicCurriculumEntry {
  if (!isRecord(input)
    || !isUuid(input.subjectId)
    || !isUuid(input.subjectRevisionId)
    || !isProgramCode(input.subjectCode)
    || !isBoundedText(input.subjectName, 240)
    || typeof input.credits !== 'number'
    || !Number.isFinite(input.credits)
    || input.credits <= 0
    || input.credits > 999.99
    || !Number.isInteger(input.semester)
    || Number(input.semester) < 1
    || Number(input.semester) > 32767
    || !isBoundedText(input.formationSpace, 120)
    || !isBoundedText(input.component, 120)
    || !(input.choiceGroup === null || isBoundedText(input.choiceGroup, 100))
    || !Number.isSafeInteger(input.rowOrder)
    || Number(input.rowOrder) < 1) throw malformedResponse()

  return {
    subjectId: input.subjectId,
    subjectRevisionId: input.subjectRevisionId,
    subjectCode: input.subjectCode,
    subjectName: input.subjectName,
    credits: input.credits,
    semester: Number(input.semester),
    formationSpace: input.formationSpace,
    component: input.component,
    choiceGroup: input.choiceGroup,
    rowOrder: Number(input.rowOrder),
  }
}

function parseCurriculumImportPreviewEntry(input: unknown): CurriculumImportPreviewEntry {
  if (!isRecord(input)
    || !Number.isSafeInteger(input.sourceRowNumber)
    || Number(input.sourceRowNumber) < 2
    || !Number.isSafeInteger(input.rowOrder)
    || Number(input.rowOrder) < 1
    || !Number.isInteger(input.semester)
    || Number(input.semester) < 1
    || Number(input.semester) > 32767
    || !isProgramCode(input.subjectCode)
    || !isBoundedText(input.subjectName, 240)
    || typeof input.credits !== 'number'
    || !Number.isFinite(input.credits)
    || input.credits <= 0
    || input.credits > 999.99
    || !isBoundedText(input.formationSpace, 120)
    || !isBoundedText(input.component, 120)
    || !(input.choiceGroup === null || isBoundedText(input.choiceGroup, 100))) throw malformedResponse()

  return {
    sourceRowNumber: Number(input.sourceRowNumber),
    rowOrder: Number(input.rowOrder),
    semester: Number(input.semester),
    subjectCode: input.subjectCode,
    subjectName: input.subjectName,
    credits: input.credits,
    formationSpace: input.formationSpace,
    component: input.component,
    choiceGroup: input.choiceGroup,
  }
}

export function malformedResponse() {
  return new Error('The academic catalog response is malformed.')
}

export function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
}

export function isUuid(input: unknown): input is string {
  return typeof input === 'string' && UUID_PATTERN.test(input)
}

export function isProgramCode(input: unknown): input is string {
  return typeof input === 'string' && PROGRAM_CODE_PATTERN.test(input)
}

export function isBoundedText(input: unknown, maxLength: number): input is string {
  return typeof input === 'string' && input.trim().length > 0 && [...input].length <= maxLength
}

export function isCohort(input: unknown): input is string {
  return typeof input === 'string' && COHORT_PATTERN.test(input)
}

export function isNonNegativeInteger(input: unknown): input is number {
  return Number.isSafeInteger(input) && Number(input) >= 0
}

function isPositiveInteger(input: unknown): input is number {
  return Number.isSafeInteger(input) && Number(input) > 0
}

export function isIsoInstant(input: unknown): input is string {
  return typeof input === 'string' && /^\d{4}-\d\d-\d\dT/.test(input) && Number.isFinite(Date.parse(input))
}
