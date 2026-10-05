import { describe, expect, it, vi } from 'vitest'
import type { RoomPlanningScenario } from './roomAllocationContracts'

const clientModules = import.meta.glob<typeof import('./roomAllocationClient')>('./roomAllocationClient.ts')

async function loadClient() {
  const loader = clientModules['./roomAllocationClient.ts']
  expect(loader, 'the room allocation client is implemented').toBeTypeOf('function')
  return loader!()
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const scenario: RoomPlanningScenario = {
  groups: [{
    code: 'DEMO-GRP-01',
    expectedEnrollment: 16,
    requiredFeatures: ['PROJECTOR'],
    meetings: [{ day: 'MONDAY', startsAt: '08:00', endsAt: '10:00' }],
  }],
  rooms: [{ code: 'DEMO-ROOM-01', capacity: 20, active: true, features: ['PROJECTOR'] }],
}

const proposal = {
  assignedGroups: 1,
  unassignedGroups: 0,
  unusedSeats: 4,
  placements: [{
    groupCode: 'DEMO-GRP-01',
    status: 'ASSIGNED',
    roomCode: 'DEMO-ROOM-01',
    remainingSeats: 4,
    reason: null,
  }],
}

describe('room allocation client', () => {
  it('posts the selected synthetic scenario with an ephemeral bearer and abort signal', async () => {
    // Arrange
    const { createRoomAllocationClient } = await loadClient()
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(proposal))
    const client = createRoomAllocationClient(fetcher)
    const controller = new AbortController()

    // Act
    const result = await client.propose(scenario, 'synthetic-preview-token', controller.signal)

    // Assert
    expect(result).toEqual(proposal)
    expect(fetcher).toHaveBeenCalledWith('/api/v1/dev/room-allocation/proposals', {
      method: 'POST',
      credentials: 'omit',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer synthetic-preview-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(scenario),
      signal: controller.signal,
    })
  })

  it('surfaces the server status without exposing a response body as trusted content', async () => {
    // Arrange
    const { createRoomAllocationClient, RoomAllocationApiError } = await loadClient()
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ detail: 'internal stack trace' }, 422))
    const client = createRoomAllocationClient(fetcher)

    // Act
    let thrown: unknown
    try {
      await client.propose(scenario, 'synthetic-preview-token')
    } catch (error) {
      thrown = error
    }

    // Assert
    expect(thrown).toBeInstanceOf(RoomAllocationApiError)
    expect(thrown).toMatchObject({ status: 422 })
    expect((thrown as Error).message).not.toContain('internal stack trace')
  })

  it('rejects a proposal with inconsistent counts or an unknown assignment status', async () => {
    // Arrange
    const { createRoomAllocationClient } = await loadClient()
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({
      ...proposal,
      assignedGroups: 0,
      placements: [{ ...proposal.placements[0], status: 'MAYBE' }],
    }))
    const client = createRoomAllocationClient(fetcher)

    // Act + Assert
    await expect(client.propose(scenario, 'synthetic-preview-token')).rejects.toThrow(/malformed/i)
  })

  it('rejects a blank local-preview token before making a request', async () => {
    // Arrange
    const { createRoomAllocationClient } = await loadClient()
    const fetcher = vi.fn()
    const client = createRoomAllocationClient(fetcher)

    // Act + Assert
    await expect(client.propose(scenario, '  ')).rejects.toThrow(/session/i)
    expect(fetcher).not.toHaveBeenCalled()
  })
})
