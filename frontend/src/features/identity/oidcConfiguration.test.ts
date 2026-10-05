import { describe, expect, it } from 'vitest'

const configurationModules = import.meta.glob<typeof import('./oidcConfiguration')>('./oidcConfiguration.ts')

async function loadConfiguration() {
  const loader = configurationModules['./oidcConfiguration.ts']
  expect(loader, 'the OIDC configuration parser is implemented').toBeTypeOf('function')
  return loader!()
}

const origin = 'https://universiry.example.edu.co'

describe('OIDC browser configuration', () => {
  it('stays unconfigured when institutional provider values are absent', async () => {
    // Arrange
    const { parseOidcConfiguration } = await loadConfiguration()

    // Act
    const result = parseOidcConfiguration({}, origin)

    // Assert
    expect(result).toEqual({ status: 'unconfigured' })
  })

  it('accepts an explicitly registered same-origin Authorization Code callback', async () => {
    // Arrange
    const { parseOidcConfiguration } = await loadConfiguration()
    const environment = {
      VITE_OIDC_AUTHORITY: 'https://identity.example.edu.co/realms/university',
      VITE_OIDC_CLIENT_ID: 'universiry-web',
      VITE_OIDC_REDIRECT_URI: `${origin}/auth/callback`,
      VITE_OIDC_POST_LOGOUT_REDIRECT_URI: `${origin}/`,
      VITE_OIDC_SCOPE: 'openid university-api',
    }

    // Act
    const result = parseOidcConfiguration(environment, origin)

    // Assert
    expect(result).toEqual({
      status: 'configured',
      settings: {
        authority: 'https://identity.example.edu.co/realms/university',
        clientId: 'universiry-web',
        redirectUri: `${origin}/auth/callback`,
        postLogoutRedirectUri: `${origin}/`,
        scope: 'openid university-api',
      },
    })
  })

  it('rejects partial, non-secure remote, cross-origin and unregistered callback settings', async () => {
    // Arrange
    const { parseOidcConfiguration } = await loadConfiguration()
    const base = {
      VITE_OIDC_AUTHORITY: 'https://identity.example.edu.co',
      VITE_OIDC_CLIENT_ID: 'universiry-web',
      VITE_OIDC_REDIRECT_URI: `${origin}/auth/callback`,
      VITE_OIDC_POST_LOGOUT_REDIRECT_URI: `${origin}/`,
    }
    const invalidEnvironments = [
      { VITE_OIDC_AUTHORITY: base.VITE_OIDC_AUTHORITY },
      { ...base, VITE_OIDC_AUTHORITY: 'http://identity.example.edu.co' },
      { ...base, VITE_OIDC_REDIRECT_URI: 'https://other.example/auth/callback' },
      { ...base, VITE_OIDC_REDIRECT_URI: `${origin}/auth/callback?returnTo=/` },
      { ...base, VITE_OIDC_SCOPE: 'university-api' },
      { ...base, VITE_OIDC_SCOPE: 'openid offline_access' },
    ]

    // Act + Assert
    for (const environment of invalidEnvironments) {
      expect(parseOidcConfiguration(environment, origin).status).toBe('invalid')
    }
  })

  it('allows an HTTP provider only on loopback development origins', async () => {
    // Arrange
    const { parseOidcConfiguration } = await loadConfiguration()
    const environment = {
      VITE_OIDC_AUTHORITY: 'http://localhost:8081/realms/test',
      VITE_OIDC_CLIENT_ID: 'local-client',
      VITE_OIDC_REDIRECT_URI: 'http://localhost:5173/auth/callback',
      VITE_OIDC_POST_LOGOUT_REDIRECT_URI: 'http://localhost:5173/',
    }

    // Act
    const result = parseOidcConfiguration(environment, 'http://localhost:5173')

    // Assert
    expect(result.status).toBe('configured')
  })
})
