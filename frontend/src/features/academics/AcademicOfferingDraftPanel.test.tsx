import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AcademicCatalogClient, AcademicCurriculum, AcademicProgram } from './contracts'
import type { AcademicPeriod } from './academicOperationsContracts'
import type { AcademicOfferingAuthorization, AcademicOfferingDraft, AcademicOfferingDraftClient } from './academicOfferingDraftContracts'

const panelModules = import.meta.glob<typeof import('./AcademicOfferingDraftPanel')>('./AcademicOfferingDraftPanel.tsx')

async function loadPanel() {
  const loader = panelModules['./AcademicOfferingDraftPanel.tsx']
  expect(loader, 'the academic offering draft panel is implemented').toBeTypeOf('function')
  return loader!()
}

afterEach(() => cleanup())

const period: AcademicPeriod = {
  id: 'fb750786-79cc-49cf-9814-0f1047c76ba4', code: '2026-INT-1', kind: 'INTERSEMESTRAL',
  academicYear: 2026, sequenceNumber: 1, startsOn: '2026-06-01', endsOn: '2026-06-30',
  status: 'OPEN', calendarRevisionId: null, calendarRevisionNumber: null, approvalReference: null,
  officialReference: null, createdAt: '2026-05-01T10:00:00Z',
}

const program: AcademicProgram = {
  id: 'b31e24c4-4b0e-4b79-8480-ae5f26105646', programCode: 'ING-SIS', academicLevel: 'PREGRADO',
  studyModality: 'PRESENCIAL', campusCode: 'TUNJA', programName: 'Ingeniería de Sistemas',
  faculty: 'Facultad de Ingeniería', campusName: 'Tunja',
}

const curriculum: AcademicCurriculum = {
  id: 'c376975f-016f-4a95-9279-bb50ff95bbd1', programId: program.id, programCode: program.programCode,
  academicLevel: 'PREGRADO', studyModality: 'PRESENCIAL', campusCode: program.campusCode,
  programName: program.programName, faculty: program.faculty, campusName: program.campusName,
  curriculumVersion: '2024-v2', cohortFrom: '2024-1', cohortThrough: null, approvalReference: 'Acuerdo 01',
  status: 'PUBLISHED', entryCount: 1, createdAt: '2024-01-01T10:00:00Z', publishedAt: '2024-01-02T10:00:00Z',
}

const subject = {
  subjectId: '8ab62b62-b65b-4b70-9bf0-df868abfe7eb', subjectRevisionId: '34a06170-9acf-4718-854e-92e945a7db17',
  subjectCode: 'SIS-101', subjectName: 'Fundamentos de programación', credits: 3, semester: 1,
  formationSpace: 'Disciplinar', component: 'Fundamentación', choiceGroup: null, rowOrder: 1,
}

const offering: AcademicOfferingDraft = {
  id: 'b16116a1-10ba-4d79-839b-4195e4851d73', periodId: period.id, periodCode: period.code,
  periodKind: period.kind, curriculumId: curriculum.id, curriculumVersion: curriculum.curriculumVersion,
  programCode: program.programCode, programName: program.programName, subjectId: subject.subjectId,
  subjectCode: subject.subjectCode, subjectName: subject.subjectName, sectionCode: '01',
  startsOn: '2026-06-01', endsOn: '2026-06-30', proposedCapacity: 24, version: 1,
  status: 'DRAFT', sourceReference: 'Acta de coordinación 08', updatedBy: 'opaque-actor-1',
  createdAt: '2026-05-10T15:00:00Z', updatedAt: '2026-05-10T15:00:00Z',
}

const created = { id: offering.id, version: 1, status: 'DRAFT' as const }
const readAuthorization: AcademicOfferingAuthorization = { accessToken: 'access-token', canRead: true, canWrite: false }
const writeAuthorization: AcademicOfferingAuthorization = { ...readAuthorization, canWrite: true }

