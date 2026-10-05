import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AcademicOperationsClient, AcademicStructureAuditEvent, AcademicStructureAuditPage } from './academicOperationsContracts'

const panelModules = import.meta.glob<typeof import('./AcademicStructureAuditPanel')>('./AcademicStructureAuditPanel.tsx')

async function loadPanel() {
  const loader = panelModules['./AcademicStructureAuditPanel.tsx']
  expect(loader, 'the academic structure audit panel is implemented').toBeTypeOf('function')
  return loader!()
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const firstEntityId = 'fae06170-9acf-4718-854e-92e945a7db17'

const firstEvent: AcademicStructureAuditEvent = {
  entityId: firstEntityId,
  actionKey: 'UNIT_CREATED',
  actor: 'opaque-actor-7c58',
  occurredAt: '2026-09-30T15:30:00Z',
  reference: 'Acuerdo académico de prueba',
  summary: 'Se creó la unidad FAC-CIENCIAS',
}

const secondEvent: AcademicStructureAuditEvent = {
  ...firstEvent,
  actionKey: 'PROGRAM_AFFILIATED',
  summary: 'Se adscribió el programa ING-SIS',
}

function createClient(getStructureAuditEvents = vi.fn().mockResolvedValue({ events: [firstEvent], nextCursor: null })) {
  return { getStructureAuditEvents } as unknown as Pick<AcademicOperationsClient, 'getStructureAuditEvents'>
}

describe('AcademicStructureAuditPanel', () => {
  it('does not request or display audit records without the read permission', async () => {
    // Arrange
    const { AcademicStructureAuditPanel } = await loadPanel()
    const getStructureAuditEvents = vi.fn()

    // Act
    const { container } = render(<AcademicStructureAuditPanel
      canRead={false}
      accessToken="synthetic-token"
      client={createClient(getStructureAuditEvents)}
    />)

    // Assert
    expect(container).toBeEmptyDOMElement()
    expect(getStructureAuditEvents).not.toHaveBeenCalled()
  })

  it('shows read-only audit events with their date, opaque actor, reference, and summary', async () => {
    // Arrange
    const { AcademicStructureAuditPanel } = await loadPanel()
    const client = createClient()

    // Act
    render(<AcademicStructureAuditPanel canRead accessToken="synthetic-token" client={client} />)

    // Assert
    expect(await screen.findByText('Se creó la unidad FAC-CIENCIAS')).toBeInTheDocument()
    expect(screen.getByText('Acuerdo académico de prueba')).toBeInTheDocument()
    expect(screen.getByText('opaque-actor-7c58')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /bitácora de estructura académica/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /editar|eliminar|corregir/i })).not.toBeInTheDocument()
  })

  it('applies entity and action filters to the paginated audit request', async () => {
    // Arrange
    const { AcademicStructureAuditPanel } = await loadPanel()
    const getStructureAuditEvents = vi.fn()
      .mockResolvedValueOnce({ events: [firstEvent], nextCursor: null } satisfies AcademicStructureAuditPage)
      .mockResolvedValueOnce({ events: [secondEvent], nextCursor: null } satisfies AcademicStructureAuditPage)
    const user = userEvent.setup()
    render(<AcademicStructureAuditPanel
      canRead accessToken="synthetic-token" client={createClient(getStructureAuditEvents)}
    />)
    await screen.findByText('Se creó la unidad FAC-CIENCIAS')

    // Act
    await user.clear(screen.getByRole('textbox', { name: /id de entidad/i }))
    await user.type(screen.getByRole('textbox', { name: /id de entidad/i }), firstEntityId)
    await user.selectOptions(screen.getByRole('combobox', { name: /acción/i }), 'PROGRAM_AFFILIATED')
    await user.click(screen.getByRole('button', { name: /aplicar filtros/i }))

    // Assert
    expect(await screen.findByText('Se adscribió el programa ING-SIS')).toBeInTheDocument()
    expect(getStructureAuditEvents).toHaveBeenLastCalledWith(
      { limit: 50, entityId: firstEntityId, actionKey: 'PROGRAM_AFFILIATED' },
      'synthetic-token',
      expect.any(AbortSignal),
    )
  })

  it('loads the next cursor page and appends its events', async () => {
    // Arrange
    const { AcademicStructureAuditPanel } = await loadPanel()
    const getStructureAuditEvents = vi.fn()
      .mockResolvedValueOnce({ events: [firstEvent], nextCursor: 'next-page-cursor' } satisfies AcademicStructureAuditPage)
      .mockResolvedValueOnce({ events: [secondEvent], nextCursor: null } satisfies AcademicStructureAuditPage)
    const user = userEvent.setup()
    render(<AcademicStructureAuditPanel
      canRead accessToken="synthetic-token" client={createClient(getStructureAuditEvents)}
    />)
    await screen.findByText('Se creó la unidad FAC-CIENCIAS')

    // Act
    await user.click(screen.getByRole('button', { name: /cargar más/i }))

    // Assert
    expect(await screen.findByText('Se adscribió el programa ING-SIS')).toBeInTheDocument()
    expect(getStructureAuditEvents).toHaveBeenLastCalledWith(
      { limit: 50, before: 'next-page-cursor' },
      'synthetic-token',
      expect.any(AbortSignal),
    )
  })

  it('keeps separate events when their entity, action, actor, and timestamp match', async () => {
    // Arrange
    const { AcademicStructureAuditPanel } = await loadPanel()
    const simultaneousEvent: AcademicStructureAuditEvent = {
      ...firstEvent,
      summary: 'Segundo movimiento de la misma entidad',
    }
    const client = createClient(vi.fn().mockResolvedValue({
      events: [firstEvent, simultaneousEvent],
      nextCursor: null,
    } satisfies AcademicStructureAuditPage))

    // Act
    render(<AcademicStructureAuditPanel canRead accessToken="synthetic-token" client={client} />)

    // Assert
    expect(await screen.findByText('Se creó la unidad FAC-CIENCIAS')).toBeInTheDocument()
    expect(await screen.findByText('Segundo movimiento de la misma entidad')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('shows a useful empty state when no audit events match', async () => {
    // Arrange
    const { AcademicStructureAuditPanel } = await loadPanel()
    const client = createClient(vi.fn().mockResolvedValue({ events: [], nextCursor: null }))
    render(<AcademicStructureAuditPanel
      canRead accessToken="synthetic-token" client={client}
    />)

    // Act + Assert
    expect(await screen.findByText(/no hay movimientos que coincidan/i)).toBeInTheDocument()
  })

  it('allows retry after an audit request fails', async () => {
    // Arrange
    const { AcademicStructureAuditPanel } = await loadPanel()
    const getStructureAuditEvents = vi.fn()
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce({ events: [firstEvent], nextCursor: null } satisfies AcademicStructureAuditPage)
    const user = userEvent.setup()
    render(<AcademicStructureAuditPanel
      canRead accessToken="synthetic-token" client={createClient(getStructureAuditEvents)}
    />)

    // Act + Assert
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /reintentar bitácora/i }))
    expect(await screen.findByText('Se creó la unidad FAC-CIENCIAS')).toBeInTheDocument()
  })

  it('aborts the in-flight request and clears records when the read permission is revoked', async () => {
    // Arrange
    const { AcademicStructureAuditPanel } = await loadPanel()
    let requestSignal: AbortSignal | undefined
    const getStructureAuditEvents = vi.fn((_query, _token, signal: AbortSignal) => {
      requestSignal = signal
      return new Promise<AcademicStructureAuditPage>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Request aborted', 'AbortError')), { once: true })
      })
    })
    const client = createClient(getStructureAuditEvents)
    const { rerender } = render(<AcademicStructureAuditPanel canRead accessToken="synthetic-token" client={client} />)
    await waitFor(() => expect(getStructureAuditEvents).toHaveBeenCalledTimes(1))

    // Act
    rerender(<AcademicStructureAuditPanel canRead={false} accessToken="synthetic-token" client={client} />)

    // Assert
    expect(requestSignal?.aborted).toBe(true)
    expect(screen.queryByRole('region', { name: /bitácora de estructura académica/i })).not.toBeInTheDocument()
  })
})
