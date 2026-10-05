import { useContext } from 'react'
import { BrandingContext } from './BrandingContext'
import type { BrandingContextValue } from './BrandingContext'

export function useBranding(): BrandingContextValue {
  const context = useContext(BrandingContext)
  if (!context) throw new Error('useBranding must be rendered inside BrandingProvider.')
  return context
}
