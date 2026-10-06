import { useEffect, useId, useState } from 'react'
import { normalizeSearchText } from '../../shared/text/normalizeSearchText'
import type {
  TerritorialCatalogSource,
  TerritorialDepartment,
  TerritorialEntity,
  TerritorialEntityType,
} from './territorialCatalogContracts'
import { territorialCatalogClient } from './territorialCatalogClient'
import type { TerritorialCatalogClient } from './territorialCatalogClient'
import './TerritorialCatalogSelector.scss'

interface TerritorialCatalogSelectorProps {
  client?: TerritorialCatalogClient
}

type DepartmentLoadState =
  | { status: 'error'; attempt: number; client: TerritorialCatalogClient }
  | { status: 'ready'; attempt: number; client: TerritorialCatalogClient; departments: TerritorialDepartment[]; source: TerritorialCatalogSource }

type EntityLoadState =
  | { status: 'idle' }
  | { status: 'error'; departmentCode: string; attempt: number; client: TerritorialCatalogClient }
  | { status: 'ready'; departmentCode: string; attempt: number; client: TerritorialCatalogClient; entities: TerritorialEntity[] }

const TYPE_LABELS: Record<TerritorialEntityType, string> = {
  MUNICIPIO: 'Municipio',
  ISLA: 'Isla',
  AREA_NO_MUNICIPALIZADA: 'Área no municipalizada',
}

