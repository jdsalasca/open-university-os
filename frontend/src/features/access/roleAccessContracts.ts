export const ROLE_PROFILE_KEYS = [
  'APPLICANT',
  'ADMITTED',
  'STUDENT',
  'TEACHER',
  'ADMINISTRATIVE',
  'ADMISSIONS',
  'DIRECTIVE',
  'ADMINISTRATOR',
] as const

export type RoleProfileKey = (typeof ROLE_PROFILE_KEYS)[number]

export const ROLE_SCOPE_KINDS = ['UNIVERSITY', 'SITE', 'FACULTY', 'PROGRAM', 'JOB_APPOINTMENT'] as const
export type RoleScopeKind = (typeof ROLE_SCOPE_KINDS)[number]

export type RoleAccessPermission = 'identity:roles:read' | 'identity:roles:write'
export type RoleAssignmentStatus = 'ACTIVE' | 'REVOKED'

export interface RoleProfile {
  key: RoleProfileKey
  displayName: string
  manuallyAssignable: boolean
  allowedScopeKinds: RoleScopeKind[]
  permissions: RoleAccessPermission[]
}

export interface IdentityDirectoryEntry {
  userId: string
  issuer: string
  subject: string
}

export interface RoleScope {
  kind: RoleScopeKind
  reference: string | null
}

export interface StoredRoleScope {
  kind: RoleScopeKind
  stableReference: string | null
}

export interface RoleAssignment {
  assignmentId: string
  targetUserId: string
  profileKey: RoleProfileKey
  scopes: StoredRoleScope[]
  status: RoleAssignmentStatus
  validFrom: string
  validThrough: string | null
  sourceReference: string
  createdAt: string
  version: number
}

export interface CreateRoleAssignmentCommand {
  targetUserId: string
  profileKey: RoleProfileKey
  scopes: RoleScope[]
  validFrom: string
  validThrough: string | null
  sourceReference: string
}

export interface RevokeRoleAssignmentCommand {
  expectedVersion: number
  sourceReference: string
}

export interface RoleAccessClient {
  roleProfiles(accessToken: string, signal?: AbortSignal): Promise<RoleProfile[]>
  searchIdentities(subjectPrefix: string, limit: number, accessToken: string, signal?: AbortSignal): Promise<IdentityDirectoryEntry[]>
  assignments(userId: string, accessToken: string, signal?: AbortSignal): Promise<RoleAssignment[]>
  assign(command: CreateRoleAssignmentCommand, accessToken: string, signal?: AbortSignal): Promise<RoleAssignment>
  revoke(assignmentId: string, command: RevokeRoleAssignmentCommand, accessToken: string, signal?: AbortSignal): Promise<RoleAssignment>
}
