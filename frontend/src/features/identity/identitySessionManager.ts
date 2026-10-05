import {
  UserManager,
  WebStorageStateStore,
} from 'oidc-client-ts'
import type { StateStore } from 'oidc-client-ts'
import type { OidcSettings } from './oidcConfiguration'

export function createOidcUserManager(settings: OidcSettings, tabStorage: Storage = window.sessionStorage): UserManager {
  const stateStore = new WebStorageStateStore({
    store: tabStorage,
    prefix: 'universiry.oidc.state:',
  })
  const userStore = new InMemorySessionUserStore()

  return new UserManager({
    authority: settings.authority,
    client_id: settings.clientId,
    redirect_uri: settings.redirectUri,
    post_logout_redirect_uri: settings.postLogoutRedirectUri,
    response_type: 'code',
    scope: settings.scope,
    disablePKCE: false,
    automaticSilentRenew: false,
    loadUserInfo: false,
    monitorSession: false,
    monitorAnonymousSession: false,
    revokeTokensOnSignout: false,
    stateStore,
    userStore,
  })
}

class InMemorySessionUserStore implements StateStore {
  private readonly users = new Map<string, string>()

  async set(key: string, value: string): Promise<void> {
    this.users.set(key, this.sanitizeUser(key, value))
  }

  async get(key: string): Promise<string | null> {
    const value = this.users.get(key)
    if (value === undefined) return null

    const sanitized = this.sanitizeUser(key, value)
    if (sanitized !== value) this.users.set(key, sanitized)
    return sanitized
  }

  async remove(key: string): Promise<string | null> {
    const value = this.users.get(key) ?? null
    this.users.delete(key)
    return value
  }

  async getAllKeys(): Promise<string[]> {
    return [...this.users.keys()]
  }

  private sanitizeUser(key: string, value: string): string {
    if (!key.startsWith('user:')) return value

    try {
      const parsed: unknown = JSON.parse(value)
      if (!isRecord(parsed) || !isRecord(parsed.profile)) throw new Error('invalid user')

      const safeUser = { ...parsed }
      delete safeUser.refresh_token
      safeUser.profile = typeof parsed.profile.sub === 'string'
        ? { sub: parsed.profile.sub }
        : {}
      return JSON.stringify(safeUser)
    } catch {
      throw new Error('The OIDC session could not be stored safely.')
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
