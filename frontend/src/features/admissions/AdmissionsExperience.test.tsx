import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AdmissionsCalendarExperience as AdmissionsExperience } from './AdmissionsExperience'
import { AdmissionsCallApiError } from './admissionsCallContracts'
import type {
  AdmissionsCallAdmin,
  AdmissionsCallClient,
  AdmissionsCallContent,
  AdmissionsCallRevision,
  PublicAdmissionsCall,
} from './admissionsCallContracts'
import { OFFICIAL_ADMISSIONS_CALENDAR_2027_I } from './official2027ICalendar'

const publishedCall: PublicAdmissionsCall = {
  callId: 'de31c2a6-05c2-4c4d-8910-51bd5f49e395',
  callKey: 'pregrado-presencial-2028-i',
  revisionId: 'ed9cce93-1f3c-4412-9ad9-cd83c9f39b1c',
  revisionNumber: 1,
  content: {
    title: 'Pregrado presencial 2028-I',
    callName: 'Primer semestre académico de 2028',
    updatedAt: '2027-12-15',
    checkedAt: '2027-12-20',
    source: { label: 'Calendario público ACRA', url: 'https://acra.example.edu/calendario' },
    confirmationSource: { label: 'Comunicado público UPTC', url: 'https://uptc.example.edu/noticias' },
    milestones: [{ key: 'registration', kind: 'APPLICATION', startsOn: '2028-01-01', endsOn: '2028-01-05',
      title: 'Inscripción', description: 'Ventana publicada de inscripción.' }],
  },
  officialReference: 'Resolución pública 12 de 2028',
  publishedAt: '2027-12-20T12:00:00Z',
}

function revision(content: AdmissionsCallContent, status: 'DRAFT' | 'PUBLISHED' = 'DRAFT'): AdmissionsCallRevision {
  return {
    id: publishedCall.revisionId,
    revisionNumber: 1,
    draftVersion: 1,
    status,
    content,
    officialReference: status === 'PUBLISHED' ? publishedCall.officialReference : null,
    publishedAt: status === 'PUBLISHED' ? publishedCall.publishedAt : null,
  }
}

function clientWith(overrides: Partial<AdmissionsCallClient> = {}): AdmissionsCallClient {
  return {
    getPublicCalls: vi.fn(async () => []),
    getAdminCalls: vi.fn(async () => []),
    createCall: vi.fn(async () => { throw new Error('Unexpected call creation') }),
    createRevision: vi.fn(async () => { throw new Error('Unexpected revision creation') }),
    updateDraft: vi.fn(async () => { throw new Error('Unexpected draft update') }),
    publish: vi.fn(async () => { throw new Error('Unexpected publication') }),
    ...overrides,
  }
}

