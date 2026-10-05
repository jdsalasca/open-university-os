import type { TerritorialDepartmentList, TerritorialEntityList } from './territorialCatalogContracts'
import { parseTerritorialDepartmentList, parseTerritorialEntityList } from './territorialCatalogContracts'

export interface TerritorialCatalogClient {
  listDepartments(signal?: AbortSignal): Promise<TerritorialDepartmentList>
  listEntities(departmentCode: string, signal?: AbortSignal): Promise<TerritorialEntityList>
}

export class TerritorialCatalogApiError extends Error {
  readonly status: number

  constructor(status: number) {
    super('No fue posible cargar el catálogo territorial.')
    this.name = 'TerritorialCatalogApiError'
    this.status = status
  }
}

export function createTerritorialCatalogClient(fetcher: typeof fetch = fetch): TerritorialCatalogClient {
  return {
    async listDepartments(signal) {
      const response = await fetcher('/api/v1/territorial-catalog/departments', requestOptions(signal))
      return parseTerritorialDepartmentList(await responseBody(response))
    },

    async listEntities(departmentCode, signal) {
      if (!/^\d{2}$/.test(departmentCode)) {
        throw new TypeError('El código de departamento debe contener dos dígitos.')
      }
      const response = await fetcher(
        `/api/v1/territorial-catalog/departments/${encodeURIComponent(departmentCode)}/entities`,
        requestOptions(signal),
      )
      return parseTerritorialEntityList(await responseBody(response), departmentCode)
    },
  }
}

export const territorialCatalogClient = createTerritorialCatalogClient()

function requestOptions(signal?: AbortSignal): RequestInit {
  return {
    method: 'GET',
    cache: 'no-store',
    credentials: 'omit',
    headers: { Accept: 'application/json' },
    ...(signal ? { signal } : {}),
  }
}

async function responseBody(response: Response): Promise<unknown> {
  if (!response.ok) throw new TerritorialCatalogApiError(response.status)
  try {
    return await response.json() as unknown
  } catch {
    throw new Error('La respuesta del catálogo territorial no tiene un formato válido.')
  }
}
