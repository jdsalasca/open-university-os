import { normalizeSearchText } from '../../../shared/text/normalizeSearchText'

export const PUBLIC_UPTC_HOST = 'www.uptc.edu.co'

export function normalizeCatalogText(value: string): string {
  return normalizeSearchText(value)
}

export function uniqueProgramOptions<T>(
  programs: readonly T[],
  select: (program: T) => string,
): string[] {
  return [...new Set(programs.map(select).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, 'es-CO'))
}

export function formatPublicCatalogDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, 12))
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'UTC' }).format(date)
}

export function isOfficialUptcUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === PUBLIC_UPTC_HOST
  } catch {
    return false
  }
}

export function isIsoCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string') return false

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

  return month >= 1
    && month <= 12
    && day >= 1
    && day <= (daysInMonth[month - 1] ?? 0)
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
