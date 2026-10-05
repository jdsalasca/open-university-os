import { parsePublicBranding } from '../contracts'
import type { PublicBranding } from '../contracts'

export async function getPublicBranding(signal?: AbortSignal): Promise<PublicBranding> {
  const response = await fetch('/api/v1/branding', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) throw new Error(`Branding request failed with status ${response.status}`)
  return parsePublicBranding(await response.json())
}
