import { describe, expect, it, vi } from 'vitest'
const clientModules = import.meta.glob<typeof import('./academicCatalogClient')>('./academicCatalogClient.ts')

async function loadClient() {
  const loader = clientModules['./academicCatalogClient.ts']
  expect(loader, 'the typed academic catalog client is implemented').toBeTypeOf('function')
  return loader!()
}

const program = {
  id: 'f2ba149c-8910-49b3-aac7-48aa49fd104d',
  programCode: 'PRE-001',
  academicLevel: 'PREGRADO',
  studyModality: 'PRESENCIAL',
  sniesCode: '12345',
  campusCode: 'TUNJA',
  programName: 'Ingeniería de Prueba',
  faculty: 'Facultad de Prueba',
  campusName: 'Tunja',
}

const curriculum = {
  id: 'c376975f-016f-4a95-9279-bb50ff95bbd1',
  programId: program.id,
  programCode: program.programCode,
  academicLevel: 'PREGRADO',
  studyModality: 'PRESENCIAL',
  campusCode: 'TUNJA',
  programName: program.programName,
  faculty: program.faculty,
  campusName: program.campusName,
  curriculumVersion: '2026-A',
  cohortFrom: '2026-1',
  cohortThrough: null,
  approvalReference: 'Acuerdo de prueba',
  status: 'PUBLISHED',
  entryCount: 42,
  createdAt: '2026-01-10T10:00:00Z',
  publishedAt: '2026-01-11T10:00:00Z',
}

const entry = {
  subjectId: '9f7d9d63-c2bb-4424-85c1-63797065a35d',
  subjectRevisionId: '536f34ac-cbf7-4ba3-bc35-301c814d8f50',
  subjectCode: 'MAT-101',
  subjectName: 'Cálculo I',
  credits: 4,
  semester: 1,
  formationSpace: 'Disciplinar',
  component: 'Fundamentación',
  choiceGroup: null,
  rowOrder: 1,
}

const entryPage = {
  curriculumId: curriculum.id,
  page: 1,
  pageSize: 100,
  totalItems: 1,
  totalPages: 1,
  entries: [entry],
}

