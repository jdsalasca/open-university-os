import { useEffect, useRef, useState } from 'react'
import type {
  AcademicOperationsClient,
  AcademicOrganizationUnit,
  AcademicPeriod,
  AcademicPeriodAuditAction,
  AcademicPeriodHistory,
  AcademicSite,
} from './academicOperationsContracts'
import { AcademicOperationsApiError } from './academicOperationsClient'
import { AcademicCalendarRevisionForm, ApproveAcademicPeriodForm } from './AcademicPeriodForms'
import './AcademicPeriodHistoryPanel.scss'

type LoadState = 'loading' | 'ready' | 'error'

interface AcademicPeriodHistoryPanelProps {
  period: AcademicPeriod
  accessToken: string
  canWrite?: boolean
  client: Pick<AcademicOperationsClient, 'getPeriodHistory' | 'createCalendar' | 'publishCalendar' | 'approvePeriod'>
  units?: AcademicOrganizationUnit[]
  sites?: AcademicSite[]
  onPeriodUpdated?: (period: AcademicPeriod) => void
  onAuthorizationRejected?: (accessToken: string) => Promise<void>
}

export function AcademicPeriodHistoryPanel({
  period,
  accessToken,
  canWrite = false,
  client,
  units,
  sites,
  onPeriodUpdated,
  onAuthorizationRejected,
}: AcademicPeriodHistoryPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [history, setHistory] = useState<AcademicPeriodHistory | null>(null)
  const [state, setState] = useState<LoadState | null>(null)
  const [publicationConfirmationId, setPublicationConfirmationId] = useState<string | null>(null)
  const [pendingRevisionId, setPendingRevisionId] = useState<string | null>(null)
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const requestControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => requestControllerRef.current?.abort()
  }, [])

  async function loadHistory() {
    requestControllerRef.current?.abort()
    const controller = new AbortController()
    requestControllerRef.current = controller
    setHistory(null)
    setState('loading')
    try {
      const result = await client.getPeriodHistory(period.id, accessToken, controller.signal)
      if (controller.signal.aborted) return
      setHistory(result)
      setState('ready')
    } catch (error) {
      if (controller.signal.aborted) return
      setState('error')
      if (error instanceof AcademicOperationsApiError && (error.status === 401 || error.status === 403)) {
        try {
          await onAuthorizationRejected?.(accessToken)
        } catch {
          // The identity shell owns session recovery; the panel keeps history unavailable.
        }
      }
    } finally {
      if (requestControllerRef.current === controller) requestControllerRef.current = null
    }
  }

  async function publishRevision(revisionId: string, version: number) {
    if (!canWrite || pendingRevisionId) return
    requestControllerRef.current?.abort()
    const controller = new AbortController()
    requestControllerRef.current = controller
    setPendingRevisionId(revisionId)
    setActionFeedback(null)
    try {
      await client.publishCalendar(period.id, revisionId, accessToken, controller.signal)
      if (controller.signal.aborted) return
      setPublicationConfirmationId(null)
      setActionFeedback({ type: 'success', text: 'Se publicó la revisión ' + version + '. Las versiones anteriores permanecen en el historial.' })
      await loadHistory()
    } catch (error) {
      if (controller.signal.aborted) return
      setPublicationConfirmationId(null)
      setActionFeedback({
        type: 'error',
        text: error instanceof AcademicOperationsApiError && error.status === 409
          ? 'El periodo o el borrador cambió mientras trabajabas. Actualiza el historial antes de volver a intentarlo.'
          : 'No fue posible publicar la revisión. Verifica el permiso y el estado del calendario antes de volver a intentarlo.',
      })
      if (error instanceof AcademicOperationsApiError && (error.status === 401 || error.status === 403)) {
        try {
          await onAuthorizationRejected?.(accessToken)
        } catch {
          setActionFeedback({ type: 'error', text: 'El servidor rechazó la sesión y no fue posible revalidarla. Inicia sesión de nuevo.' })
        }
      }
    } finally {
      if (requestControllerRef.current === controller) requestControllerRef.current = null
      setPendingRevisionId(null)
    }
  }

  function toggleHistory() {
    if (expanded) {
      requestControllerRef.current?.abort()
      requestControllerRef.current = null
      setHistory(null)
      setState(null)
      setActionFeedback(null)
      setPublicationConfirmationId(null)
      setExpanded(false)
    } else {
      setExpanded(true)
      void loadHistory()
    }
  }

  const panelId = `academic-period-history-${period.id}`
  return (
    <div className="academic-period-history">
      <button
        className="academic-period-history-toggle"
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={toggleHistory}
      >{expanded ? 'Ocultar historial' : `Ver historial de ${period.code}`}</button>
      <section id={panelId} className="academic-period-history-content" aria-label={`Historial de ${period.code}`} hidden={!expanded}>
        {state === 'loading' && <p className="academic-period-history-message" role="status">Consultando revisiones y movimientos auditados…</p>}
        {state === 'error' && <div className="academic-period-history-error" role="alert">
          <p>No fue posible consultar el historial. Verifica tu sesión y vuelve a intentarlo.</p>
          <button type="button" onClick={() => void loadHistory()}>Reintentar historial</button>
        </div>}
        {state === 'ready' && history && <>
          {actionFeedback && <p className={`academic-period-history-feedback is-${actionFeedback.type}`}
            role={actionFeedback.type === 'error' ? 'alert' : 'status'}>{actionFeedback.text}</p>}
          <section className="academic-period-history-section" aria-labelledby={`${panelId}-calendars`}>
            <h4 id={`${panelId}-calendars`}>Versiones del calendario</h4>
            {history.calendarRevisions.length === 0
              ? <p className="academic-period-history-empty">Este periodo aún no tiene revisiones de calendario.</p>
              : <ol className="academic-period-history-revisions">
                  {history.calendarRevisions.map((revision) => <li key={revision.id}>
                    <strong>Revisión {revision.version}</strong>
                    <span className={`academic-period-history-state revision-${revision.status.toLocaleLowerCase('en-US')}`}>
                      {revision.status === 'PUBLISHED' ? 'Publicada' : 'Borrador'}
                    </span>
                    {revision.officialReference && <p>{revision.officialReference}</p>}
                    {revision.activities.length > 0 && <ul aria-label={`Actividades de revisión ${revision.version}`}>
                      {revision.activities.map((activity) => <li key={`${revision.id}-${activity.key}`}>
                        <span>{activity.label}</span>
                        <time dateTime={activity.startsAt}>{formatInstitutionalDateTime(activity.startsAt)} – {formatInstitutionalDateTime(activity.endsAt)}</time>
                      </li>)}
                    </ul>}
                  </li>)}
                </ol>}
            {canWrite && period.status === 'DRAFT' && history.calendarRevisions.some((revision) => revision.status === 'DRAFT') && (
              <div className="academic-period-history-actions" aria-label="Publicar revisiones en borrador">
                {history.calendarRevisions.filter((revision) => revision.status === 'DRAFT').map((revision) => (
                  <div key={revision.id} className="academic-period-publish-row">
                    {publicationConfirmationId !== revision.id
                      ? <button type="button" disabled={pendingRevisionId !== null}
                          onClick={() => setPublicationConfirmationId(revision.id)}>Publicar revisión {revision.version}</button>
                      : <div className="academic-period-publish-confirmation" role="group"
                          aria-label={`Confirmar publicación de revisión ${revision.version}`}>
                          <p>Publicar hace inmutable esta revisión del calendario.</p>
                          <button type="button" disabled={pendingRevisionId !== null}
                            onClick={() => void publishRevision(revision.id, revision.version)}>
                            {pendingRevisionId === revision.id ? 'Publicando…' : 'Confirmar publicación'}
                          </button>
                          <button type="button" className="secondary" disabled={pendingRevisionId !== null}
                            onClick={() => setPublicationConfirmationId(null)}>Cancelar</button>
                        </div>}
                  </div>
                ))}
              </div>
            )}
            <p className="academic-period-history-footnote">Las horas corresponden al calendario institucional de Colombia.</p>
          </section>
          <section className="academic-period-history-section" aria-labelledby={`${panelId}-events`}>
            <h4 id={`${panelId}-events`}>Movimientos auditados</h4>
            {history.auditEvents.length === 0
              ? <p className="academic-period-history-empty">No hay movimientos de auditoría registrados.</p>
              : <ol className="academic-period-history-events">
                  {history.auditEvents.map((event) => <li key={event.id}>
                    <strong>{auditActionLabel(event.actionKey)}</strong>
                    <time dateTime={event.occurredAt}>{formatAuditInstant(event.occurredAt)}</time>
                    <span>Actor: {event.actorSub}</span>
                    {event.reference && <span>Referencia: {event.reference}</span>}
                  </li>)}
                </ol>}
          </section>
          {canWrite && period.status === 'DRAFT' && <AcademicCalendarRevisionForm
            periodId={period.id}
            accessToken={accessToken}
            client={client}
            units={units}
            sites={sites}
            onCreated={loadHistory}
            onAuthorizationRejected={onAuthorizationRejected}
          />}
          {canWrite && period.status === 'DRAFT' && history.calendarRevisions.some((revision) => revision.status === 'PUBLISHED') && (
            <ApproveAcademicPeriodForm
              periodId={period.id}
              publishedRevisions={history.calendarRevisions.filter((revision) => revision.status === 'PUBLISHED')}
              accessToken={accessToken}
              client={client}
              onApproved={(updatedPeriod) => {
                onPeriodUpdated?.(updatedPeriod)
                setHistory((current) => current ? { ...current, period: updatedPeriod } : current)
              }}
              onAuthorizationRejected={onAuthorizationRejected}
            />
          )}
        </>}
      </section>
    </div>
  )
}

function auditActionLabel(action: AcademicPeriodAuditAction): string {
  const labels: Record<AcademicPeriodAuditAction, string> = {
    PERIOD_CREATED: 'Periodo creado',
    CALENDAR_CREATED: 'Borrador de calendario creado',
    CALENDAR_PUBLISHED: 'Calendario publicado',
    PERIOD_APPROVED: 'Periodo aprobado',
    PERIOD_OPENED: 'Periodo abierto',
    PERIOD_CLOSED: 'Periodo cerrado',
    PERIOD_CANCELLED: 'Periodo cancelado',
    PERIOD_CALENDAR_AMENDED: 'Enmienda de calendario activada',
  }
  return labels[action]
}

function formatAuditInstant(value: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(new Date(value))
}

function formatInstitutionalDateTime(value: string): string {
  return value.replace('T', ' ')
}
