import { containsAsciiControlCharacters } from '../../shared/inputValidation'

export interface OidcSettings {
  authority: string
  clientId: string
  redirectUri: string
  postLogoutRedirectUri: string
  scope: string
}

export type OidcConfigurationResult =
  | { status: 'unconfigured' }
  | { status: 'invalid' }
  | { status: 'configured'; settings: OidcSettings }

export interface OidcEnvironment {
  VITE_OIDC_AUTHORITY?: unknown
  VITE_OIDC_CLIENT_ID?: unknown
  VITE_OIDC_REDIRECT_URI?: unknown
  VITE_OIDC_POST_LOGOUT_REDIRECT_URI?: unknown
  VITE_OIDC_SCOPE?: unknown
}

export function parseOidcConfiguration(environment: OidcEnvironment, applicationOrigin: string): OidcConfigurationResult {
  const authorityValue = readValue(environment.VITE_OIDC_AUTHORITY)
  const clientId = readValue(environment.VITE_OIDC_CLIENT_ID)
  const redirectUri = readValue(environment.VITE_OIDC_REDIRECT_URI)
  const postLogoutRedirectUri = readValue(environment.VITE_OIDC_POST_LOGOUT_REDIRECT_URI)
  const configuredValues = [authorityValue, clientId, redirectUri, postLogoutRedirectUri]

  if (configuredValues.every((value) => value === '')) return { status: 'unconfigured' }
  if (configuredValues.some((value) => value === '')) return { status: 'invalid' }

  const scope = readValue(environment.VITE_OIDC_SCOPE) || 'openid'
  if (!isSafeClientId(clientId) || !isValidScope(scope)) return { status: 'invalid' }

  let provider: URL
  let redirect: URL
  let postLogoutRedirect: URL
  let application: URL
  try {
    provider = new URL(authorityValue)
    redirect = new URL(redirectUri)
    postLogoutRedirect = new URL(postLogoutRedirectUri)
    application = new URL(applicationOrigin)
  } catch {
    return { status: 'invalid' }
  }

  const developmentOrigin = isLoopback(application.hostname)
  const secureProvider = provider.protocol === 'https:'
    || (provider.protocol === 'http:' && developmentOrigin && isLoopback(provider.hostname))
  if (!secureProvider
    || provider.username !== ''
    || provider.password !== ''
    || provider.search !== ''
    || provider.hash !== ''
    || application.origin !== applicationOrigin
    || !isExactLocalCallback(redirect, redirectUri, application.origin, '/auth/callback')
    || !isExactLocalCallback(postLogoutRedirect, postLogoutRedirectUri, application.origin, '/')) {
    return { status: 'invalid' }
  }

  return {
    status: 'configured',
    settings: {
      authority: authorityValue,
      clientId,
      redirectUri,
      postLogoutRedirectUri,
      scope,
    },
  }
}

function isExactLocalCallback(url: URL, original: string, origin: string, pathname: string): boolean {
  return url.origin === origin
    && url.pathname === pathname
    && url.search === ''
    && url.hash === ''
    && url.username === ''
    && url.password === ''
    && url.href === original
}

function isSafeClientId(value: string): boolean {
  return value.length > 0
    && value.length <= 255
    && !/\s/u.test(value)
    && !containsAsciiControlCharacters(value)
}

function isValidScope(value: string): boolean {
  if (value.length > 512 || containsAsciiControlCharacters(value)) return false
  const scopes = value.split(' ')
  return scopes.every(Boolean)
    && new Set(scopes).size === scopes.length
    && scopes.includes('openid')
    && !scopes.includes('offline_access')
    && scopes.every(isValidScopeToken)
}

function isValidScopeToken(value: string): boolean {
  return [...value].every((character) => {
    const code = character.codePointAt(0) ?? 0
    return code === 0x21 || (code >= 0x23 && code <= 0x5b) || (code >= 0x5d && code <= 0x7e)
  })
}

function isLoopback(hostname: string): boolean {
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '[::1]'
}

function readValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}
