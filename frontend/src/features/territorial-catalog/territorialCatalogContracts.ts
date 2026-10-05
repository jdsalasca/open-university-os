export const TERRITORIAL_ENTITY_TYPES = [
  'MUNICIPIO',
  'ISLA',
  'AREA_NO_MUNICIPALIZADA',
] as const

export type TerritorialEntityType = (typeof TERRITORIAL_ENTITY_TYPES)[number]

export interface TerritorialCatalogSource {
  publisher: string
  datasetName: string
  datasetVersion: string
  snapshotRetrievedAt: string
  serviceUrl: string
  documentationUrl: string
}

export interface TerritorialDepartment {
  code: string
  name: string
}

export interface TerritorialEntity {
  code: string
  departmentCode: string
  localCode: string
  name: string
  type: TerritorialEntityType
  dataYear: number
}

export interface TerritorialDepartmentList {
  source: TerritorialCatalogSource
  departments: TerritorialDepartment[]
}

export interface TerritorialEntityList {
  source: TerritorialCatalogSource
  department: TerritorialDepartment
  entities: TerritorialEntity[]
}

const ENTITY_TYPE_SET = new Set<string>(TERRITORIAL_ENTITY_TYPES)
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function parseTerritorialDepartmentList(input: unknown): TerritorialDepartmentList {
  if (!isRecord(input) || !Array.isArray(input.departments) || input.departments.length === 0) {
    throw malformedResponse()
  }
  const source = parseSource(input.source)
  const departments = input.departments.map(parseDepartment)
  if (new Set(departments.map((department) => department.code)).size !== departments.length) {
    throw malformedResponse()
  }
  return { source, departments }
}

export function parseTerritorialEntityList(input: unknown, expectedDepartmentCode: string): TerritorialEntityList {
  if (!isRecord(input) || !Array.isArray(input.entities)) throw malformedResponse()
  const source = parseSource(input.source)
  const department = parseDepartment(input.department)
  if (department.code !== expectedDepartmentCode) throw malformedResponse()

  const entities = input.entities.map(parseEntity)
  if (entities.some((entity) => entity.departmentCode !== expectedDepartmentCode)
    || new Set(entities.map((entity) => entity.code)).size !== entities.length) {
    throw malformedResponse()
  }
  return { source, department, entities }
}

function parseSource(input: unknown): TerritorialCatalogSource {
  if (!isRecord(input)
    || input.publisher !== 'DANE'
    || !isNonEmptyText(input.datasetName)
    || !isNonEmptyText(input.datasetVersion)
    || !isDate(input.snapshotRetrievedAt)
    || !isDaneUrl(input.serviceUrl)
    || !isDaneUrl(input.documentationUrl)) {
    throw malformedResponse()
  }
  return {
    publisher: input.publisher,
    datasetName: input.datasetName,
    datasetVersion: input.datasetVersion,
    snapshotRetrievedAt: input.snapshotRetrievedAt,
    serviceUrl: input.serviceUrl,
    documentationUrl: input.documentationUrl,
  }
}

function parseDepartment(input: unknown): TerritorialDepartment {
  if (!isRecord(input)
    || typeof input.code !== 'string' || !/^\d{2}$/.test(input.code)
    || !isNonEmptyText(input.name)) {
    throw malformedResponse()
  }
  return { code: input.code, name: input.name }
}

function parseEntity(input: unknown): TerritorialEntity {
  if (!isRecord(input)
    || typeof input.code !== 'string' || !/^\d{5}$/.test(input.code)
    || typeof input.departmentCode !== 'string' || !/^\d{2}$/.test(input.departmentCode)
    || typeof input.localCode !== 'string' || !/^\d{3}$/.test(input.localCode)
    || input.code !== `${input.departmentCode}${input.localCode}`
    || !isNonEmptyText(input.name)
    || typeof input.type !== 'string' || !ENTITY_TYPE_SET.has(input.type)
    || typeof input.dataYear !== 'number' || !Number.isInteger(input.dataYear)
    || input.dataYear < 1900 || input.dataYear > 2100) {
    throw malformedResponse()
  }
  return {
    code: input.code,
    departmentCode: input.departmentCode,
    localCode: input.localCode,
    name: input.name,
    type: input.type as TerritorialEntityType,
    dataYear: input.dataYear,
  }
}

function isDate(input: unknown): input is string {
  if (typeof input !== 'string' || !DATE_PATTERN.test(input)) return false
  const [year, month, day] = input.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function isDaneUrl(input: unknown): input is string {
  if (typeof input !== 'string') return false
  try {
    const url = new URL(input)
    return url.protocol === 'https:'
      && !url.username
      && !url.password
      && (url.hostname === 'dane.gov.co' || url.hostname.endsWith('.dane.gov.co'))
  } catch {
    return false
  }
}

function isNonEmptyText(input: unknown): input is string {
  return typeof input === 'string' && input.trim().length > 0
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
}

function malformedResponse(): Error {
  return new Error('La respuesta del catálogo territorial no tiene un formato válido.')
}
