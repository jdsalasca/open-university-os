import { describe, expect, it } from 'vitest'
import { parseCurrentIdentity } from './identityClient'

/**
 * Mirrors `co.edu.uptc.universiry.security.ApplicationPermission`, plus the assertion in
 * LocalPreviewSessionControllerTest that the local preview issues exactly 18 permissions. The identity parser
 * rejects the whole response when it meets a permission it does not know, so this list must stay in step with the
 * server.
 */
const SERVER_PERMISSIONS = [
  'branding:read', 'branding:write',
  'academic:catalog:read', 'academic:catalog:write',
  'academic:structure:read', 'academic:structure:write',
  'academic:period:read', 'academic:period:write',
  'academic:offerings:read', 'academic:offerings:write',
  'admissions:calendar:read', 'admissions:calendar:write',
  'notices:read', 'notices:write',
  'library:read', 'library:write',
  'identity:roles:read', 'identity:roles:write',
]

const USER_ID = '3f1c0c1e-6c2f-4a1f-9d1a-4d0f9b1c2a3b'

describe('identity permission contract', () => {
  it('accepts every permission the server can grant', () => {
    // Arrange: the server enum holds 18 values, and the local preview issues all of them.
    expect(SERVER_PERMISSIONS).toHaveLength(18)

    // Act + Assert
    expect(() => parseCurrentIdentity({ userId: USER_ID, subject: 'subject-1', permissions: SERVER_PERMISSIONS }))
      .not.toThrow()
  })

  it('still rejects a permission the server never defined', () => {
    // Arrange
    const unknown = [...SERVER_PERMISSIONS, 'library:destroy']

    // Act + Assert
    expect(() => parseCurrentIdentity({ userId: USER_ID, subject: 'subject-1', permissions: unknown })).toThrow()
  })

  it('names the offending permission so a rejected session is diagnosable', () => {
    // Arrange: without the name, a session lockout looks identical to a broken response.
    const permissions = [...SERVER_PERMISSIONS, 'notices:destroy']

    // Act + Assert
    expect(() => parseCurrentIdentity({ userId: USER_ID, subject: 'subject-1', permissions }))
      .toThrow(/notices:destroy/)
  })
})
