import { createContext, useContext } from 'react'
import type { ApplicationPermission } from './identityContracts'

export type IdentitySessionState =
  | { status: 'unconfigured' }
  | { status: 'loading' }
  | { status: 'anonymous'; reason: 'signed-out' | 'expired' }
  | { status: 'authenticated'; accessToken: string; expiresAt: number; subject: string; permissions: ApplicationPermission[]; sessionType?: 'institutional' | 'local-preview' }
  | { status: 'error'; message: string }

export interface IdentityContextValue {
  state: IdentitySessionState
  loginAvailable: boolean
  localPreviewAvailable: boolean
  login(): Promise<void>
  logout(): Promise<void>
  retry(): Promise<void>
}

export const IdentityContext = createContext<IdentityContextValue | undefined>(undefined)

export function useIdentity(): IdentityContextValue {
  const context = useContext(IdentityContext)
  if (!context) throw new Error('useIdentity must be used within IdentityProvider.')
  return context
}
