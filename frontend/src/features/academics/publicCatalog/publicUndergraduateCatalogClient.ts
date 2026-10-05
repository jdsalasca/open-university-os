import snapshotUrl from './uptcUndergraduateCatalog.snapshot.json?url'
import type { PublicUndergraduateCatalogSnapshot, PublicUndergraduateProgram } from './publicUndergraduateCatalog'
import { isIsoCalendarDate, isNonEmptyString, isOfficialUptcUrl, isRecord } from './publicCatalogShared'

export async function fetchPublicUndergraduateCatalog(
  signal?: AbortSignal,
): Promise<PublicUndergraduateCatalogSnapshot> {
  const response = await fetch(snapshotUrl, {
    headers: { Accept: 'application/json' },
    cache: 'force-cache',
    signal,
  })

  if (!response.ok) {
    throw new Error(`No se pudo cargar la instantánea pública UPTC (HTTP ${response.status}).`)
  }

  return parsePublicUndergraduateCatalog(await response.json())
}

export function parsePublicUndergraduateCatalog(value: unknown): PublicUndergraduateCatalogSnapshot {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.source)) {
    throw new Error('La instantánea pública UPTC tiene una estructura no reconocida.')
  }

  if (
    !isOfficialUptcUrl(value.source.pageUrl)
    || !isIsoCalendarDate(value.source.pageUpdatedAt)
    || !isIsoCalendarDate(value.source.capturedAt)
    || !Array.isArray(value.programs)
    || value.programs.length === 0
  ) {
    throw new Error('La instantánea pública UPTC tiene una fuente, fecha o lista inválida.')
  }

  const ids = new Set<string>()
  for (const candidate of value.programs) {
    if (!isPublicProgram(candidate)) {
      throw new Error('La instantánea pública UPTC tiene un registro de programa inválido.')
    }
    if (ids.has(candidate.id)) {
      throw new Error('La instantánea pública UPTC tiene un identificador de programa duplicado.')
    }
    if (!isOfficialUptcUrl(candidate.detailUrl)) {
      throw new Error('La instantánea pública UPTC contiene un enlace oficial inválido.')
    }
    ids.add(candidate.id)
  }

  return value as unknown as PublicUndergraduateCatalogSnapshot
}

function isPublicProgram(value: unknown): value is PublicUndergraduateProgram {
  return isRecord(value)
    && isNonEmptyString(value.id)
    && isNonEmptyString(value.name)
    && isNonEmptyString(value.faculty)
    && isNonEmptyString(value.facultyCode)
    && isNonEmptyString(value.level)
    && isNonEmptyString(value.modality)
    && isNonEmptyString(value.placeLabel)
    && (value.locationsSummary === null || typeof value.locationsSummary === 'string')
    && typeof value.markedOffered === 'boolean'
    && isNonEmptyString(value.detailUrl)
}
