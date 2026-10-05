import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IdentityProvider } from './IdentityProvider'
import type { OidcConfigurationResult } from './oidcConfiguration'
import { useIdentity } from './identityContext'

const oidcImplementation = vi.hoisted(() => ({ loadCount: 0, managerCreateCount: 0, failFirstManagerCreation: false }))

vi.mock('./identitySessionManager', () => {
  oidcImplementation.loadCount += 1
  return {
    createOidcUserManager: () => {
      oidcImplementation.managerCreateCount += 1
      if (oidcImplementation.failFirstManagerCreation && oidcImplementation.managerCreateCount === 1) {
        throw new Error('Transient OIDC manager initialization failure')
      }
      return {
        getUser: async () => null,
        signinRedirect: async () => {},
        signinCallback: async () => undefined,
        signoutRedirect: async () => {},
        removeUser: async () => {},
      }
    },
  }
})

const configured: OidcConfigurationResult = {
  status: 'configured',
  settings: {
    authority: 'https://identity.example.edu.co',
    clientId: 'universiry-web',
    redirectUri: 'https://universiry.example.edu.co/auth/callback',
    postLogoutRedirectUri: 'https://universiry.example.edu.co/',
    scope: 'openid university-api',
  },
}

function IdentityStatus() {
  const { state, retry } = useIdentity()
  return (
    <>
      <p role="status">{state.status}{state.status === 'error' ? `:${state.message}` : ''}</p>
      <button type="button" onClick={() => void retry()}>Reintentar</button>
    </>
  )
}

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  oidcImplementation.managerCreateCount = 0
  oidcImplementation.failFirstManagerCreation = false
})

describe('IdentityProvider OIDC loading', () => {
  it('does not load the OIDC implementation when institutional login is unconfigured', () => {
    // Arrange
    const configuration: OidcConfigurationResult = { status: 'unconfigured' }

    // Act
    render(
      <IdentityProvider configuration={configuration}>
        <IdentityStatus />
      </IdentityProvider>,
    )

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent('unconfigured')
    expect(oidcImplementation.loadCount).toBe(0)
  })

  it('loads the OIDC implementation to restore a configured session', async () => {
    // Arrange
    const configuration = configured

    // Act
    render(
      <IdentityProvider configuration={configuration}>
        <IdentityStatus />
      </IdentityProvider>,
    )

    // Assert
    // Wait for the content, not just for a status node: the loading state already has role="status".
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('anonymous'))
    expect(oidcImplementation.loadCount).toBe(1)
  })

  it('retries manager initialization after a transient failure', async () => {
    // Arrange
    const user = userEvent.setup()
    oidcImplementation.managerCreateCount = 0
    oidcImplementation.failFirstManagerCreation = true
    render(
      <IdentityProvider configuration={configured}>
        <IdentityStatus />
      </IdentityProvider>,
    )

    // Act
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('error'))
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    // Assert
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('anonymous'))
    expect(oidcImplementation.managerCreateCount).toBe(2)
  })
})
