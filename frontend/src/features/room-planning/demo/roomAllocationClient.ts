import type {
  RoomAllocationProposal,
  RoomAssignmentStatus,
  RoomPlanningScenario,
  RoomUnassignmentReason,
} from './roomAllocationContracts'

export interface RoomAllocationClient {
  propose(scenario: RoomPlanningScenario, accessToken: string, signal?: AbortSignal): Promise<RoomAllocationProposal>
}

export class RoomAllocationApiError extends Error {
  readonly status: number

  constructor(status: number) {
    super(messageForStatus(status))
    this.name = 'RoomAllocationApiError'
    this.status = status
  }
}

export function createRoomAllocationClient(fetcher: typeof fetch = fetch): RoomAllocationClient {
  return {
    async propose(scenario, accessToken, signal) {
      if (!accessToken.trim()) throw new Error('A local preview session is required.')

      const response = await fetcher('/api/v1/dev/room-allocation/proposals', {
        method: 'POST',
        credentials: 'omit',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scenario),
        signal,
      })
      if (!response.ok) throw new RoomAllocationApiError(response.status)

      let body: unknown
      try {
        body = await response.json()
      } catch {
        throw malformedResponse()
      }
      return parseProposal(body)
    },
  }
}

function parseProposal(input: unknown): RoomAllocationProposal {
  if (!isRecord(input)
    || !isNonNegativeInteger(input.assignedGroups)
    || !isNonNegativeInteger(input.unassignedGroups)
    || !isNonNegativeInteger(input.unusedSeats)
    || !Array.isArray(input.placements)
    || input.placements.length > 12) {
    throw malformedResponse()
  }

  const placements = input.placements.map(parsePlacement)
  const groupCodes = placements.map(({ groupCode }) => groupCode)
  if (new Set(groupCodes).size !== groupCodes.length
    || input.assignedGroups + input.unassignedGroups !== placements.length
    || placements.filter(({ status }) => status === 'ASSIGNED').length !== input.assignedGroups) {
    throw malformedResponse()
  }

  return {
    assignedGroups: input.assignedGroups,
    unassignedGroups: input.unassignedGroups,
    unusedSeats: input.unusedSeats,
    placements,
  }
}

function parsePlacement(input: unknown): RoomAllocationProposal['placements'][number] {
  if (!isRecord(input)
    || typeof input.groupCode !== 'string'
    || input.groupCode.trim().length === 0
    || input.groupCode.length > 32
    || (input.status !== 'ASSIGNED' && input.status !== 'UNASSIGNED')) {
    throw malformedResponse()
  }

  const status = input.status as RoomAssignmentStatus
  if (status === 'ASSIGNED') {
    if (typeof input.roomCode !== 'string'
      || input.roomCode.trim().length === 0
      || input.roomCode.length > 32
      || !isNonNegativeInteger(input.remainingSeats)
      || input.reason !== null) {
      throw malformedResponse()
    }
    return {
      groupCode: input.groupCode,
      status,
      roomCode: input.roomCode,
      remainingSeats: input.remainingSeats,
      reason: null,
    }
  }

  if (input.roomCode !== null || input.remainingSeats !== null || !isUnassignmentReason(input.reason)) {
    throw malformedResponse()
  }
  return {
    groupCode: input.groupCode,
    status,
    roomCode: null,
    remainingSeats: null,
    reason: input.reason,
  }
}

function isUnassignmentReason(value: unknown): value is RoomUnassignmentReason {
  return value === 'NO_ACTIVE_ROOMS'
    || value === 'INSUFFICIENT_CAPACITY'
    || value === 'MISSING_REQUIRED_FEATURES'
    || value === 'TIME_CONFLICT'
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function messageForStatus(status: number): string {
  if (status === 401 || status === 403) return 'La sesión local no tiene acceso a este preview. Vuelve a iniciarla.'
  if (status === 422) return 'El escenario excede el presupuesto de cálculo. Usa un escenario más pequeño.'
  if (status === 400) return 'El escenario de ejemplo no es válido.'
  return 'No fue posible calcular la propuesta. Inténtalo de nuevo.'
}

function malformedResponse(): Error {
  return new Error('The room allocation response is malformed.')
}
