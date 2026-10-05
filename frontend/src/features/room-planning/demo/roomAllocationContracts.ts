export type RoomFeature = 'PROJECTOR' | 'COMPUTER_STATIONS' | 'LAB_BENCHES' | 'WHITEBOARD'

export type RoomDay = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY'

export type RoomAssignmentStatus = 'ASSIGNED' | 'UNASSIGNED'

export type RoomUnassignmentReason =
  | 'NO_ACTIVE_ROOMS'
  | 'INSUFFICIENT_CAPACITY'
  | 'MISSING_REQUIRED_FEATURES'
  | 'TIME_CONFLICT'

export interface RoomMeeting {
  day: RoomDay
  startsAt: string
  endsAt: string
}

export interface RoomPlanningGroup {
  code: string
  expectedEnrollment: number
  requiredFeatures: RoomFeature[]
  meetings: RoomMeeting[]
}

export interface RoomPlanningRoom {
  code: string
  capacity: number
  active: boolean
  features: RoomFeature[]
}

export interface RoomPlanningScenario {
  groups: RoomPlanningGroup[]
  rooms: RoomPlanningRoom[]
}

export interface RoomPlacement {
  groupCode: string
  status: RoomAssignmentStatus
  roomCode: string | null
  remainingSeats: number | null
  reason: RoomUnassignmentReason | null
}

export interface RoomAllocationProposal {
  assignedGroups: number
  unassignedGroups: number
  unusedSeats: number
  placements: RoomPlacement[]
}