function changeField(container: HTMLElement, label: string, value: string) {
  fireEvent.change(within(container).getByLabelText(label), { target: { value } })
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('AdmissionsExperience', () => {
  it('keeps the sourced 2027-I public agenda when the versioned endpoint has no published calls', async () => {
    // Arrange
    const client = clientWith({ getPublicCalls: vi.fn().mockResolvedValue([]) })

    // Act
    render(<AdmissionsExperience client={client} />)

    // Assert
    expect(await screen.findByRole('heading', { name: /pregrado presencial.*2027-i/i })).toBeVisible()
    const fallbackCard = screen.getByRole('complementary', { name: /convocatoria vigente/i })
    expect(fallbackCard.querySelector('strong')?.textContent).toBe('2027—I')
    expect(screen.getByText(/no hay una convocatoria administrada publicada/i)).toBeVisible()
    expect(client.getPublicCalls).toHaveBeenCalledOnce()
    expect(client.getAdminCalls).not.toHaveBeenCalled()
    expect(screen.queryByRole('form', { name: /editar convocatoria/i })).not.toBeInTheDocument()
    expect(OFFICIAL_ADMISSIONS_CALENDAR_2027_I.callName).toContain('2027')
  })

  it('displays the latest published revision and its source metadata when the API has one', async () => {
    // Arrange
    const client = clientWith({ getPublicCalls: async () => [publishedCall] })

    // Act
    render(<AdmissionsExperience client={client} />)

    // Assert
    expect(await screen.findByRole('heading', { name: /pregrado presencial 2028-i/i })).toBeVisible()
    expect(screen.getByText('Primer semestre académico de 2028')).toBeVisible()
    expect(screen.getByText(/revisión publicada · versión 1/i)).toBeVisible()
    const callCard = screen.getByRole('complementary', { name: /convocatoria publicada/i })
    expect(within(callCard).getByText('Publicada')).toBeVisible()
    expect(callCard).not.toHaveTextContent('2027—I')
    expect(screen.getByText(/fuente calendario público acra/i)).toBeVisible()
    expect(screen.getByRole('link', { name: /consultar calendario público acra/i }))
      .toHaveAttribute('href', 'https://acra.example.edu/calendario')
  })

  it('lets visitors choose between multiple published admissions calls', async () => {
    // Arrange
    const user = userEvent.setup()
    const secondCall: PublicAdmissionsCall = { ...publishedCall,
      callId: 'b48bb8d1-a0c3-4a74-a926-95b8737b1879',
      callKey: 'pregrado-presencial-2027-i',
      revisionId: 'd03a8db4-4ead-4c71-8a5a-61d3394564b3',
      revisionNumber: 2,
      content: { ...publishedCall.content, title: 'Pregrado presencial 2027-I',
        callName: 'Primer semestre académico de 2027' },
    }
    const client = clientWith({ getPublicCalls: async () => [publishedCall, secondCall] })

    // Act
    render(<AdmissionsExperience client={client} />)
    const selector = await screen.findByRole('combobox', { name: /convocatoria publicada/i })
    await user.selectOptions(selector, secondCall.callId)

    // Assert
    expect(await screen.findByRole('heading', { name: /pregrado presencial 2027-i/i })).toBeVisible()
    expect(screen.getByText(/revisión publicada · versión 2/i)).toBeVisible()
    const callCard = screen.getByRole('complementary', { name: /convocatoria publicada/i })
    expect(within(callCard).getByText('Publicada')).toBeVisible()
    expect(callCard).not.toHaveTextContent('2027—I')
  })

  it('does not query or show administration without the backend read permission', async () => {
    // Arrange
    const client = clientWith()

    // Act
    render(<AdmissionsExperience client={client} authorization={{ accessToken: 'token', canRead: false, canWrite: true }} />)

    // Assert
    await screen.findByRole('heading', { name: /pregrado presencial.*2027-i/i })
    expect(client.getAdminCalls).not.toHaveBeenCalled()
    expect(screen.queryByRole('region', { name: /administración de convocatorias/i })).not.toBeInTheDocument()
  })

  it('shows read-only call details to readers and keeps all mutation controls hidden', async () => {
    // Arrange
    const draft: AdmissionsCallAdmin = {
      id: publishedCall.callId,
      callKey: publishedCall.callKey,
      currentPublishedRevisionId: null,
      latestRevision: revision(publishedCall.content),
      publishedRevision: null,
    }
    const client = clientWith({ getAdminCalls: async () => [draft] })

    // Act
    render(<AdmissionsExperience client={client} authorization={{ accessToken: 'reader-token', canRead: true, canWrite: false }} />)

    // Assert
    const administration = await screen.findByRole('region', { name: /administración de convocatorias/i })
    expect(within(administration).getByText(publishedCall.callKey)).toBeVisible()
    expect(within(administration).queryByRole('button', { name: /nueva convocatoria/i })).not.toBeInTheDocument()
    expect(within(administration).queryByRole('button', { name: /guardar borrador/i })).not.toBeInTheDocument()
    expect(within(administration).queryByRole('button', { name: /publicar revisión/i })).not.toBeInTheDocument()
  })

  it('aborts the administrative request and removes its panel when read permission is revoked', async () => {
    // Arrange
    let signal: AbortSignal | undefined
    const client = clientWith({
      getAdminCalls: vi.fn((_token, requestSignal) => {
        signal = requestSignal
        return new Promise<AdmissionsCallAdmin[]>(() => {})
      }),
    })
    const view = render(<AdmissionsExperience client={client}
      authorization={{ accessToken: 'reader-token', canRead: true, canWrite: false }} />)
    await waitFor(() => expect(client.getAdminCalls).toHaveBeenCalledOnce())

    // Act
    view.rerender(<AdmissionsExperience client={client}
      authorization={{ accessToken: 'reader-token', canRead: false, canWrite: false }} />)

    // Assert
    expect(signal?.aborted).toBe(true)
    expect(screen.queryByRole('region', { name: /administración de convocatorias/i })).not.toBeInTheDocument()
  })

  it('revalidates /me after an administrative read rejects its token', async () => {
    // Arrange
    const onAuthorizationRejected = vi.fn()
    const client = clientWith({ getAdminCalls: vi.fn().mockRejectedValue(new AdmissionsCallApiError(403)) })

    // Act
    render(<AdmissionsExperience client={client} onAuthorizationRejected={onAuthorizationRejected}
      authorization={{ accessToken: 'reader-token', canRead: true, canWrite: false }} />)

    // Assert
    await waitFor(() => expect(onAuthorizationRejected).toHaveBeenCalledWith('reader-token'))
    expect(onAuthorizationRejected).toHaveBeenCalledOnce()
  })

  it('reloads a conflicting draft without retrying the write', async () => {
    // Arrange
    const user = userEvent.setup()
    const draft: AdmissionsCallAdmin = {
      id: publishedCall.callId,
      callKey: publishedCall.callKey,
      currentPublishedRevisionId: null,
      latestRevision: revision(publishedCall.content),
      publishedRevision: null,
    }
    const client = clientWith({
      getAdminCalls: vi.fn(async () => [draft]),
      updateDraft: vi.fn().mockRejectedValue(new AdmissionsCallApiError(409)),
    })

    // Act
    render(<AdmissionsExperience client={client}
      authorization={{ accessToken: 'writer-token', canRead: true, canWrite: true }} />)
    const administration = await screen.findByRole('region', { name: /administración de convocatorias/i })
    await user.click(within(administration).getByRole('button', { name: new RegExp(publishedCall.callKey) }))
    changeField(administration, 'Título público', 'Calendario revisado')
    await user.click(within(administration).getByRole('button', { name: /guardar borrador/i }))

    // Assert
    await waitFor(() => expect(client.getAdminCalls).toHaveBeenCalledTimes(2))
    expect(client.updateDraft).toHaveBeenCalledOnce()
    expect(await within(administration).findByText(/cambió en otra sesión.*se recargará/i)).toBeVisible()
  })

  it('creates then publishes a call from an authorized form and refreshes the public view', async () => {
    // Arrange
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    let storedCall: AdmissionsCallAdmin | null = null
    let storedPublicCall: PublicAdmissionsCall | null = null
    const client = clientWith({
      getPublicCalls: async () => storedPublicCall ? [storedPublicCall] : [],
      getAdminCalls: async () => storedCall ? [storedCall] : [],
      createCall: vi.fn(async (command) => {
        const savedRevision = { ...revision(command.content), id: '04c7af2c-d85a-4e84-aebb-cf928234d17b' }
        storedCall = { id: publishedCall.callId, callKey: command.callKey, currentPublishedRevisionId: null,
          latestRevision: savedRevision, publishedRevision: null }
        return storedCall
      }),
      publish: vi.fn(async (_callId, _revisionId, command) => {
        const currentCall = storedCall
        if (!currentCall) throw new Error('Expected the newly created draft')
        const draft = currentCall.latestRevision
        const liveRevision: AdmissionsCallRevision = { ...draft, status: 'PUBLISHED',
          officialReference: command.officialReference, publishedAt: publishedCall.publishedAt }
        storedCall = { ...currentCall, currentPublishedRevisionId: draft.id,
          latestRevision: liveRevision, publishedRevision: liveRevision }
        storedPublicCall = { ...publishedCall, callKey: currentCall.callKey, revisionId: draft.id,
          revisionNumber: draft.revisionNumber, content: draft.content, officialReference: command.officialReference }
        return liveRevision
      }),
    })

    // Act
    render(<AdmissionsExperience client={client}
      authorization={{ accessToken: 'writer-token', canRead: true, canWrite: true }} />)
    const administration = await screen.findByRole('region', { name: /administración de convocatorias/i })
    await user.click(within(administration).getByRole('button', { name: /nueva convocatoria/i }))
    changeField(administration, 'Clave estable', 'pregrado-presencial-2028-i')
    changeField(administration, 'Título público', 'Pregrado presencial 2028-I')
    changeField(administration, 'Nombre de convocatoria', 'Primer semestre académico de 2028')
    changeField(administration, 'Fecha de actualización de la fuente', '2027-12-15')
    changeField(administration, 'Fecha de consulta', '2027-12-20')
    changeField(administration, 'Nombre de la fuente principal', 'Calendario público ACRA')
    changeField(administration, 'URL de la fuente principal', 'https://acra.example.edu/calendario')
    changeField(administration, 'Nombre de la fuente de confirmación', 'Comunicado público UPTC')
    changeField(administration, 'URL de la fuente de confirmación', 'https://uptc.example.edu/noticias')
    changeField(administration, 'Clave del hito 1', 'registration')
    fireEvent.change(within(administration).getByLabelText('Tipo del hito 1'), { target: { value: 'APPLICATION' } })
    changeField(administration, 'Inicio del hito 1', '2028-01-01')
    changeField(administration, 'Fin del hito 1', '2028-01-05')
    changeField(administration, 'Título del hito 1', 'Inscripción')
    changeField(administration, 'Descripción del hito 1', 'Ventana publicada de inscripción.')
    await user.click(within(administration).getByRole('button', { name: /guardar borrador/i }))

    // Assert draft creation
    await waitFor(() => expect(client.createCall).toHaveBeenCalledOnce())
    expect(client.createCall).toHaveBeenCalledWith(expect.objectContaining({ callKey: 'pregrado-presencial-2028-i' }),
      'writer-token', expect.any(AbortSignal))
    expect(await within(administration).findByRole('button', { name: /publicar revisión/i })).toBeVisible()

    // Act: publication is an explicit, separately referenced operation.
    changeField(administration, 'Referencia oficial de publicación', 'Resolución institucional 12 de 2028')
    await user.click(within(administration).getByRole('button', { name: /publicar revisión/i }))

    // Assert
    await waitFor(() => expect(client.publish).toHaveBeenCalledWith(publishedCall.callId,
      '04c7af2c-d85a-4e84-aebb-cf928234d17b', {
        expectedDraftVersion: 1,
        expectedPublishedRevisionId: null,
        officialReference: 'Resolución institucional 12 de 2028',
      }, 'writer-token', expect.any(AbortSignal)))
    expect(await screen.findByRole('heading', { name: /pregrado presencial 2028-i/i })).toBeVisible()
    expect(screen.getByText(/revisión publicada · versión 1/i)).toBeVisible()
  })

  it('aborts protected administrative reads when the route unmounts', async () => {
    // Arrange
    let signal: AbortSignal | undefined
    const client = clientWith({
      getAdminCalls: vi.fn((_token, requestSignal) => {
        signal = requestSignal
        return new Promise<AdmissionsCallAdmin[]>(() => {})
      }),
    })
    const view = render(<AdmissionsExperience client={client}
      authorization={{ accessToken: 'reader-token', canRead: true, canWrite: false }} />)

    // Act
    await waitFor(() => expect(client.getAdminCalls).toHaveBeenCalledOnce())
    view.unmount()

    // Assert
    expect(signal?.aborted).toBe(true)
  })
})