function createClients(drafts: AcademicOfferingDraft[] = []) {
  const client: AcademicOfferingDraftClient = {
    listDrafts: vi.fn().mockResolvedValue({ drafts, nextCursor: null }),
    createDraft: vi.fn().mockResolvedValue(created),
    updateDraft: vi.fn().mockResolvedValue({ ...created, version: 2 }),
    listAuditEvents: vi.fn().mockResolvedValue({ events: [], nextCursor: null }),
  }
  const catalogClient: Pick<AcademicCatalogClient, 'listCurricula' | 'listPublishedCurriculumEntries'> = {
    listCurricula: vi.fn().mockResolvedValue([curriculum]),
    listPublishedCurriculumEntries: vi.fn().mockResolvedValue({
      curriculumId: curriculum.id, page: 1, pageSize: 100, totalItems: 1, totalPages: 1, entries: [subject],
    }),
  }
  return { client, catalogClient }
}

describe('AcademicOfferingDraftPanel', () => {
  it('does not expose or load the administrative draft panel without read permission', async () => {
    // Arrange
    const { AcademicOfferingDraftPanel } = await loadPanel()
    const { client, catalogClient } = createClients()

    // Act
    render(<AcademicOfferingDraftPanel client={client} catalogClient={catalogClient} periods={[period]} programs={[program]} authorization={null} />)

    // Assert
    expect(screen.queryByRole('region', { name: /borradores de oferta/i })).not.toBeInTheDocument()
    expect(client.listDrafts).not.toHaveBeenCalled()
  })

  it('shows an empty read-only state and withholds every write control without write permission', async () => {
    // Arrange
    const { AcademicOfferingDraftPanel } = await loadPanel()
    const { client, catalogClient } = createClients()

    // Act
    render(<AcademicOfferingDraftPanel client={client} catalogClient={catalogClient} periods={[period]} programs={[program]} authorization={readAuthorization} />)

    // Assert
    expect(await screen.findByText(/no hay borradores de grupos/i)).toBeInTheDocument()
    expect(screen.getByText(/capacidad propuesta/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /guardar borrador/i })).not.toBeInTheDocument()
    expect(catalogClient.listCurricula).not.toHaveBeenCalled()
    expect(client.listDrafts).toHaveBeenCalledWith(period.id, { limit: 25 }, readAuthorization.accessToken, expect.any(AbortSignal))
  })

  it('keeps the draft creation controls reachable in keyboard order', async () => {
    // Arrange
    const { AcademicOfferingDraftPanel } = await loadPanel()
    const { client, catalogClient } = createClients()
    const user = userEvent.setup()
    render(<AcademicOfferingDraftPanel client={client} catalogClient={catalogClient} periods={[period]} programs={[program]} authorization={writeAuthorization} />)
    await screen.findByRole('option', { name: /fundamentos de programación/i })

    // Act + Assert
    const controls = [
      screen.getByLabelText(/periodo académico para borradores/i),
      screen.getByLabelText(/programa publicado/i),
      screen.getByLabelText(/currículo publicado/i),
      screen.getByLabelText(/buscar asignatura/i),
      screen.getByLabelText(/asignatura del currículo/i),
      screen.getByLabelText(/código del grupo/i),
      screen.getByLabelText(/fecha de inicio/i),
      screen.getByLabelText(/fecha de cierre/i),
      screen.getByLabelText(/capacidad propuesta/i),
      screen.getByLabelText(/referencia institucional/i),
      screen.getByRole('button', { name: /guardar borrador/i }),
    ]
    for (const control of controls) {
      await user.tab()
      expect(control).toHaveFocus()
    }
  })

  it('creates a draft for a published curriculum subject and refreshes without implying availability', async () => {
    // Arrange
    const { AcademicOfferingDraftPanel } = await loadPanel()
    const { client, catalogClient } = createClients()
    const user = userEvent.setup()
    render(<AcademicOfferingDraftPanel client={client} catalogClient={catalogClient} periods={[period]} programs={[program]} authorization={writeAuthorization} />)
    await screen.findByRole('option', { name: /fundamentos de programación/i })
    await screen.findByText(/no hay borradores de grupos/i)

    // Act
    await user.type(screen.getByLabelText(/código del grupo/i), 'a-02')
    await user.type(screen.getByLabelText(/referencia institucional/i), 'Acta de coordinación 10')
    await user.clear(screen.getByLabelText(/capacidad propuesta/i))
    await user.type(screen.getByLabelText(/capacidad propuesta/i), '18')
    fireEvent.change(screen.getByLabelText(/fecha de inicio/i), { target: { value: '2026-06-02' } })
    fireEvent.change(screen.getByLabelText(/fecha de cierre/i), { target: { value: '2026-06-29' } })
    expect(screen.getByLabelText(/código del grupo/i)).toHaveValue('a-02')
    expect(screen.getByLabelText(/referencia institucional/i)).toHaveValue('Acta de coordinación 10')
    expect(screen.getByLabelText(/capacidad propuesta/i)).toHaveValue(18)
    expect(screen.getByLabelText(/fecha de inicio/i)).toHaveValue('2026-06-02')
    expect(screen.getByLabelText(/fecha de cierre/i)).toHaveValue('2026-06-29')
    await user.click(screen.getByRole('button', { name: /guardar borrador/i }))

    // Assert
    await waitFor(() => expect(client.createDraft).toHaveBeenCalledWith({
      periodId: period.id, curriculumId: curriculum.id, subjectId: subject.subjectId, sectionCode: 'a-02',
      startsOn: '2026-06-02', endsOn: '2026-06-29', proposedCapacity: 18,
      sourceReference: 'Acta de coordinación 10',
    }, writeAuthorization.accessToken, expect.any(AbortSignal)))
    expect(await screen.findByText(/borrador guardado/i)).toBeInTheDocument()
    expect(client.listDrafts).toHaveBeenCalledTimes(2)
    expect(screen.queryByText(/matrícula habilitada/i)).not.toBeInTheDocument()
  })

  it('loads audit history on demand and aborts the query when read permission is revoked', async () => {
    // Arrange
    const { AcademicOfferingDraftPanel } = await loadPanel()
    const { client, catalogClient } = createClients([offering])
    let historySignal: AbortSignal | undefined
    vi.mocked(client.listAuditEvents).mockImplementation((_id, _query, _token, signal) => {
      historySignal = signal
      return Promise.resolve({ events: [], nextCursor: null })
    })
    const { rerender } = render(<AcademicOfferingDraftPanel client={client} catalogClient={catalogClient} periods={[period]} programs={[program]} authorization={readAuthorization} />)

    // Act
    await screen.findByText(offering.sectionCode, { selector: 'strong' })
    await userEvent.setup().click(screen.getByRole('button', { name: /consultar historial/i }))
    await waitFor(() => expect(client.listAuditEvents).toHaveBeenCalledWith(offering.id, { limit: 25 }, readAuthorization.accessToken, expect.any(AbortSignal)))
    rerender(<AcademicOfferingDraftPanel client={client} catalogClient={catalogClient} periods={[period]} programs={[program]} authorization={{ ...readAuthorization, canRead: false }} />)

    // Assert
    await waitFor(() => expect(screen.queryByRole('region', { name: /borradores de oferta/i })).not.toBeInTheDocument())
    expect(historySignal?.aborted).toBe(true)
    expect(screen.queryByText(offering.sectionCode, { selector: 'strong' })).not.toBeInTheDocument()
  })

  it('reports an optimistic version conflict and never retries the write', async () => {
    // Arrange
    const { AcademicOfferingDraftPanel } = await loadPanel()
    const { client, catalogClient } = createClients()
    vi.mocked(client.createDraft).mockRejectedValue({ status: 409 })
    const user = userEvent.setup()
    render(<AcademicOfferingDraftPanel client={client} catalogClient={catalogClient} periods={[period]} programs={[program]} authorization={writeAuthorization} />)
    await screen.findByRole('option', { name: /fundamentos de programación/i })
    await user.type(screen.getByLabelText(/código del grupo/i), '01')
    fireEvent.change(screen.getByLabelText(/fecha de inicio/i), { target: { value: '2026-06-01' } })
    fireEvent.change(screen.getByLabelText(/fecha de cierre/i), { target: { value: '2026-06-30' } })
    await user.type(screen.getByLabelText(/capacidad propuesta/i), '24')
    await user.type(screen.getByLabelText(/referencia institucional/i), 'Acta de coordinación 10')

    // Act
    await user.click(screen.getByRole('button', { name: /guardar borrador/i }))

    // Assert
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/cambió el estado|actualiza la lista/i))
    expect(client.createDraft).toHaveBeenCalledTimes(1)
  })
})
