import type {
  AcademicCatalogClient,
  AcademicCurriculumDraftsPageQuery,
  AcademicCurriculumEntriesPageQuery,
  AcademicCatalogIssue,
  CurriculumImportPreview,
} from './contracts'
import {
  parseAcademicCurricula,
  parseAcademicCurriculumDraftsPage,
  parseAcademicCurriculum,
  parseAcademicCurriculumDetails,
  parseAcademicCurriculumEntriesPage,
  parseAcademicPrograms,
  parseCurriculumImportPreview,
  validateCurriculumCsvFile,
} from './contracts'

export class AcademicCatalogApiError extends Error {
  readonly status: number
  readonly code: string
  readonly issues: readonly AcademicCatalogIssue[]

  constructor(
    status: number,
    code: string,
    message: string,
    issues: readonly AcademicCatalogIssue[],
  ) {
    super(message)
    this.name = 'AcademicCatalogApiError'
    this.status = status
    this.code = code
    this.issues = issues
  }
}

export function createAcademicCatalogClient(fetcher: typeof fetch = fetch): AcademicCatalogClient {
  return {
    async listPrograms(signal) {
      const response = await fetcher('/api/v1/academic-catalog/programs', requestOptions(undefined, signal))
      return parseAcademicPrograms(await responseBody(response))
    },

    async listCurricula(programId, signal) {
      const response = await fetcher(
        `/api/v1/academic-catalog/programs/${encodeURIComponent(programId)}/curricula`,
        requestOptions(undefined, signal),
      )
      return parseAcademicCurricula(await responseBody(response))
    },

    async getPublishedCurriculum(id, signal) {
      const response = await fetcher(
        `/api/v1/academic-catalog/curricula/${encodeURIComponent(id)}`,
        requestOptions(undefined, signal),
      )
      return parseAcademicCurriculum(await responseBody(response))
    },

    async listPublishedCurriculumEntries(id, query: AcademicCurriculumEntriesPageQuery, signal) {
      const parameters = new URLSearchParams({
        page: String(query.page),
        pageSize: String(query.pageSize),
      })
      if (query.search) parameters.set('search', query.search)
      if (query.semester !== undefined) parameters.set('semester', String(query.semester))

      const response = await fetcher(
        `/api/v1/academic-catalog/curricula/${encodeURIComponent(id)}/entries?${parameters.toString()}`,
        requestOptions(undefined, signal),
      )
      return parseAcademicCurriculumEntriesPage(await responseBody(response), id, query)
    },

    async listDrafts(accessToken, query: AcademicCurriculumDraftsPageQuery, signal) {
      const parameters = new URLSearchParams({ pageSize: String(query.pageSize) })
      if (query.after !== undefined) parameters.set('after', query.after)
      const response = await fetcher(
        `/api/v1/admin/academic-catalog/drafts?${parameters.toString()}`,
        requestOptions(accessToken, signal),
      )
      return parseAcademicCurriculumDraftsPage(await responseBody(response), query)
    },

    async getCurriculum(id, accessToken, signal) {
      const response = await fetcher(
        `/api/v1/admin/academic-catalog/curricula/${encodeURIComponent(id)}`,
        requestOptions(accessToken, signal),
      )
      return parseAcademicCurriculumDetails(await responseBody(response))
    },

    async importCsv(file, accessToken, signal) {
      return parseAcademicCurriculum(await uploadCsv(
        fetcher, '/api/v1/admin/academic-catalog/imports', file, accessToken, signal,
      ))
    },

    async previewCsv(file, accessToken, signal): Promise<CurriculumImportPreview> {
      return parseCurriculumImportPreview(await uploadCsv(
        fetcher, '/api/v1/admin/academic-catalog/import-previews', file, accessToken, signal,
      ))
    },

    async publishCurriculum(id, accessToken, signal) {
      const response = await fetcher(
        `/api/v1/admin/academic-catalog/curricula/${encodeURIComponent(id)}/publish`,
        requestOptions(accessToken, signal, { method: 'POST' }),
      )
      return parseAcademicCurriculumDetails(await responseBody(response))
    },
  }
}

export const academicCatalogClient = createAcademicCatalogClient()

async function uploadCsv(
  fetcher: typeof fetch,
  path: string,
  file: File,
  accessToken: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const fileError = validateCurriculumCsvFile(file)
  if (fileError) throw new AcademicCatalogApiError(fileError.status, fileError.code, fileError.message, [])
  const body = new FormData()
  body.append('file', file)
  const response = await fetcher(path, requestOptions(accessToken, signal, { method: 'POST', body }))
  return responseBody(response)
}

function requestOptions(accessToken?: string, signal?: AbortSignal, overrides: RequestInit = {}): RequestInit {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (accessToken !== undefined) {
    if (!accessToken.trim()) {
      throw new AcademicCatalogApiError(401, 'unauthorized', 'Se requiere acceso institucional.', [])
    }
    headers.Authorization = `Bearer ${accessToken}`
  }

  return {
    credentials: 'omit',
    headers,
    ...(signal ? { signal } : {}),
    ...overrides,
  }
}

async function responseBody(response: Response): Promise<unknown> {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    if (response.ok) throw new Error('The academic catalog response is malformed.')
    body = null
  }

  if (!response.ok) {
    const errorBody = isRecord(body) ? body : {}
    const error = typeof errorBody.error === 'string' ? errorBody.error : `http_${response.status}`
    const message = typeof errorBody.message === 'string' ? errorBody.message : 'No se pudo completar la solicitud.'
    const issues = Array.isArray(errorBody.issues) ? errorBody.issues.flatMap(parseIssue) : []
    throw new AcademicCatalogApiError(response.status, error, message, issues)
  }

  return body
}

function parseIssue(input: unknown): AcademicCatalogIssue[] {
  if (!isRecord(input)) return []
  const rowNumber = input.rowNumber === null || Number.isSafeInteger(input.rowNumber) ? input.rowNumber as number | null : null
  const column = input.column === null || typeof input.column === 'string' ? input.column as string | null : null
  const code = typeof input.code === 'string' && /^[a-z0-9_]{1,64}$/i.test(input.code) ? input.code.toLocaleLowerCase('en-US') : null
  if (!code) return []
  return [{ rowNumber, column, code }]
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
}
