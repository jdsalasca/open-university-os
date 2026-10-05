import { createContext } from 'react'
import type { PublicBranding } from './contracts'

export type BrandingStatus = 'loading' | 'ready' | 'fallback'

export interface BrandingContextValue {
  branding: PublicBranding
  status: BrandingStatus
  refresh: () => void
}

export const BrandingContext = createContext<BrandingContextValue | null>(null)
