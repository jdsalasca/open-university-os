export const OFFICIAL_COLORS = {
  primary: '#FFCC29',
  ink: '#1A1A1A',
  surface: '#FFFFFF',
  text: '#1A1A1A',
  accent: '#FFCC29',
  focus: '#1A1A1A',
} as const

export type BrandColorKey = keyof typeof OFFICIAL_COLORS

export const DEFAULT_MODULES = [
  { key: 'home', label: 'Inicio', available: true, visible: true, order: 10 },
  { key: 'students', label: 'Estudiantes', available: false, visible: false, order: 20 },
  { key: 'programs', label: 'Programas', available: false, visible: false, order: 30 },
  { key: 'curricula', label: 'Mallas curriculares', available: false, visible: false, order: 40 },
  { key: 'subjects', label: 'Asignaturas', available: false, visible: false, order: 50 },
  { key: 'academic-load', label: 'Carga académica', available: false, visible: false, order: 60 },
  { key: 'spaces', label: 'Guía de espacios', available: true, visible: true, order: 70 },
  { key: 'visual-identity', label: 'Identidad visual', available: true, visible: true, order: 90 },
  { key: 'admissions', label: 'Admisiones', available: true, visible: true, order: 100 },
] as const

export type BrandModuleKey = (typeof DEFAULT_MODULES)[number]['key']

export interface BrandAssets {
  logoLight: string | null
  logoDark: string | null
  favicon: string | null
}

export interface BrandModule {
  key: BrandModuleKey
  label: string
  available: boolean
  visible: boolean
  order: number
}

export interface BrandBanner {
  id: string
  assetId: string
  title: string
  altText: string
  placement: 'home-hero' | 'login-banner' | 'announcement-strip'
  order: number
  startsAt: string | null
  endsAt: string | null
}

export interface PublicBranding {
  revision: number
  institutionName: string
  colors: Record<BrandColorKey, string>
  assets: BrandAssets
  modules: BrandModule[]
  banners: BrandBanner[]
}

export const DEFAULT_BRANDING: PublicBranding = {
  revision: 1,
  institutionName: 'Universidad Pedagógica y Tecnológica de Colombia',
  colors: { ...OFFICIAL_COLORS },
  assets: { logoLight: null, logoDark: null, favicon: null },
  modules: DEFAULT_MODULES.map((module) => ({ ...module })),
  banners: [],
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HEX_PATTERN = /^#[0-9a-f]{6}$/i
const COLOR_KEYS = Object.keys(OFFICIAL_COLORS) as BrandColorKey[]
const BANNER_PLACEMENTS = ['home-hero', 'login-banner', 'announcement-strip'] as const

export function parsePublicBranding(input: unknown): PublicBranding {
  if (!isRecord(input) || !Number.isSafeInteger(input.revision) || Number(input.revision) < 1) {
    throw new Error('The branding response is malformed.')
  }

  const institutionName = typeof input.institutionName === 'string'
    && input.institutionName.trim().length > 0
    && input.institutionName.trim().length <= 240
    ? input.institutionName.trim()
    : DEFAULT_BRANDING.institutionName

  const suppliedColors = isRecord(input.colors) ? input.colors : {}
  const colors = Object.fromEntries(COLOR_KEYS.map((key) => {
    const value = suppliedColors[key]
    return [key, typeof value === 'string' && HEX_PATTERN.test(value) ? value.toUpperCase() : OFFICIAL_COLORS[key]]
  })) as Record<BrandColorKey, string>

  const assetsInput = isRecord(input.assets) ? input.assets : {}
  const assets: BrandAssets = {
    logoLight: safeAssetId(assetsInput.logoLight),
    logoDark: safeAssetId(assetsInput.logoDark),
    favicon: safeAssetId(assetsInput.favicon),
  }

  const modules = parseModules(input.modules)
  const banners = parseBanners(input.banners)

  return {
    revision: Number(input.revision),
    institutionName,
    colors,
    assets,
    modules,
    banners,
  }
}

function parseModules(input: unknown): BrandModule[] {
  if (!Array.isArray(input)) return DEFAULT_MODULES.map((module) => ({ ...module }))
  const supplied = new Map<string, unknown>()
  input.forEach((item) => {
    if (isRecord(item) && typeof item.key === 'string' && !supplied.has(item.key)) supplied.set(item.key, item)
  })

  return DEFAULT_MODULES.map((defaultModule) => {
    const item = supplied.get(defaultModule.key)
    if (!isRecord(item)) return { ...defaultModule }
    const label = typeof item.label === 'string' ? item.label.trim() : ''
    const order = item.order
    const available = item.available === true && defaultModule.available
    if (!label || label.length > 100 || !Number.isInteger(order) || Number(order) < 0) return { ...defaultModule }
    return {
      key: defaultModule.key,
      label,
      available,
      visible: available && item.visible === true,
      order: Number(order),
    }
  }).sort((left, right) => left.order - right.order || left.key.localeCompare(right.key))
}

function parseBanners(input: unknown): BrandBanner[] {
  if (!Array.isArray(input)) return []
  return input.flatMap((item) => {
    if (!isRecord(item)
      || !isUuid(item.id)
      || !isUuid(item.assetId)
      || typeof item.title !== 'string'
      || !item.title.trim()
      || item.title.trim().length > 160
      || typeof item.altText !== 'string'
      || !item.altText.trim()
      || item.altText.trim().length > 300
      || !BANNER_PLACEMENTS.includes(item.placement as (typeof BANNER_PLACEMENTS)[number])
      || !Number.isInteger(item.order)
      || Number(item.order) < 0
      || !isValidInstantOrNull(item.startsAt)
      || !isValidInstantOrNull(item.endsAt)) return []

    const startsAt = item.startsAt as string | null
    const endsAt = item.endsAt as string | null
    if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) return []
    return [{
      id: item.id as string,
      assetId: item.assetId as string,
      title: item.title.trim(),
      altText: item.altText.trim(),
      placement: item.placement as BrandBanner['placement'],
      order: Number(item.order),
      startsAt,
      endsAt,
    }]
  }).sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
}

function safeAssetId(value: unknown): string | null {
  return isUuid(value) ? value : null
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function isValidInstantOrNull(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && Number.isFinite(Date.parse(value)))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
