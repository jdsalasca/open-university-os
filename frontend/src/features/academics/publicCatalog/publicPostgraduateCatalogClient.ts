import snapshotUrl from './uptcPostgraduateCatalog.snapshot.json?url'
import type { PublicPostgraduateCatalogSnapshot, PublicPostgraduateProgram } from './publicPostgraduateCatalog'
import {
  isIsoCalendarDate,
  isNonEmptyString,
  isOfficialUptcUrl,
  isRecord,
} from './publicCatalogShared'

export const PUBLIC_POSTGRADUATE_CATALOG_PAGE_URL = 'https://www.uptc.edu.co/sitio/portal/sitios/programas_ofer/posgrados.html'

export async function fetchPublicPostgraduateCatalog(
  signal?: AbortSignal,
): Promise<PublicPostgraduateCatalogSnapshot> {
  const response = await fetch(snapshotUrl, {
    headers: { Accept: 'application/json' },
    cache: 'force-cache',
    signal,
  })

  if (!response.ok) {
    throw new Error(`No se pudo cargar la instantánea pública UPTC (HTTP ${response.status}).`)
  }

  return parsePublicPostgraduateCatalog(await response.json())
}

export function parsePublicPostgraduateCatalog(value: unknown): PublicPostgraduateCatalogSnapshot {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.source)) {
    throw new Error('La instantánea pública UPTC tiene una estructura no reconocida.')
  }

  if (
    value.source.pageUrl !== PUBLIC_POSTGRADUATE_CATALOG_PAGE_URL
    || !isOfficialUptcUrl(value.source.pageUrl)
    || !isIsoCalendarDate(value.source.pageUpdatedAt)
    || !isIsoCalendarDate(value.source.capturedAt)
    || !Array.isArray(value.programs)
    || value.programs.length === 0
  ) {
    throw new Error('La instantánea pública UPTC tiene una fuente, fecha o lista inválida.')
  }

  const codes = new Set<string>()
  for (const candidate of value.programs) {
    if (!isPublicProgram(candidate)) {
      throw new Error('La instantánea pública UPTC tiene un registro de programa inválido.')
    }
    if (codes.has(candidate.programCode)) {
      throw new Error('La instantánea pública UPTC tiene un código de programa duplicado.')
    }
    if (!isOfficialUptcUrl(candidate.detailUrl)) {
      throw new Error('La instantánea pública UPTC contiene un enlace oficial inválido.')
    }
    codes.add(candidate.programCode)
  }

  return value as unknown as PublicPostgraduateCatalogSnapshot
}

function isPublicProgram(value: unknown): value is PublicPostgraduateProgram {
  return isRecord(value)
    && isNonEmptyString(value.programCode)
    && isNonEmptyString(value.name)
    && isNonEmptyString(value.facultyOrUnit)
    && isNonEmptyString(value.facultyCode)
    && isNonEmptyString(value.level)
    && isNonEmptyString(value.modality)
    && isNonEmptyString(value.placeLabel)
    && (value.locationsSummary === null || typeof value.locationsSummary === 'string')
    && isNonEmptyString(value.detailUrl)
}
