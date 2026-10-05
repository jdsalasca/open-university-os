import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type {
  AcademicOperationsClient,
  AcademicStructureAuditAction,
  AcademicStructureAuditEvent,
  AcademicStructureAuditQuery,
} from './academicOperationsContracts'
import { AcademicOperationsApiError } from './academicOperationsClient'
import './AcademicStructureAuditPanel.scss'

type LoadState = 'loading' | 'ready' | 'error'

interface AcademicStructureAuditPanelProps {
  canRead: boolean
  accessToken: string
  client: Pick<AcademicOperationsClient, 'getStructureAuditEvents'>
  onAuthorizationRejected?: (accessToken: string) => Promise<void>
}

const ACTION_LABELS: Record<AcademicStructureAuditAction, string> = {
  UNIT_CREATED: 'Unidad creada',
  UNIT_RELATED: 'Relación entre unidades creada',
  SITE_CREATED: 'Sede creada',
  SITE_RELATED: 'Relación entre sedes creada',
  PROGRAM_AFFILIATED: 'Programa adscrito',
  UNIT_ORDER_CHANGED: 'Orden de unidad actualizado',
  SITE_ORDER_CHANGED: 'Orden de sede actualizado',
  UNIT_RELATION_ORDER_CHANGED: 'Orden de relación entre unidades actualizado',
  SITE_RELATION_ORDER_CHANGED: 'Orden de relación entre sedes actualizado',
  PROGRAM_ORDER_CHANGED: 'Orden de programa actualizado',
  UNIT_RELATION_CLOSED: 'Relación entre unidades cerrada',
  SITE_RELATION_CLOSED: 'Relación entre sedes cerrada',
  PROGRAM_AFFILIATION_CLOSED: 'Adscripción de programa cerrada',
  PROGRAM_AFFILIATION_REASSIGNED: 'Programa reasignado',
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function AcademicStructureAuditPanel({
  canRead,
  accessToken,
  client,
  onAuthorizationRejected,
}: AcademicStructureAuditPanelProps) {
  if (!canRead || !accessToken) return null
  return <AcademicStructureAuditPanelContent
    key={accessToken}
    accessToken={accessToken}
    client={client}
    onAuthorizationRejected={onAuthorizationRejected}
  />
}

function AcademicStructureAuditPanelContent({
  accessToken,
  client,
  onAuthorizationRejected,
}: Omit<AcademicStructureAuditPanelProps, 'canRead'>) {
  const [events, setEvents] = useState<AcademicStructureAuditEvent[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filterError, setFilterError] = useState<string | null>(null)
  const [entityIdInput, setEntityIdInput] = useState('')
  const [actionInput, setActionInput] = useState<AcademicStructureAuditAction | ''>('')
  const [filters, setFilters] = useState<Omit<AcademicStructureAuditQuery, 'limit' | 'before'>>({})
  const requestControllerRef = useRef<AbortController | null>(null)

  const loadPage = useCallback(async (
    pageFilters: Omit<AcademicStructureAuditQuery, 'limit' | 'before'>,
    before: string | undefined,
    append: boolean,
  ) => {
    requestControllerRef.current?.abort()
    const controller = new AbortController()
    requestControllerRef.current = controller
    setLoadError(null)
    if (append) setLoadingMore(true)
    else {
      setEvents([])
      setNextCursor(null)
      setLoadState('loading')
    }

    try {
      const query: AcademicStructureAuditQuery = {
        limit: 50,
        ...pageFilters,
        ...(before ? { before } : {}),
      }
      const page = await client.getStructureAuditEvents(query, accessToken, controller.signal)
      if (controller.signal.aborted) return
      setEvents((current) => append ? [...current, ...page.events] : page.events)
      setNextCursor(page.nextCursor)
      setLoadState('ready')
    } catch (error) {
      if (controller.signal.aborted) return
      setLoadError('No fue posible consultar la bitácora. Verifica tu sesión y vuelve a intentarlo.')
      if (!append) setLoadState('error')
      if (error instanceof AcademicOperationsApiError && (error.status === 401 || error.status === 403)) {
        try {
          await onAuthorizationRejected?.(accessToken)
        } catch {
          setLoadError('El servidor rechazó la sesión y no fue posible revalidarla. Inicia sesión de nuevo.')
        }
      }
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null
        setLoadingMore(false)
      }
    }
  }, [accessToken, client, onAuthorizationRejected])

  useEffect(() => {
    const controller = new AbortController()
    requestControllerRef.current = controller
    async function loadInitialPage() {
      try {
        const page = await client.getStructureAuditEvents({ limit: 50 }, accessToken, controller.signal)
        if (controller.signal.aborted) return
        setEvents(page.events)
        setNextCursor(page.nextCursor)
        setLoadState('ready')
      } catch (error) {
        if (controller.signal.aborted) return
        setLoadError('No fue posible consultar la bitácora. Verifica tu sesión y vuelve a intentarlo.')
        setLoadState('error')
        if (error instanceof AcademicOperationsApiError && (error.status === 401 || error.status === 403)) {
          try {
            await onAuthorizationRejected?.(accessToken)
          } catch {
            setLoadError('El servidor rechazó la sesión y no fue posible revalidarla. Inicia sesión de nuevo.')
          }
        }
      } finally {
        if (requestControllerRef.current === controller) requestControllerRef.current = null
      }
    }
    void loadInitialPage()
    return () => {
      requestControllerRef.current?.abort()
      requestControllerRef.current = null
    }
  }, [accessToken, client, onAuthorizationRejected])

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const entityId = entityIdInput.trim()
    if (entityId && !UUID_PATTERN.test(entityId)) {
      setFilterError('Escribe un UUID válido para filtrar por entidad.')
      return
    }
    const applied = {
      ...(entityId ? { entityId: entityId.toLowerCase() } : {}),
      ...(actionInput ? { actionKey: actionInput } : {}),
    }
    setFilters(applied)
    setFilterError(null)
    void loadPage(applied, undefined, false)
  }

  return (
    <section className="academic-structure-audit" aria-labelledby="academic-structure-audit-title">
      <header className="academic-structure-audit-heading">
        <div>
          <p className="academic-structure-audit-kicker">TRAZABILIDAD ADMINISTRATIVA</p>
          <h2 id="academic-structure-audit-title">Bitácora de estructura académica</h2>
          <p>Movimientos de unidades, sedes y programas. Solo lectura; esta bitácora no consulta expedientes estudiantiles.</p>
        </div>
        <span className="academic-structure-audit-badge">Solo lectura</span>
      </header>

      <form className="academic-structure-audit-filters" onSubmit={applyFilters}>
        <label>
          <span>ID de entidad</span>
          <input
            aria-label="ID de entidad"
            autoComplete="off"
            inputMode="text"
            maxLength={36}
            placeholder="UUID de unidad, sede o programa"
            value={entityIdInput}
            onChange={(event) => setEntityIdInput(event.currentTarget.value)}
          />
        </label>
        <label>
          <span>Acción</span>
          <select aria-label="Acción" value={actionInput} onChange={(event) => setActionInput(event.currentTarget.value as AcademicStructureAuditAction | '')}>
            <option value="">Todas las acciones</option>
            {Object.entries(ACTION_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <button type="submit" disabled={loadState === 'loading'}>Aplicar filtros</button>
        {filterError && <p className="academic-structure-audit-error" role="alert">{filterError}</p>}
      </form>

      {loadState === 'loading' && <p className="academic-structure-audit-status" role="status">Consultando movimientos auditados…</p>}
      {loadState === 'error' && <div className="academic-structure-audit-error" role="alert">
        <p>{loadError}</p>
        <button type="button" onClick={() => void loadPage(filters, undefined, false)}>Reintentar bitácora</button>
      </div>}
      {loadState === 'ready' && events.length === 0 && (
        <p className="academic-structure-audit-empty">No hay movimientos que coincidan con estos filtros.</p>
      )}
      {events.length > 0 && <>
        {loadError && <p className="academic-structure-audit-error" role="alert">{loadError}</p>}
        <ol className="academic-structure-audit-events">
          {events.map((event, index) => <li key={index}>
            <div className="academic-structure-audit-event-heading">
              <time dateTime={event.occurredAt}>{formatAuditInstant(event.occurredAt)}</time>
              <span>{ACTION_LABELS[event.actionKey]}</span>
            </div>
            <p>{event.summary}</p>
            <dl>
              <div><dt>Entidad</dt><dd>{event.entityId}</dd></div>
              <div><dt>Actor opaco</dt><dd>{event.actor}</dd></div>
              <div><dt>Referencia</dt><dd>{event.reference}</dd></div>
            </dl>
          </li>)}
        </ol>
        {nextCursor && <button
          className="academic-structure-audit-more"
          type="button"
          disabled={loadingMore}
          onClick={() => void loadPage(filters, nextCursor, true)}
        >{loadingMore ? 'Cargando…' : 'Cargar más'}</button>}
      </>}
    </section>
  )
}

function formatAuditInstant(value: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(new Date(value))
}
