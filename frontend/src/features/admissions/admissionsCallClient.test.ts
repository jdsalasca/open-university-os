import { describe, expect, it, vi } from 'vitest'
import { AdmissionsCallApiError } from './admissionsCallContracts'
import { createAdmissionsCallClient } from './admissionsCallClient'

const content = {
  title: 'Pregrado presencial 2028-I',
  callName: 'Primer semestre académico de 2028',
  updatedAt: '2027-12-15',
  checkedAt: '2027-12-20',
  source: { label: 'Calendario ACRA', url: 'https://acra.example.edu/calendario' },
  confirmationSource: { label: 'Comunicado UPTC', url: 'https://uptc.example.edu/noticias' },
  milestones: [{ key: 'registration', kind: 'APPLICATION', startsOn: '2028-01-01', endsOn: '2028-01-05',
    title: 'Inscripción', description: 'Registro público de aspirantes.' }],
} as const

const publicCall = {
  callId: 'de31c2a6-05c2-4c4d-8910-51bd5f49e395',
  callKey: 'pregrado-presencial-2028-i',
  revisionId: 'ed9cce93-1f3c-4412-9ad9-cd83c9f39b1c',
  revisionNumber: 1,
  content,
  officialReference: 'Resolución institucional 12 de 2028',
  publishedAt: '2027-12-20T12:00:00Z',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('AdmissionsCallClient', () => {
  it('reads only the public admissions calls without attaching a token', async () => {
    // Arrange
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([publicCall]))
    const client = createAdmissionsCallClient(fetcher)

    // Act
    const calls = await client.getPublicCalls()

    // Assert
    expect(calls).toEqual([publicCall])
    expect(fetcher).toHaveBeenCalledWith('/api/v1/admissions/calls', expect.objectContaining({
      method: 'GET',
      cache: 'no-store',
    }))
    const publicRequest = fetcher.mock.calls[0]?.[1]
    expect(new Headers(publicRequest?.headers).get('Authorization')).toBeNull()
  })

  it('sends the current bearer token and signal to protected reads and preserves the HTTP status on rejection', async () => {
    // Arrange
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ error: 'forbidden' }, 403))
    const client = createAdmissionsCallClient(fetcher)
    const controller = new AbortController()

    // Act
    const request = client.getAdminCalls('short-lived-token', controller.signal)

    // Assert
    await expect(request).rejects.toMatchObject<Partial<AdmissionsCallApiError>>({ status: 403 })
    const adminRequest = fetcher.mock.calls[0]?.[1]
    expect(new Headers(adminRequest?.headers).get('Authorization')).toBe('Bearer short-lived-token')
    expect(adminRequest?.signal).toBe(controller.signal)
  })

  it('sends optimistic versions and publication references in the protected mutation contracts', async () => {
    // Arrange
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ id: publicCall.callId, callKey: publicCall.callKey,
        currentPublishedRevisionId: publicCall.revisionId,
        latestRevision: { id: publicCall.revisionId, revisionNumber: 1, draftVersion: 2, status: 'PUBLISHED',
          content, officialReference: publicCall.officialReference, publishedAt: publicCall.publishedAt },
        publishedRevision: { id: publicCall.revisionId, revisionNumber: 1, draftVersion: 2, status: 'PUBLISHED',
          content, officialReference: publicCall.officialReference, publishedAt: publicCall.publishedAt } }, 201))
      .mockResolvedValueOnce(jsonResponse({ id: '04c7af2c-d85a-4e84-aebb-cf928234d17b', revisionNumber: 2,
        draftVersion: 1, status: 'DRAFT', content, officialReference: null, publishedAt: null }, 201))
      .mockResolvedValueOnce(jsonResponse({ id: '04c7af2c-d85a-4e84-aebb-cf928234d17b', revisionNumber: 2,
        draftVersion: 2, status: 'DRAFT', content, officialReference: null, publishedAt: null }))
      .mockResolvedValueOnce(jsonResponse({ id: '04c7af2c-d85a-4e84-aebb-cf928234d17b', revisionNumber: 2,
        draftVersion: 2, status: 'PUBLISHED', content, officialReference: 'Acuerdo 44 de 2028',
        publishedAt: publicCall.publishedAt }))
    const client = createAdmissionsCallClient(fetcher)

    // Act
    await client.createCall({ callKey: publicCall.callKey, content }, 'token')
    await client.createRevision(publicCall.callId, content, 'token')
    await client.updateDraft(publicCall.callId, publicCall.revisionId, 1, content, 'token')
    await client.publish(publicCall.callId, publicCall.revisionId, {
      expectedDraftVersion: 2,
      expectedPublishedRevisionId: null,
      officialReference: 'Acuerdo 44 de 2028',
    }, 'token')

    // Assert
    expect(fetcher.mock.calls.map(([url, options]) => [url, options?.method])).toEqual([
      ['/api/v1/admin/admissions/calls', 'POST'],
      [`/api/v1/admin/admissions/calls/${publicCall.callId}/revisions`, 'POST'],
      [`/api/v1/admin/admissions/calls/${publicCall.callId}/revisions/${publicCall.revisionId}`, 'PUT'],
      [`/api/v1/admin/admissions/calls/${publicCall.callId}/revisions/${publicCall.revisionId}/publish`, 'POST'],
    ])
    const publicationBody = JSON.parse(String(fetcher.mock.calls[3]?.[1]?.body)) as Record<string, unknown>
    expect(publicationBody).toEqual({ expectedDraftVersion: 2, expectedPublishedRevisionId: null,
      officialReference: 'Acuerdo 44 de 2028' })
  })

  it('rejects malformed published data rather than trusting an API response shape', async () => {
    // Arrange
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([{ ...publicCall, content: { ...content,
      source: { label: 'Unsafe', url: 'javascript:alert(1)' } } }]))
    const client = createAdmissionsCallClient(fetcher)

    // Act + Assert
    await expect(client.getPublicCalls()).rejects.toThrow(/respuesta/i)
  })

  it('rejects an administrative publication pointer without its published snapshot', async () => {
    // Arrange
    const publishedRevision = { id: publicCall.revisionId, revisionNumber: 1, draftVersion: 1,
      status: 'PUBLISHED', content, officialReference: publicCall.officialReference, publishedAt: publicCall.publishedAt }
    const inconsistentCall = { id: publicCall.callId, callKey: publicCall.callKey,
      currentPublishedRevisionId: publicCall.revisionId, latestRevision: publishedRevision, publishedRevision: null }
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([inconsistentCall]))
    const client = createAdmissionsCallClient(fetcher)

    // Act + Assert
    await expect(client.getAdminCalls('short-lived-token')).rejects.toThrow(/respuesta/i)
  })

  it('rejects published calendars that exceed the bounded milestone count', async () => {
    // Arrange
    const milestones = Array.from({ length: 51 }, (_, index) => ({ ...content.milestones[0],
      key: `registration-${index + 1}` }))
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([{ ...publicCall,
      content: { ...content, milestones } }]))
    const client = createAdmissionsCallClient(fetcher)

    // Act + Assert
    await expect(client.getPublicCalls()).rejects.toThrow(/respuesta/i)
  })
})
