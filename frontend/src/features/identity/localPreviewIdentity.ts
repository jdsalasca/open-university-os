import type { IdentityClient } from './identityContracts'
import type { IdentitySessionState } from './identityContext'
import type { LocalPreviewSessionClient } from './localPreviewSessionClient'

export async function createLocalPreviewIdentity(
  sessionClient: LocalPreviewSessionClient,
  identityClient: IdentityClient,
  signal: AbortSignal,
): Promise<{ accessToken: string; state: Extract<IdentitySessionState, { status: 'authenticated' }> }> {
  const session = await sessionClient.create(signal)
  try {
    if (session.expiresAt <= Date.now() / 1000) throw new Error('The local preview session has expired.')
    const current = await identityClient.current(session.accessToken, signal)
    if (session.expiresAt <= Date.now() / 1000) throw new Error('The local preview session has expired.')
    return {
      accessToken: session.accessToken,
      state: {
        status: 'authenticated',
        accessToken: session.accessToken,
        expiresAt: session.expiresAt,
        subject: current.subject,
        permissions: [...current.permissions],
        sessionType: 'local-preview',
      },
    }
  } catch (error) {
    await revokeLocalPreviewIdentity(sessionClient, session.accessToken)
    throw error
  }
}

export async function revokeLocalPreviewIdentity(
  sessionClient: LocalPreviewSessionClient | undefined,
  accessToken: string,
): Promise<void> {
  try {
    await sessionClient?.revoke(accessToken)
  } catch {
    // Clear the browser session even if the local server is unavailable.
  }
}
