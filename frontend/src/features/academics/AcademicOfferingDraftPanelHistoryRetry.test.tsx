import { cleanup, render, screen, waitFor } from '@testing-library/react'
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

const offering: AcademicOfferingDraft = {
  id: 'b16116a1-10ba-4d79-839b-4195e4851d73', periodId: period.id, periodCode: period.code,
  periodKind: period.kind, curriculumId: curriculum.id, curriculumVersion: curriculum.curriculumVersion,
  programCode: program.programCode, programName: program.programName, subjectId: '8ab62b62-b65b-4b70-9bf0-df868abfe7eb',
  subjectCode: 'SIS-101', subjectName: 'Fundamentos de programación', sectionCode: '01',
  startsOn: '2026-06-01', endsOn: '2026-06-30', proposedCapacity: 24, version: 1,
  status: 'DRAFT', sourceReference: 'Acta de coordinación 08', updatedBy: 'opaque-actor-1',
  createdAt: '2026-05-10T15:00:00Z', updatedAt: '2026-05-10T15:00:00Z',
}

const readAuthorization: AcademicOfferingAuthorization = { accessToken: 'access-token', canRead: true, canWrite: false }

function createClients(drafts: AcademicOfferingDraft[] = []) {
  const client: AcademicOfferingDraftClient = {
    listDrafts: vi.fn().mockResolvedValue({ drafts, nextCursor: null }),
    createDraft: vi.fn().mockResolvedValue({ id: offering.id, version: 1, status: 'DRAFT' }),
    updateDraft: vi.fn().mockResolvedValue({ id: offering.id, version: 2, status: 'DRAFT' }),
    listAuditEvents: vi.fn().mockResolvedValue({ events: [], nextCursor: null }),
  }
  const catalogClient: Pick<AcademicCatalogClient, 'listCurricula' | 'listPublishedCurriculumEntries'> = {
    listCurricula: vi.fn().mockResolvedValue([curriculum]),
    listPublishedCurriculumEntries: vi.fn().mockResolvedValue({ entries: [] }),
  }
  return { client, catalogClient }
}

describe('AcademicOfferingDraftPanel audit history recovery', () => {
  it('retries a failed audit history read without reloading the draft list', async () => {
    // Arrange
    const { AcademicOfferingDraftPanel } = await loadPanel()
    const { client, catalogClient } = createClients([offering])
    const user = userEvent.setup()
    vi.mocked(client.listAuditEvents)
      .mockRejectedValueOnce(new Error('service unavailable'))
      .mockResolvedValueOnce({ events: [], nextCursor: null })
    render(<AcademicOfferingDraftPanel client={client} catalogClient={catalogClient}
      periods={[period]} programs={[program]} authorization={readAuthorization} />)
    await screen.findByText(offering.sectionCode, { selector: 'strong' })
    await user.click(screen.getByRole('button', { name: /consultar historial/i }))

    // Act
    expect(await screen.findByText(/no se pudo consultar el historial/i)).toBeVisible()
    await user.click(screen.getByRole('button', { name: /reintentar/i }))

    // Assert
    await waitFor(() => expect(client.listAuditEvents).toHaveBeenCalledTimes(2))
    expect(await screen.findByText(/todavía no tiene eventos de historial/i)).toBeVisible()
    expect(client.listDrafts).toHaveBeenCalledTimes(1)
  })
})
