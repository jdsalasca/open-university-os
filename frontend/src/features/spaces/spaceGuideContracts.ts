export const SPACE_LOCATION_KINDS = ['CAMPUS', 'REGIONAL_SITE', 'CREAD', 'SERVICE'] as const
export const SPACE_USE_KINDS = [
  'AUDITORIUM_OR_ACADEMIC_SPACE',
  'SPORTS_VENUE',
  'LIBRARY_ROOM',
  'COMPUTER_CLASSROOM',
  'INTERNAL_STAFF_SPACE',
] as const

export type SpaceLocationKind = (typeof SPACE_LOCATION_KINDS)[number]
export type SpaceUseKind = (typeof SPACE_USE_KINDS)[number]

export interface SpaceSource {
  label: string
  url: string
  checkedAt: string
  sourceUpdatedAt: string | null
}

export interface SpaceCapacityAnnouncement {
  areaName: string
  announcedCapacityPersons: number
}

export interface SpaceAnnouncement {
  capacities: SpaceCapacityAnnouncement[]
  locationNote: string
  locationReferences: SpaceSource[]
}

export interface SpaceLocation {
  id: string
  kind: SpaceLocationKind
  name: string
  municipality: string
  department: string | null
  address: string | null
  locationDetail: string | null
  mapQuery: string | null
  source: SpaceSource
  announcement: SpaceAnnouncement | null
}

export interface SpaceUsePathway {
  id: string
  kind: SpaceUseKind
  title: string
  audience: string
  summary: string
  availabilityNote: string
  sources: SpaceSource[]
}

export interface SpaceDirectorySnapshot {
  locations: SpaceLocation[]
  requestPathways: SpaceUsePathway[]
  officialOfficeDirectoryUrl: string
}

const KIND_SET = new Set<string>(SPACE_LOCATION_KINDS)
const USE_KIND_SET = new Set<string>(SPACE_USE_KINDS)
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function parseSpaceDirectorySnapshot(input: unknown): SpaceDirectorySnapshot {
  if (!isRecord(input) || !Array.isArray(input.locations)
    || !Array.isArray(input.requestPathways) || input.requestPathways.length === 0
    || !isOfficialUptcUrl(input.officialOfficeDirectoryUrl)) {
    throw new Error('La respuesta de la guía de espacios no tiene un formato válido.')
  }

  const ids = new Set<string>()
  const locations = input.locations.map((item) => {
    const location = parseSpaceLocation(item)
    if (ids.has(location.id)) throw new Error('La respuesta de la guía de espacios repite un identificador.')
    ids.add(location.id)
    return location
  })
  const pathwayIds = new Set<string>()
  const requestPathways = input.requestPathways.map((item) => {
    const pathway = parseSpaceUsePathway(item)
    if (pathwayIds.has(pathway.id)) {
      throw new Error('La respuesta de la guía de espacios repite un identificador de solicitud.')
    }
    pathwayIds.add(pathway.id)
    return pathway
  })

  return {
    locations,
    requestPathways,
    officialOfficeDirectoryUrl: input.officialOfficeDirectoryUrl,
  }
}

function parseSpaceLocation(input: unknown): SpaceLocation {
  if (!isRecord(input)
    || typeof input.id !== 'string' || !input.id.trim()
    || typeof input.kind !== 'string' || !KIND_SET.has(input.kind)
    || typeof input.name !== 'string' || !input.name.trim()
    || typeof input.municipality !== 'string' || !input.municipality.trim()
    || !isNullableString(input.department)
    || !isNullableString(input.address)
    || !isNullableString(input.locationDetail)
    || !isNullableString(input.mapQuery)
    || (input.address !== null && !input.address.trim())
    || (input.mapQuery !== null && !input.mapQuery.trim())
    || ((input.address === null) !== (input.mapQuery === null))
    || (input.address === null && (!input.locationDetail || !input.locationDetail.trim()))) {
    throw new Error('Un espacio de la respuesta no cumple el contrato público.')
  }

  const announcement = input.announcement === undefined || input.announcement === null
    ? null
    : parseSpaceAnnouncement(input.announcement)
  if (announcement && (input.kind !== 'SERVICE' || input.address !== null || input.mapQuery !== null)) {
    throw new Error('El anuncio de un espacio no cumple el contrato público.')
  }

  return {
    id: input.id,
    kind: input.kind as SpaceLocationKind,
    name: input.name,
    municipality: input.municipality,
    department: input.department,
    address: input.address,
    locationDetail: input.locationDetail,
    mapQuery: input.mapQuery,
    source: parseSpaceSource(input.source, 'La fuente de un espacio no cumple el contrato público.'),
    announcement,
  }
}

