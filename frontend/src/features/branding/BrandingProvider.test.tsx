import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BrandingProvider } from './BrandingProvider'
import { DEFAULT_BRANDING, parsePublicBranding } from './contracts'
import { useBranding } from './useBranding'
import type { PublicBranding } from './contracts'

const apiBranding: PublicBranding = {
  revision: 7,
  institutionName: 'Universidad Pedagógica y Tecnológica de Colombia',
  colors: {
    primary: '#123456',
    ink: '#1A1A1A',
    surface: '#FFFFFF',
    text: '#1A1A1A',
    accent: '#FFCC29',
    focus: '#1A1A1A',
  },
  assets: { logoLight: null, logoDark: null, favicon: null },
  modules: [],
  banners: [],
}

function BrandingProbe() {
  const { branding, status } = useBranding()
  return <output aria-label="estado de identidad">{`${status}:${branding.revision}:${branding.institutionName}`}</output>
}

function jsonResponse(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }))
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  document.documentElement.removeAttribute('style')
  document.title = 'frontend'
  document.querySelectorAll('link[rel~="icon"]').forEach((link) => link.remove())
})

describe('BrandingProvider', () => {
  it('keeps the public space guide as a configurable module and validates its label and visibility', () => {
    // Arrange
    const payload = {
      ...DEFAULT_BRANDING,
      modules: DEFAULT_BRANDING.modules.map((module) => module.key === 'spaces'
        ? { ...module, label: 'Sedes y puntos de atención', visible: false }
        : module),
    }

    // Act
    const branding = parsePublicBranding(payload)
    const spacesModule = branding.modules.find((module) => module.key === 'spaces')

    // Assert
    expect(spacesModule).toMatchObject({
      key: 'spaces', available: true, visible: false, label: 'Sedes y puntos de atención', order: 70,
    })
  })

  it('applies the API palette as CSS variables', async () => {
    // Arrange
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(jsonResponse(apiBranding)))

    // Act
    render(<BrandingProvider><BrandingProbe /></BrandingProvider>)

    // Assert
    await waitFor(() => {
      expect(screen.getByLabelText('estado de identidad')).toHaveTextContent('ready:7:')
      expect(document.documentElement.style.getPropertyValue('--brand-primary')).toBe('#123456')
      expect(document.documentElement.style.getPropertyValue('--brand-ink')).toBe('#1A1A1A')
    })
  })

  it('uses the official identity when the public API is unavailable', async () => {
    // Arrange
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    // Act
    render(<BrandingProvider><BrandingProbe /></BrandingProvider>)

    // Assert
    await waitFor(() => expect(screen.getByLabelText('estado de identidad')).toHaveTextContent('fallback:1:'))
    expect(document.documentElement.style.getPropertyValue('--brand-primary')).toBe('#FFCC29')
    expect(document.documentElement.style.getPropertyValue('--brand-text')).toBe('#1A1A1A')
  })

  it('replaces malformed untrusted colors with official defaults', async () => {
    // Arrange
    const malformed = {
      ...apiBranding,
      colors: { ...apiBranding.colors, primary: 'url(javascript:alert(1))' },
    }
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(jsonResponse(malformed)))

    // Act
    render(<BrandingProvider><BrandingProbe /></BrandingProvider>)

    // Assert
    await waitFor(() => expect(screen.getByLabelText('estado de identidad')).toHaveTextContent('ready:7:'))
    expect(document.documentElement.style.getPropertyValue('--brand-primary')).toBe('#FFCC29')
  })

  it('updates the document title and favicon from the validated public identity', async () => {
    // Arrange
    const favicon = document.createElement('link')
    favicon.rel = 'icon'
    favicon.href = '/favicon.svg'
    document.head.append(favicon)
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(jsonResponse({
      ...apiBranding,
      institutionName: 'Universidad de prueba institucional',
      assets: { ...apiBranding.assets, favicon: 'a7e7f06b-09a7-43db-a468-4c7b8ee3d301' },
    })))

    // Act
    render(<BrandingProvider><BrandingProbe /></BrandingProvider>)

    // Assert
    await waitFor(() => {
      expect(document.title).toBe('Universidad de prueba institucional · Plataforma Universitaria')
      expect(favicon.getAttribute('href')).toBe('/assets/a7e7f06b-09a7-43db-a468-4c7b8ee3d301')
    })
  })

  it('falls back and aborts a request that exceeds the loading timeout', async () => {
    // Arrange
    vi.useFakeTimers()
    let requestSignal: AbortSignal | undefined
    const loader = vi.fn((signal: AbortSignal) => {
      requestSignal = signal
      return new Promise<PublicBranding>(() => undefined)
    })

    // Act
    render(<BrandingProvider loader={loader} timeoutMs={40}><BrandingProbe /></BrandingProvider>)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(41)
    })

    // Assert
    expect(screen.getByLabelText('estado de identidad')).toHaveTextContent('fallback:1:')
    expect(requestSignal?.aborted).toBe(true)
  })
})
