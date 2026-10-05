import { normalizeCatalogText } from './publicCatalogShared'

export interface PublicPostgraduateProgram {
  programCode: string
  name: string
  facultyOrUnit: string
  facultyCode: string
  level: string
  modality: string
  placeLabel: string
  locationsSummary: string | null
  detailUrl: string
}

export interface PublicPostgraduateCatalogSnapshot {
  schemaVersion: 1
  source: {
    pageUrl: string
    pageUpdatedAt: string
    capturedAt: string
  }
  programs: PublicPostgraduateProgram[]
}

export interface PublicPostgraduateProgramFilters {
  query: string
  facultyOrUnit: string
  place: string
  modality: string
  level: string
}

export function filterPublicPostgraduatePrograms(
  programs: readonly PublicPostgraduateProgram[],
  filters: PublicPostgraduateProgramFilters,
): PublicPostgraduateProgram[] {
  const query = normalizeCatalogText(filters.query)
  const searchTerms = query.split(' ').filter(Boolean)

  return programs.filter((program) => {
    if (filters.facultyOrUnit && program.facultyOrUnit !== filters.facultyOrUnit) return false
    if (filters.place && program.placeLabel !== filters.place) return false
    if (filters.modality && program.modality !== filters.modality) return false
    if (filters.level && program.level !== filters.level) return false
    if (!query) return true

    const searchableText = normalizeCatalogText([
      program.name,
      program.programCode,
      program.facultyOrUnit,
      program.level,
      program.modality,
      program.placeLabel,
      program.locationsSummary ?? '',
    ].join(' '))
    return searchTerms.every((term) => searchableText.includes(term))
  }).sort((left, right) => left.facultyOrUnit.localeCompare(right.facultyOrUnit, 'es-CO')
    || left.name.localeCompare(right.name, 'es-CO'))
}