function parseSpaceAnnouncement(input: unknown): SpaceAnnouncement {
  if (!isRecord(input)
    || !Array.isArray(input.capacities) || input.capacities.length === 0
    || typeof input.locationNote !== 'string' || !input.locationNote.trim()
    || !Array.isArray(input.locationReferences) || input.locationReferences.length === 0) {
    throw new Error('El anuncio de un espacio no cumple el contrato público.')
  }

  const areaNames = new Set<string>()
  const capacities = input.capacities.map((item) => {
    if (!isRecord(item)
      || typeof item.areaName !== 'string' || !item.areaName.trim()
      || typeof item.announcedCapacityPersons !== 'number'
      || !Number.isSafeInteger(item.announcedCapacityPersons)
      || item.announcedCapacityPersons <= 0) {
      throw new Error('Un área anunciada no cumple el contrato público.')
    }
    const normalizedAreaName = item.areaName.trim().normalize('NFD')
      .replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es-CO')
    if (areaNames.has(normalizedAreaName)) {
      throw new Error('El anuncio de un espacio repite un área.')
    }
    areaNames.add(normalizedAreaName)
    return { areaName: item.areaName, announcedCapacityPersons: item.announcedCapacityPersons }
  })

  const locationReferences = input.locationReferences.map((item) => parseSpaceSource(
    item,
    'Una referencia de ubicación no cumple el contrato público.',
  ))
  const referenceUrls = new Set<string>()
  for (const reference of locationReferences) {
    if (referenceUrls.has(reference.url)) {
      throw new Error('El anuncio de un espacio repite una referencia de ubicación.')
    }
    referenceUrls.add(reference.url)
  }

  return { capacities, locationNote: input.locationNote, locationReferences }
}

function parseSpaceUsePathway(input: unknown): SpaceUsePathway {
  if (!isRecord(input)
    || typeof input.id !== 'string' || !input.id.trim()
    || typeof input.kind !== 'string' || !USE_KIND_SET.has(input.kind)
    || typeof input.title !== 'string' || !input.title.trim()
    || typeof input.audience !== 'string' || !input.audience.trim()
    || typeof input.summary !== 'string' || !input.summary.trim()
    || typeof input.availabilityNote !== 'string' || !input.availabilityNote.trim()
    || !Array.isArray(input.sources) || input.sources.length === 0) {
    throw new Error('Un recorrido de solicitud de espacio no cumple el contrato público.')
  }

  const sources = input.sources.map((source) => parseSpaceSource(
    source,
    'La fuente de una solicitud de espacio no cumple el contrato público.',
  ))
  const sourceUrls = new Set<string>()
  for (const source of sources) {
    if (sourceUrls.has(source.url)) {
      throw new Error('Un recorrido de solicitud de espacio repite una fuente.')
    }
    sourceUrls.add(source.url)
  }

  return {
    id: input.id,
    kind: input.kind as SpaceUseKind,
    title: input.title,
    audience: input.audience,
    summary: input.summary,
    availabilityNote: input.availabilityNote,
    sources,
  }
}

function parseSpaceSource(input: unknown, errorMessage: string): SpaceSource {
  if (!isRecord(input)
    || typeof input.label !== 'string' || !input.label.trim()
    || !isOfficialUptcUrl(input.url)
    || !isIsoDate(input.checkedAt)
    || !(input.sourceUpdatedAt === null || isIsoDate(input.sourceUpdatedAt))
    || (input.sourceUpdatedAt !== null && input.sourceUpdatedAt > input.checkedAt)) {
    throw new Error(errorMessage)
  }

  return {
    label: input.label,
    url: input.url,
    checkedAt: input.checkedAt,
    sourceUpdatedAt: input.sourceUpdatedAt,
  }
}

function isOfficialUptcUrl(input: unknown): input is string {
  if (typeof input !== 'string') return false
  try {
    const url = new URL(input)
    return url.protocol === 'https:'
      && !url.username
      && !url.password
      && (url.hostname === 'uptc.edu.co' || url.hostname.endsWith('.uptc.edu.co'))
  } catch {
    return false
  }
}

function isIsoDate(input: unknown): input is string {
  if (typeof input !== 'string' || !ISO_DATE_PATTERN.test(input)) return false
  const [year, month, day] = input.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function isNullableString(input: unknown): input is string | null {
  return input === null || typeof input === 'string'
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
}
