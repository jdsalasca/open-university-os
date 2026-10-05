type AcademicPermissionArea = 'catalog' | 'structure' | 'period' | 'offerings'
type PermissionAction = 'read' | 'write'

export type ApplicationPermission =
  | 'branding:read'
  | 'branding:write'
  | `academic:${AcademicPermissionArea}:${PermissionAction}`
  | 'admissions:calendar:read'
  | 'admissions:calendar:write'
  | 'identity:roles:read'
  | 'identity:roles:write'
  | 'library:read'
  | 'library:write'
  | 'notices:read'
  | 'notices:write'

const academicPermissionAreas: readonly AcademicPermissionArea[] = ['catalog', 'structure', 'period', 'offerings']
const permissionActions: readonly PermissionAction[] = ['read', 'write']
const academicPermissions: ApplicationPermission[] = academicPermissionAreas.flatMap((area) =>
  permissionActions.map((action) => `academic:${area}:${action}` as ApplicationPermission))

export const APPLICATION_PERMISSIONS: readonly ApplicationPermission[] = [
  'branding:read',
  'branding:write',
  ...academicPermissions,
  'admissions:calendar:read',
  'admissions:calendar:write',
  'identity:roles:read',
  'identity:roles:write',
  'library:read',
  'library:write',
  'notices:read',
  'notices:write',
]

export interface CurrentIdentity {
  userId: string
  subject: string
  permissions: ApplicationPermission[]
}

export interface IdentityClient {
  current(accessToken: string, signal?: AbortSignal): Promise<CurrentIdentity>
}
