import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RoomAllocationClient } from './roomAllocationClient'
import type { RoomAllocationProposal, RoomPlanningScenario } from './roomAllocationContracts'

const demoModules = import.meta.glob<typeof import('./RoomAllocationDemo')>('./RoomAllocationDemo.tsx')

async function loadDemo() {
  const loader = demoModules['./RoomAllocationDemo.tsx']
  expect(loader, 'the room allocation demo is implemented').toBeTypeOf('function')
  return loader!()
}

afterEach(() => cleanup())

const proposal: RoomAllocationProposal = {
  assignedGroups: 1,
  unassignedGroups: 1,
  unusedSeats: 4,
  placements: [{
    groupCode: 'DEMO-GRP-01',
    status: 'ASSIGNED',
    roomCode: 'DEMO-ROOM-01',
    remainingSeats: 4,
    reason: null,
  }, {
    groupCode: 'DEMO-GRP-02',
    status: 'UNASSIGNED',
    roomCode: null,
    remainingSeats: null,
    reason: 'TIME_CONFLICT',
  }],
}

function createClient(propose = vi.fn().mockResolvedValue(proposal)) {
  return { propose } as unknown as RoomAllocationClient
}

describe('RoomAllocationDemo', () => {
  it('shows synthetic sample scenarios and does not calculate without a local-preview session', async () => {
    // Arrange
    const { RoomAllocationDemo } = await loadDemo()
    const propose = vi.fn()

    // Act
    render(<RoomAllocationDemo session={null} client={createClient(propose)} />)

    // Assert
    expect(screen.getByText(/escenarios totalmente sintéticos/i)).toBeVisible()
    expect(screen.getByRole('combobox', { name: /escenario/i })).toBeVisible()
    expect(screen.getByRole('button', { name: /calcular propuesta/i })).toBeDisabled()
    expect(screen.getByText(/inicia el preview local/i)).toBeVisible()
    expect(propose).not.toHaveBeenCalled()
  })

  it('submits the selected scenario and renders the assigned and unassigned groups', async () => {
    // Arrange
    const { RoomAllocationDemo } = await loadDemo()
    const user = userEvent.setup()
    const propose = vi.fn().mockResolvedValue(proposal)
    render(<RoomAllocationDemo
      session={{ type: 'local-preview', accessToken: 'synthetic-preview-token' }}
      client={createClient(propose)}
    />)

    // Act
    await user.click(screen.getByRole('button', { name: /calcular propuesta/i }))

    // Assert
    expect(await screen.findByText(/1 de 2 grupos asignados/i)).toBeVisible()
    expect(screen.getByText('DEMO-GRP-01')).toBeVisible()
    expect(screen.getByText(/DEMO-ROOM-01/)).toBeVisible()
    expect(screen.getByText('DEMO-GRP-02')).toBeVisible()
    expect(within(screen.getByRole('list', { name: 'Resultado de asignación' }))
      .getByText(/conflicto de horario con las aulas disponibles/i)).toBeVisible()
    expect(propose).toHaveBeenCalledWith(expect.objectContaining({
      groups: expect.arrayContaining([expect.objectContaining({ code: 'DEMO-GRP-01' })]),
      rooms: expect.arrayContaining([expect.objectContaining({ code: 'DEMO-AULA-01' })]),
    }), 'synthetic-preview-token', expect.any(AbortSignal))
  })

  it('sends the selected limited scenario rather than recalculating the default sample', async () => {
    // Arrange
    const { RoomAllocationDemo } = await loadDemo()
    const user = userEvent.setup()
    const limitedProposal: RoomAllocationProposal = {
      assignedGroups: 2,
      unassignedGroups: 1,
      unusedSeats: 4,
      placements: [
        { groupCode: 'DEMO-GRP-11', status: 'ASSIGNED', roomCode: 'DEMO-AULA-11', remainingSeats: 2, reason: null },
        { groupCode: 'DEMO-GRP-12', status: 'ASSIGNED', roomCode: 'DEMO-AULA-12', remainingSeats: 2, reason: null },
        { groupCode: 'DEMO-GRP-13', status: 'UNASSIGNED', roomCode: null, remainingSeats: null, reason: 'TIME_CONFLICT' },
      ],
    }
    const propose = vi.fn().mockResolvedValue(limitedProposal)
    render(<RoomAllocationDemo
      session={{ type: 'local-preview', accessToken: 'synthetic-preview-token' }}
      client={createClient(propose)}
    />)

    // Act
    await user.selectOptions(screen.getByRole('combobox', { name: /escenario/i }), 'limited')
    await user.click(screen.getByRole('button', { name: /calcular propuesta/i }))

    // Assert
    expect(await screen.findByText(/2 de 3 grupos asignados/i)).toBeVisible()
    const submittedScenario = propose.mock.calls[0]?.[0] as RoomPlanningScenario
    expect(submittedScenario.groups.map(({ code }) => code))
      .toEqual(['DEMO-GRP-11', 'DEMO-GRP-12', 'DEMO-GRP-13'])
  })

  it('reports a failed request and retries only after an explicit user action', async () => {
    // Arrange
    const { RoomAllocationDemo } = await loadDemo()
    const user = userEvent.setup()
    const propose = vi.fn()
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce(proposal)
    render(<RoomAllocationDemo
      session={{ type: 'local-preview', accessToken: 'synthetic-preview-token' }}
      client={createClient(propose)}
    />)

    // Act + Assert
    await user.click(screen.getByRole('button', { name: /calcular propuesta/i }))
    expect(await screen.findByRole('alert')).toBeVisible()
    expect(propose).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: /reintentar cálculo/i }))
    expect(await screen.findByText(/1 de 2 grupos asignados/i)).toBeVisible()
    expect(propose).toHaveBeenCalledTimes(2)
  })

  it('aborts in-flight work and clears the proposal when local preview access is lost', async () => {
    // Arrange
    const { RoomAllocationDemo } = await loadDemo()
    const user = userEvent.setup()
    let requestSignal: AbortSignal | undefined
    const propose = vi.fn((_scenario: RoomPlanningScenario, _token: string, signal: AbortSignal) => {
      requestSignal = signal
      return new Promise<RoomAllocationProposal>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Request aborted', 'AbortError')), { once: true })
      })
    })
    const { rerender } = render(<RoomAllocationDemo
      session={{ type: 'local-preview', accessToken: 'synthetic-preview-token' }}
      client={createClient(propose)}
    />)

    // Act
    await user.click(screen.getByRole('button', { name: /calcular propuesta/i }))
    await waitFor(() => expect(propose).toHaveBeenCalledOnce())
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/comparando horarios, aforo y recursos/i))
    rerender(<RoomAllocationDemo session={null} client={createClient(propose)} />)

    // Assert
    expect(requestSignal?.aborted).toBe(true)
    expect(screen.getByRole('button', { name: /calcular propuesta/i })).toBeDisabled()
    expect(screen.getByText(/inicia el preview local/i)).toBeVisible()
  })
})