const importPreview = {
  programCode: 'PRE-001',
  academicLevel: 'PREGRADO',
  studyModality: 'PRESENCIAL',
  sniesCode: '12345',
  programName: 'Ingeniería de Prueba',
  faculty: 'Facultad de Prueba',
  campusCode: 'TUNJA',
  campusName: 'Tunja',
  curriculumVersion: '2026-A',
  cohortFrom: '2026-1',
  cohortThrough: null,
  approvalReference: 'Acuerdo de prueba',
  entryCount: 1,
  semesters: [1],
  sampleEntries: [{
    sourceRowNumber: 2,
    rowOrder: 1,
    semester: 1,
    subjectCode: 'MAT-101',
    subjectName: 'Cálculo I',
    credits: 4,
    formationSpace: 'Disciplinar',
    component: 'Fundamentación',
    choiceGroup: null,
  }],
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('academic catalog client', () => {
  it('loads and validates the public program catalog without sending credentials or cookies', async () => {
    // Arrange
    const { createAcademicCatalogClient } = await loadClient()
    const fetcher = vi.fn().mockResolvedValue(jsonResponse([program]))
    const client = createAcademicCatalogClient(fetcher)

    // Act
    const result = await client.listPrograms()

    // Assert
    expect(result[0]).toMatchObject({ id: program.id, programName: program.programName })
    expect(fetcher).toHaveBeenCalledWith('/api/v1/academic-catalog/programs', {
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    })
  })

  it('parses_public_curriculum_metadata_without_entries', async () => {
    // Arrange
    const { createAcademicCatalogClient } = await loadClient()
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(curriculum))
    const client = createAcademicCatalogClient(fetcher)
    const getPublishedCurriculum = Reflect.get(client, 'getPublishedCurriculum') as
      | ((id: string, signal?: AbortSignal) => Promise<typeof curriculum>)
      | undefined

    // Act
    expect(getPublishedCurriculum, 'public curriculum detail query is available').toBeTypeOf('function')
    const result = await getPublishedCurriculum!(curriculum.id)

    // Assert
    expect(result).toEqual(curriculum)
    expect(fetcher).toHaveBeenCalledWith(`/api/v1/academic-catalog/curricula/${curriculum.id}`, {
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    })
  })

  it('requests_public_curriculum_entries_with_encoded_filters', async () => {
    // Arrange
    const { createAcademicCatalogClient } = await loadClient()
    const response = { ...entryPage, page: 2, pageSize: 25, totalItems: 26, totalPages: 2 }
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(response))
    const client = createAcademicCatalogClient(fetcher)
    const listEntries = Reflect.get(client, 'listPublishedCurriculumEntries') as
      | ((id: string, query: { page: number; pageSize: number; search: string; semester: number }, signal?: AbortSignal) => Promise<unknown>)
      | undefined
    const controller = new AbortController()

    // Act + Assert
    expect(listEntries, 'bounded public entries page query is available').toBeTypeOf('function')
    if (!listEntries) return
    const result = await listEntries(curriculum.id, {
      page: 2,
      pageSize: 25,
      search: 'Cálculo A%_!',
      semester: 7,
    }, controller.signal)

    expect(result).toEqual(response)
    expect(fetcher).toHaveBeenCalledWith(
      `/api/v1/academic-catalog/curricula/${curriculum.id}/entries?page=2&pageSize=25&search=C%C3%A1lculo+A%25_%21&semester=7`,
      {
        credentials: 'omit',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      },
    )
  })

  it('parses_bounded_entry_pages', async () => {
    // Arrange
    const { createAcademicCatalogClient } = await loadClient()
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(entryPage))
    const client = createAcademicCatalogClient(fetcher)
    const listEntries = Reflect.get(client, 'listPublishedCurriculumEntries') as
      | ((id: string, query: { page: number; pageSize: number; search: string; semester?: number }) => Promise<unknown>)
      | undefined

    // Act + Assert
    expect(listEntries, 'bounded public entries page query is available').toBeTypeOf('function')
    if (!listEntries) return
    await expect(listEntries(curriculum.id, { page: 1, pageSize: 100, search: '' })).resolves.toEqual(entryPage)
  })

  it.each([
    ['malformed curriculum id', { ...entryPage, curriculumId: '../draft' }],
    ['negative item count', { ...entryPage, totalItems: -1 }],
    ['inconsistent page count', { ...entryPage, totalPages: 2 }],
    ['invalid page number', { ...entryPage, page: 0 }],
    ['oversized page size', { ...entryPage, pageSize: 101 }],
    ['too many page entries', { ...entryPage, entries: Array.from({ length: 101 }, (_, index) => ({ ...entry, rowOrder: index + 1 })) }],
  ])('rejects_malformed_or_oversized_page_responses (%s)', async (_case, response) => {
    // Arrange
    const { createAcademicCatalogClient } = await loadClient()
    const client = createAcademicCatalogClient(vi.fn().mockResolvedValue(jsonResponse(response)))
    const listEntries = Reflect.get(client, 'listPublishedCurriculumEntries') as
      | ((id: string, query: { page: number; pageSize: number; search: string; semester?: number }) => Promise<unknown>)
      | undefined

    // Act + Assert
    expect(listEntries, 'bounded public entries page query is available').toBeTypeOf('function')
    if (!listEntries) return
    await expect(listEntries(curriculum.id, { page: 1, pageSize: 100, search: '' })).rejects.toThrow('malformed')
  })

  it('sends the institutional bearer token for protected draft reads and reviews', async () => {
    // Arrange
    const { createAcademicCatalogClient } = await loadClient()
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        pageSize: 25,
        totalItems: 1,
        nextCursor: null,
        drafts: [{ ...curriculum, status: 'DRAFT', publishedAt: null }],
      }))
      .mockResolvedValueOnce(jsonResponse({ curriculum, entries: [] }))
    const client = createAcademicCatalogClient(fetcher)

    // Act
    await client.listDrafts('institutional-token', { pageSize: 25 })
    await client.getCurriculum(curriculum.id, 'institutional-token')

    // Assert
    expect(fetcher).toHaveBeenNthCalledWith(1, '/api/v1/admin/academic-catalog/drafts?pageSize=25', {
      credentials: 'omit',
      headers: { Accept: 'application/json', Authorization: 'Bearer institutional-token' },
    })
    expect(fetcher).toHaveBeenNthCalledWith(2,
      `/api/v1/admin/academic-catalog/curricula/${curriculum.id}`,
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer institutional-token' }) }),
    )
  })

  it('requests and parses one bounded page of administrative drafts', async () => {
    // Arrange
    const { createAcademicCatalogClient } = await loadClient()
    const draftPage = {
      pageSize: 10,
      totalItems: 11,
      nextCursor: null,
      drafts: [{ ...curriculum, status: 'DRAFT', publishedAt: null }],
    }
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(draftPage))
    const client = createAcademicCatalogClient(fetcher)

    // Act + Assert
    await expect(client.listDrafts('institutional-token', { pageSize: 10, after: 'cursor-from-page-1' }))
      .resolves.toEqual(draftPage)
    expect(fetcher).toHaveBeenCalledWith(
      '/api/v1/admin/academic-catalog/drafts?pageSize=10&after=cursor-from-page-1',
      expect.objectContaining({
        credentials: 'omit',
        headers: { Accept: 'application/json', Authorization: 'Bearer institutional-token' },
      }),
    )
  })

  it('rejects a published curriculum returned inside the protected draft queue', async () => {
    // Arrange
    const { createAcademicCatalogClient } = await loadClient()
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({
      pageSize: 25,
      totalItems: 1,
      nextCursor: null,
      drafts: [curriculum],
    }))
    const client = createAcademicCatalogClient(fetcher)

    // Act + Assert
    await expect(client.listDrafts('institutional-token', { pageSize: 25 }))
      .rejects.toThrow('malformed')
  })

  it('rejects an unsupported CSV media type before making a request', async () => {
    // Arrange
    const { createAcademicCatalogClient } = await loadClient()
    const fetcher = vi.fn()
    const client = createAcademicCatalogClient(fetcher)
    const file = new File(['content'], 'curriculum.csv', { type: 'application/pdf' })

    // Act
    const request = client.importCsv(file, 'institutional-token')

    // Assert
    await expect(request).rejects.toMatchObject({ code: 'unsupported_file_type' })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('rejects files above the server byte limit before upload', async () => {
    // Arrange
    const { createAcademicCatalogClient } = await loadClient()
    const fetcher = vi.fn()
    const client = createAcademicCatalogClient(fetcher)
    const file = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'curriculum.csv', { type: 'text/csv' })

    // Act
    const request = client.importCsv(file, 'institutional-token')

    // Assert
    await expect(request).rejects.toMatchObject({ code: 'file_too_large' })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('prevalidates a curriculum CSV through the protected no-write preview route', async () => {
    // Arrange
    const { createAcademicCatalogClient } = await loadClient()
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(importPreview))
    const client = createAcademicCatalogClient(fetcher)
    const file = new File(['curriculum'], 'curriculum.csv', { type: 'text/csv' })

    // Act
    const result = await client.previewCsv(file, 'institutional-token')

    // Assert
    expect(result).toMatchObject({
      programCode: 'PRE-001',
      entryCount: 1,
      semesters: [1],
      sampleEntries: [{ sourceRowNumber: 2, subjectName: 'Cálculo I' }],
    })
    expect(fetcher).toHaveBeenCalledWith('/api/v1/admin/academic-catalog/import-previews', expect.objectContaining({
      method: 'POST',
      credentials: 'omit',
      headers: { Accept: 'application/json', Authorization: 'Bearer institutional-token' },
      body: expect.any(FormData),
    }))
  })

  it('rejects malformed preview metadata rather than rendering unvalidated response values', async () => {
    // Arrange
    const { createAcademicCatalogClient } = await loadClient()
    const client = createAcademicCatalogClient(vi.fn().mockResolvedValue(jsonResponse({
      ...importPreview,
      entryCount: -1,
      semesters: ['all'],
    })))
    const file = new File(['curriculum'], 'curriculum.csv', { type: 'text/csv' })

    // Act + Assert
    await expect(client.previewCsv(file, 'institutional-token'))
      .rejects.toThrow('The academic catalog response is malformed.')
  })

  it('returns safe row and column issues from a rejected CSV without retaining cell values', async () => {
    // Arrange
    const { createAcademicCatalogClient, AcademicCatalogApiError } = await loadClient()
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({
      error: 'invalid_curriculum_csv',
      message: 'El CSV no cumple el contrato.',
      issues: [{ rowNumber: 7, column: 'credits', code: 'INVALID_DECIMAL' }],
    }, 400))
    const client = createAcademicCatalogClient(fetcher)
    const file = new File(['secret-cell-value'], 'curriculum.csv', { type: 'text/csv' })

    // Act
    const request = client.importCsv(file, 'institutional-token')

    // Assert
    await expect(request).rejects.toBeInstanceOf(AcademicCatalogApiError)
    await expect(request).rejects.toMatchObject({
      status: 400,
      code: 'invalid_curriculum_csv',
      issues: [{ rowNumber: 7, column: 'credits', code: 'invalid_decimal' }],
    })
    expect(fetcher).toHaveBeenCalledWith('/api/v1/admin/academic-catalog/imports', expect.objectContaining({
      method: 'POST',
      credentials: 'omit',
      headers: { Accept: 'application/json', Authorization: 'Bearer institutional-token' },
    }))
  })

  it.each([
    [403, 'forbidden'],
    [409, 'curriculum_conflict'],
  ])('preserves protected API response status %s for UI conflict handling', async (status, code) => {
    // Arrange
    const { createAcademicCatalogClient } = await loadClient()
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ error: code, message: 'Request rejected.', issues: [] }, status))
    const client = createAcademicCatalogClient(fetcher)

    // Act
    const request = client.publishCurriculum(curriculum.id, 'institutional-token')

    // Assert
    await expect(request).rejects.toMatchObject({ status, code })
  })

  it('rejects malformed catalog responses instead of rendering unvalidated API data', async () => {
    // Arrange
    const { createAcademicCatalogClient } = await loadClient()
    const client = createAcademicCatalogClient(vi.fn().mockResolvedValue(jsonResponse([{ ...program, id: '../bad' }])))

    // Act
    const request = client.listPrograms()

    // Assert
    await expect(request).rejects.toThrow('malformed')
  })
})
