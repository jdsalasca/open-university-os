import { parsePublicBranding } from '../contracts'
import type { PublicBranding } from '../contracts'

export interface UploadedBrandAsset {
  assetId: string
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
  sizeBytes: number
  width: number
  height: number
}

export interface BrandingChangePayload {
  expectedRevision: number
  institutionName: string
  colors: PublicBranding['colors']
  assets: PublicBranding['assets']
  modules: PublicBranding['modules']
  banners: PublicBranding['banners']
}

export interface BrandingAdministrationClient {
  getCurrentConfiguration(accessToken: string): Promise<PublicBranding>
  uploadAsset(file: File, accessToken: string): Promise<UploadedBrandAsset>
  publishConfiguration(change: BrandingChangePayload, accessToken: string): Promise<PublicBranding>
  restoreRevision(targetRevision: number, expectedRevision: number, accessToken: string): Promise<PublicBranding>
}

export class BrandingAdministrationError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string) {
    super(`Branding administration request failed: ${code}`)
    this.name = 'BrandingAdministrationError'
    this.status = status
    this.code = code
  }
}

export class HttpBrandingAdministrationClient implements BrandingAdministrationClient {
  getCurrentConfiguration(accessToken: string): Promise<PublicBranding> {
    return this.requestBranding('/api/v1/admin/branding', {
      method: 'GET',
      headers: this.headers(accessToken),
    })
  }

  async uploadAsset(file: File, accessToken: string): Promise<UploadedBrandAsset> {
    const form = new FormData()
    form.append('file', file, file.name)
    const value = await this.requestJson('/api/v1/admin/branding/assets', {
      method: 'POST',
      headers: this.headers(accessToken),
      body: form,
    })
    return parseUploadedAsset(value)
  }

  publishConfiguration(change: BrandingChangePayload, accessToken: string): Promise<PublicBranding> {
    return this.requestBranding('/api/v1/admin/branding', {
      method: 'PUT',
      headers: { ...this.headers(accessToken), 'Content-Type': 'application/json' },
      body: JSON.stringify(change),
    })
  }

  restoreRevision(targetRevision: number, expectedRevision: number, accessToken: string): Promise<PublicBranding> {
    return this.requestBranding('/api/v1/admin/branding/rollback', {
      method: 'POST',
      headers: { ...this.headers(accessToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetRevision, expectedRevision }),
    })
  }

  private headers(accessToken: string): HeadersInit {
    const token = accessToken.trim()
    if (!token) throw new Error('Institutional authentication is required.')
    return { Accept: 'application/json', Authorization: `Bearer ${token}` }
  }

  private async requestBranding(path: string, init: RequestInit): Promise<PublicBranding> {
    return parsePublicBranding(await this.requestJson(path, init))
  }

  private async requestJson(path: string, init: RequestInit): Promise<unknown> {
    const response = await fetch(path, { ...init, credentials: 'omit' })
    if (!response.ok) {
      let code = 'request_failed'
      try {
        const body: unknown = await response.json()
        if (isRecord(body) && typeof body.error === 'string') code = body.error
      } catch {
        // Keep a safe error code when the server returns a non-JSON response.
      }
      throw new BrandingAdministrationError(response.status, code)
    }
    return response.json()
  }
}

function parseUploadedAsset(value: unknown): UploadedBrandAsset {
  if (!isRecord(value)
    || typeof value.assetId !== 'string'
    || !UUID_PATTERN.test(value.assetId)
    || !MIME_TYPES.includes(String(value.mimeType) as UploadedBrandAsset['mimeType'])
    || !Number.isSafeInteger(value.sizeBytes)
    || Number(value.sizeBytes) < 1
    || !Number.isSafeInteger(value.width)
    || Number(value.width) < 1
    || !Number.isSafeInteger(value.height)
    || Number(value.height) < 1) {
    throw new Error('The asset upload response is malformed.')
  }
  return {
    assetId: value.assetId,
    mimeType: value.mimeType as UploadedBrandAsset['mimeType'],
    sizeBytes: Number(value.sizeBytes),
    width: Number(value.width),
    height: Number(value.height),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MIME_TYPES: UploadedBrandAsset['mimeType'][] = ['image/png', 'image/jpeg', 'image/webp']

export const brandingAdministrationClient = new HttpBrandingAdministrationClient()
