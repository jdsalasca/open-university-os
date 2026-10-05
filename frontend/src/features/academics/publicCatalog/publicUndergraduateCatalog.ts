import { normalizeCatalogText } from './publicCatalogShared'

export interface PublicUndergraduateProgram {
  id: string
  name: string
  faculty: string
  facultyCode: string
  level: string
  modality: string
  placeLabel: string
  locationsSummary: string | null
  markedOffered: boolean
  detailUrl: string
}

export interface PublicUndergraduateCatalogSnapshot {
  schemaVersion: 1
  source: {
    pageUrl: string
    pageUpdatedAt: string
    capturedAt: string
  }
  programs: PublicUndergraduateProgram[]
}

export interface PublicUndergraduateProgramFilters {
  query: string
  faculty: string
  place: string
  modality: string
  level: string
  offered: 'all' | 'marked' | 'unmarked'
}

export function filterPublicUndergraduatePrograms(
  programs: readonly PublicUndergraduateProgram[],
  filters: PublicUndergraduateProgramFilters,
): PublicUndergraduateProgram[] {
  const query = normalizeCatalogText(filters.query)
  const searchTerms = query.split(' ').filter(Boolean)

  return programs.filter((program) => {
    if (filters.faculty && program.faculty !== filters.faculty) return false
    if (filters.place && program.placeLabel !== filters.place) return false
    if (filters.modality && program.modality !== filters.modality) return false
    if (filters.level && program.level !== filters.level) return false
    if (filters.offered === 'marked' && !program.markedOffered) return false
    if (filters.offered === 'unmarked' && program.markedOffered) return false
    if (!query) return true

    const searchableText = normalizeCatalogText([
      program.name,
      program.faculty,
      program.level,
      program.modality,
      program.placeLabel,
      program.locationsSummary ?? '',
      program.id,
    ].join(' '))
    return searchTerms.every((term) => searchableText.includes(term))
  }).sort((left, right) => left.faculty.localeCompare(right.faculty, 'es-CO')
    || left.name.localeCompare(right.name, 'es-CO'))
}
