import { describe, expect, it, vi } from 'vitest'

const clientModules = import.meta.glob<typeof import('./academicOfferingDraftClient')>('./academicOfferingDraftClient.ts')

async function loadClient() {
  const loader = clientModules['./academicOfferingDraftClient.ts']
  expect(loader, 'the typed academic offering draft client is implemented').toBeTypeOf('function')
  return loader!()
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const periodId = 'fb750786-79cc-49cf-9814-0f1047c76ba4'
const curriculumId = 'b31e24c4-4b0e-4b79-8480-ae5f26105646'
const subjectId = '8ab62b62-b65b-4b70-9bf0-df868abfe7eb'
const offeringId = 'b16116a1-10ba-4d79-839b-4195e4851d73'

const draft = {
  id: offeringId,
  periodId,
  periodCode: '2026-INT-1',
  periodKind: 'INTERSEMESTRAL',
  curriculumId,
  curriculumVersion: '2024-v2',
  programCode: 'ING-SIS',
  programName: 'Ingeniería de Sistemas',
  subjectId,
  subjectCode: 'SIS-101',
  subjectName: 'Fundamentos de programación',
  sectionCode: '01',
  startsOn: '2026-06-01',
  endsOn: '2026-06-30',
  proposedCapacity: 24,
  version: 1,
  status: 'DRAFT',
  sourceReference: 'Acta de coordinación 08',
  updatedBy: 'opaque-actor-1',
  createdAt: '2026-05-10T15:00:00Z',
  updatedAt: '2026-05-10T15:00:00Z',
}

describe('academic offering draft client', () => {
  it('loads a bounded period page with an opaque cursor and the confirmed access token', async () => {
    // Arrange
    const { createAcademicOfferingDraftClient } = await loadClient()
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ drafts: [draft], nextCursor: 'cursor-v1' }))
    const client = createAcademicOfferingDraftClient(fetcher)
    const signal = new AbortController().signal

    // Act
    const page = await client.listDrafts(periodId, { limit: 1, before: 'previous-cursor' }, 'access-token', signal)

    // Assert
    expect(page).toEqual({ drafts: [draft], nextCursor: 'cursor-v1' })
    expect(fetcher).toHaveBeenCalledWith(
      `/api/v1/admin/academic-offerings?periodId=${periodId}&limit=1&before=previous-cursor`,
      {
        credentials: 'omit',
        headers: { Accept: 'application/json', Authorization: 'Bearer access-token' },
        signal,
      },
    )
  })

  it('rejects invalid page limits and malformed draft rows before exposing data', async () => {
    // Arrange
    const { createAcademicOfferingDraftClient } = await loadClient()
    const fetcher = vi.fn()
    const client = createAcademicOfferingDraftClient(fetcher)

    // Act + Assert
    await expect(client.listDrafts(periodId, { limit: 101 }, 'access-token')).rejects.toThrow(/limit|page/i)
    expect(fetcher).not.toHaveBeenCalled()

    fetcher.mockResolvedValue(jsonResponse({ drafts: [{ ...draft, proposedCapacity: 0 }], nextCursor: null }))
    await expect(client.listDrafts(periodId, {}, 'access-token')).rejects.toThrow(/malformed/i)
  })

  it('creates a draft using an authorized POST and returns only its versioned draft receipt', async () => {
    // Arrange
    const { createAcademicOfferingDraftClient } = await loadClient()
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ id: offeringId, version: 1, status: 'DRAFT' }, 201))
    const client = createAcademicOfferingDraftClient(fetcher)
    const command = {
      periodId,
      curriculumId,
      subjectId,
      sectionCode: '  a-01  ',
      startsOn: '2026-06-01',
      endsOn: '2026-06-30',
      proposedCapacity: 24,
      sourceReference: 'Acta de coordinación 08',
    }

    // Act
    const receipt = await client.createDraft(command, 'access-token')

    // Assert
    expect(receipt).toEqual({ id: offeringId, version: 1, status: 'DRAFT' })
    expect(fetcher).toHaveBeenCalledWith('/api/v1/admin/academic-offerings', {
      credentials: 'omit',
      headers: { Accept: 'application/json', Authorization: 'Bearer access-token', 'Content-Type': 'application/json' },
      method: 'POST',
      body: JSON.stringify({ ...command, sectionCode: 'A-01' }),
    })
  })

  it('updates with an expected version and parses its append-only audit history', async () => {
    // Arrange
    const { createAcademicOfferingDraftClient } = await loadClient()
    const updated = { id: offeringId, version: 2, status: 'DRAFT' }
    const event = {
      id: 2,
      offeringId,
      actionKey: 'OFFERING_DRAFT_UPDATED',
      actor: 'opaque-actor-1',
      occurredAt: '2026-05-11T09:00:00Z',
      sourceReference: 'Acta de coordinación 09',
      before: { sectionCode: 'A-01', startsOn: '2026-06-01', endsOn: '2026-06-30', proposedCapacity: 24, version: 1 },
      after: { sectionCode: 'A-01', startsOn: '2026-06-02', endsOn: '2026-06-30', proposedCapacity: 22, version: 2 },
    }
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse(updated))
      .mockResolvedValueOnce(jsonResponse({ events: [event], nextCursor: null }))
    const client = createAcademicOfferingDraftClient(fetcher)
    const command = {
      expectedVersion: 1,
      sectionCode: 'a-01',
      startsOn: '2026-06-02',
      endsOn: '2026-06-30',
      proposedCapacity: 22,
      sourceReference: 'Acta de coordinación 09',
    }

    // Act
    const receipt = await client.updateDraft(offeringId, command, 'access-token')
    const history = await client.listAuditEvents(offeringId, { limit: 20 }, 'access-token')

    // Assert
    expect(receipt).toEqual(updated)
    expect(history).toEqual({ events: [event], nextCursor: null })
    expect(fetcher).toHaveBeenNthCalledWith(1, `/api/v1/admin/academic-offerings/${offeringId}`, {
      credentials: 'omit',
      headers: { Accept: 'application/json', Authorization: 'Bearer access-token', 'Content-Type': 'application/json' },
      method: 'PUT',
      body: JSON.stringify({ ...command, sectionCode: 'A-01' }),
    })
    expect(fetcher).toHaveBeenNthCalledWith(2,
      `/api/v1/admin/academic-offerings/${offeringId}/audit-events?limit=20`,
      { credentials: 'omit', headers: { Accept: 'application/json', Authorization: 'Bearer access-token' } },
    )
  })
})
