import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AcademicCatalogClient, AcademicCurriculum, AcademicProgram } from './contracts'
import type { AcademicPeriod } from './academicOperationsContracts'
import type { AcademicOfferingAuthorization, AcademicOfferingDraftClient } from './academicOfferingDraftContracts'

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

const writeAuthorization: AcademicOfferingAuthorization = { accessToken: 'access-token', canRead: true, canWrite: true }

function createClients() {
  const client: AcademicOfferingDraftClient = {
    listDrafts: vi.fn().mockResolvedValue({ drafts: [], nextCursor: null }),
    createDraft: vi.fn().mockResolvedValue({ id: 'b16116a1-10ba-4d79-839b-4195e4851d73', version: 1, status: 'DRAFT' }),
    updateDraft: vi.fn().mockResolvedValue({ id: 'b16116a1-10ba-4d79-839b-4195e4851d73', version: 2, status: 'DRAFT' }),
    listAuditEvents: vi.fn().mockResolvedValue({ events: [], nextCursor: null }),
  }
  const catalogClient: Pick<AcademicCatalogClient, 'listCurricula' | 'listPublishedCurriculumEntries'> = {
    listCurricula: vi.fn()
      .mockRejectedValueOnce(new Error('service unavailable'))
      .mockResolvedValue([curriculum]),
    listPublishedCurriculumEntries: vi.fn().mockResolvedValue({ entries: [] }),
  }
  return { client, catalogClient }
}

describe('AcademicOfferingDraftPanel curriculum recovery', () => {
  it('retries the published curriculum read without discarding the selected program', async () => {
    // Arrange
    const { AcademicOfferingDraftPanel } = await loadPanel()
    const { client, catalogClient } = createClients()
    const user = userEvent.setup()
    render(<AcademicOfferingDraftPanel client={client} catalogClient={catalogClient}
      periods={[period]} programs={[program]} authorization={writeAuthorization} />)
    expect(await screen.findByText(/no se pudieron consultar los currículos publicados/i)).toBeVisible()
    expect(screen.getByLabelText(/programa publicado/i)).toHaveValue(program.id)

    // Act
    await user.click(screen.getByRole('button', { name: /reintentar consulta de currículos/i }))

    // Assert
    await waitFor(() => expect(catalogClient.listCurricula).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('option', { name: /2024-v2/i })).toBeVisible()
    expect(screen.getByLabelText(/programa publicado/i)).toHaveValue(program.id)
    expect(screen.queryByText(/no se pudieron consultar los currículos publicados/i)).not.toBeInTheDocument()
  })
})