export function TerritorialCatalogSelector({ client = territorialCatalogClient }: TerritorialCatalogSelectorProps) {
  const idPrefix = useId()
  const departmentFieldId = `territorial-department-${idPrefix}`
  const entityFieldId = `territorial-entity-${idPrefix}`
  const searchFieldId = `territorial-entity-search-${idPrefix}`
  const [departmentAttempt, setDepartmentAttempt] = useState(0)
  const [departmentState, setDepartmentState] = useState<DepartmentLoadState | null>(null)
  const [selectedDepartmentCode, setSelectedDepartmentCode] = useState('')
  const [selectedEntityCode, setSelectedEntityCode] = useState('')
  const [entitySearch, setEntitySearch] = useState('')
  const [entityAttempt, setEntityAttempt] = useState(0)
  const [entityState, setEntityState] = useState<EntityLoadState>({ status: 'idle' })

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    client.listDepartments(controller.signal).then((result) => {
      if (active) setDepartmentState({
        status: 'ready', attempt: departmentAttempt, client,
        departments: result.departments, source: result.source,
      })
    }).catch(() => {
      if (active && !controller.signal.aborted) {
        setDepartmentState({ status: 'error', attempt: departmentAttempt, client })
      }
    })
    return () => {
      active = false
      controller.abort()
    }
  }, [client, departmentAttempt])

  useEffect(() => {
    if (!selectedDepartmentCode) {
      return
    }

    const controller = new AbortController()
    let active = true
    client.listEntities(selectedDepartmentCode, controller.signal).then((result) => {
      if (active && result.department.code === selectedDepartmentCode) {
        setEntityState({
          status: 'ready', departmentCode: selectedDepartmentCode,
          attempt: entityAttempt, client, entities: result.entities,
        })
      }
    }).catch(() => {
      if (active && !controller.signal.aborted) {
        setEntityState({ status: 'error', departmentCode: selectedDepartmentCode, attempt: entityAttempt, client })
      }
    })
    return () => {
      active = false
      controller.abort()
    }
  }, [client, entityAttempt, selectedDepartmentCode])

  const currentDepartmentState = departmentState?.attempt === departmentAttempt && departmentState.client === client
    ? departmentState
    : { status: 'loading' as const }
  const entityResponseIsCurrent = entityState.status !== 'idle'
    && entityState.departmentCode === selectedDepartmentCode
    && entityState.attempt === entityAttempt
    && entityState.client === client
  const currentEntityStatus = !selectedDepartmentCode
    ? 'idle'
    : entityResponseIsCurrent ? entityState.status : 'loading'
  const visibleEntities = currentEntityStatus === 'ready' && entityState.status === 'ready'
    ? (() => {
    const query = normalizeSearchText(entitySearch.trim())
    if (!query) return entityState.entities
    return entityState.entities.filter((entity) =>
      normalizeSearchText(`${entity.name} ${entity.code}`).includes(query))
  })()
    : []
  const selectedEntity = currentEntityStatus === 'ready' && entityState.status === 'ready'
    ? entityState.entities.find((entity) => entity.code === selectedEntityCode)
    : undefined

  function changeDepartment(departmentCode: string) {
    setSelectedDepartmentCode(departmentCode)
    setSelectedEntityCode('')
    setEntitySearch('')
    setEntityAttempt(0)
  }

  return (
    <section className="territorial-catalog-selector" aria-label="Selector territorial de referencia">
      <div className="territorial-selector-fields">
        <label className="territorial-selector-field" htmlFor={departmentFieldId}>
          <span>Departamento de referencia</span>
          <select
            id={departmentFieldId}
            value={selectedDepartmentCode}
            onChange={(event) => changeDepartment(event.target.value)}
            disabled={currentDepartmentState.status !== 'ready'}
          >
            <option value="">Selecciona un departamento</option>
            {currentDepartmentState.status === 'ready' && currentDepartmentState.departments.map((department) => (
              <option key={department.code} value={department.code}>{department.name} · {department.code}</option>
            ))}
          </select>
        </label>

        <label className="territorial-selector-field" htmlFor={entityFieldId}>
          <span>Entidad territorial</span>
          <select
            id={entityFieldId}
            value={selectedEntityCode}
            onChange={(event) => setSelectedEntityCode(event.target.value)}
            disabled={!selectedDepartmentCode || currentEntityStatus !== 'ready'}
          >
            <option value="">Selecciona una entidad territorial</option>
            {visibleEntities.map((entity) => (
              <option key={entity.code} value={entity.code}>
                {TYPE_LABELS[entity.type]} · {entity.name} · {entity.code}
              </option>
            ))}
          </select>
        </label>
      </div>

      {currentDepartmentState.status === 'loading' && (
        <p className="territorial-selector-status" role="status">Cargando departamentos de referencia…</p>
      )}
      {currentDepartmentState.status === 'error' && (
        <div className="territorial-selector-error" role="alert">
          <span>No se pudo consultar el catálogo territorial.</span>
          <button type="button" onClick={() => setDepartmentAttempt((attempt) => attempt + 1)}>Reintentar</button>
        </div>
      )}
      {selectedDepartmentCode && currentEntityStatus === 'loading' && (
        <p className="territorial-selector-status" role="status">Cargando entidades territoriales…</p>
      )}
      {selectedDepartmentCode && currentEntityStatus === 'error' && (
        <div className="territorial-selector-error" role="alert">
          <span>No se pudieron cargar las entidades de este departamento.</span>
          <button type="button" onClick={() => setEntityAttempt((attempt) => attempt + 1)}>Reintentar</button>
        </div>
      )}
      {currentEntityStatus === 'ready' && entityState.status === 'ready' && entityState.entities.length > 0 && (
        <label className="territorial-selector-search" htmlFor={searchFieldId}>
          <span>Buscar entidad territorial</span>
          <input
            id={searchFieldId}
            type="search"
            value={entitySearch}
            onChange={(event) => setEntitySearch(event.target.value)}
            placeholder="Nombre o código DIVIPOLA"
          />
        </label>
      )}
      {currentEntityStatus === 'ready' && entityState.status === 'ready' && entityState.entities.length === 0 && (
        <p className="territorial-selector-empty">Este departamento no tiene entidades en la instantánea consultada.</p>
      )}
      {currentEntityStatus === 'ready' && entityState.status === 'ready' && entityState.entities.length > 0 && visibleEntities.length === 0 && (
        <div className="territorial-selector-empty" role="status">
          <span>No hay entidades que coincidan con esa búsqueda.</span>
          <button type="button" onClick={() => setEntitySearch('')}>Limpiar búsqueda</button>
        </div>
      )}
      {selectedEntity && (
        <p className="territorial-selector-selection" role="status">
          <span>Código DIVIPOLA</span>
          <strong>{selectedEntity.code}</strong>
          <span>{TYPE_LABELS[selectedEntity.type]} · referencia de {selectedEntity.dataYear}</span>
        </p>
      )}
      {currentDepartmentState.status === 'ready' && (
        <p className="territorial-selector-source">
          Referencia: {currentDepartmentState.source.publisher} · {currentDepartmentState.source.datasetVersion} · instantánea {currentDepartmentState.source.snapshotRetrievedAt}.
          {' '}<a href={currentDepartmentState.source.documentationUrl} target="_blank" rel="noreferrer">Consultar metodología DIVIPOLA</a>
        </p>
      )}
    </section>
  )
}
