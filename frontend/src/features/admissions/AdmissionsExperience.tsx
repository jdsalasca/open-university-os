import { useEffect, useState } from 'react'
import { normalizeSearchText } from '../../shared/text/normalizeSearchText'
import type { AdmissionsCalendarAuthorization, AdmissionsCallClient, PublicAdmissionsCall } from './admissionsCallContracts'
import { admissionsCallClient } from './admissionsCallClient'
import { AdmissionsCallManagementPanel } from './AdmissionsCallManagementPanel'
import { AdmissionsCalendarPage } from './AdmissionsCalendarPage'
import type { PublicAdmissionsCalendar, AdmissionsMilestoneKind as DisplayMilestoneKind } from './admissionsContracts'

interface AdmissionsExperienceProps {
  client?: AdmissionsCallClient
  authorization?: AdmissionsCalendarAuthorization | null
  onAuthorizationRejected?: (accessToken: string) => Promise<void> | void
}

export function AdmissionsExperience({
  client = admissionsCallClient,
  authorization = null,
  onAuthorizationRejected,
}: AdmissionsExperienceProps) {
  return (
    <AdmissionsCalendarExperience
      client={client}
      authorization={authorization}
      onAuthorizationRejected={onAuthorizationRejected}
    />
  )
}

export function AdmissionsCalendarExperience({
  client = admissionsCallClient,
  authorization = null,
  onAuthorizationRejected,
}: AdmissionsExperienceProps) {
  const [calls, setCalls] = useState<PublicAdmissionsCall[]>([])
  const [publicState, setPublicState] = useState<'loading' | 'published' | 'fallback'>('loading')
  const [publicError, setPublicError] = useState(false)
  const [publicRefreshNumber, setPublicRefreshNumber] = useState(0)
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const matchingCalls = filterPublishedAdmissionsCalls(calls, searchQuery)
  const selectedCall = matchingCalls.find((call) => call.callId === selectedCallId) ?? matchingCalls[0]
  const calendar = selectedCall ? toPublicCalendar(selectedCall) : undefined

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    client.getPublicCalls(controller.signal)
      .then((publishedCalls) => {
        if (!active) return
        setCalls(publishedCalls)
        setPublicState(publishedCalls.length ? 'published' : 'fallback')
      })
      .catch(() => {
        if (!active || controller.signal.aborted) return
        setCalls([])
        setPublicError(true)
        setPublicState('fallback')
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [client, publicRefreshNumber])

  function refreshPublicCall() {
    setPublicState('loading')
    setPublicError(false)
    setPublicRefreshNumber((current) => current + 1)
  }

  return (
    <div className="admissions-experience">
      {publicState === 'published' && selectedCall && (
        <p className="admissions-live-revision" role="status">
          Revisión publicada · versión {selectedCall.revisionNumber} · Referencia {selectedCall.officialReference}
        </p>
      )}
      {publicState === 'fallback' && (
        <p className="admissions-fallback-status" role="status">
          {publicError
            ? 'No fue posible consultar la agenda versionada. Se conserva la información pública de referencia.'
            : 'No hay una convocatoria administrada publicada. Se muestra la agenda pública de referencia.'}
        </p>
      )}
      {publicError && (
        <button className="admissions-admin-secondary" type="button" onClick={refreshPublicCall}>Reintentar</button>
      )}
      {publicState === 'published' && calls.length > 1 && (
        <div className="admissions-call-picker">
          <label htmlFor="admissions-call-search">Buscar convocatorias publicadas</label>
          <input id="admissions-call-search" type="search" value={searchQuery}
            onChange={(event) => setSearchQuery(event.currentTarget.value)}
            aria-describedby="admissions-call-search-hint" />
          <span id="admissions-call-search-hint">Busca por nombre, referencia oficial o texto de un hito.</span>
          {searchQuery.trim().length > 0 && matchingCalls.length > 0 && (
            <p className="admissions-call-search-count" role="status">
              {matchingCalls.length} de {calls.length} convocatorias publicadas
            </p>
          )}
          {matchingCalls.length > 1 && selectedCall && (
            <>
              <label htmlFor="admissions-published-call">Convocatoria publicada</label>
              <select id="admissions-published-call" value={selectedCall.callId}
                onChange={(event) => setSelectedCallId(event.currentTarget.value)}>
                {matchingCalls.map((call) => <option key={call.callId} value={call.callId}>
                  {call.content.callName} · {call.content.title}
                </option>)}
              </select>
              <span>Elige el calendario que quieres consultar.</span>
            </>
          )}
          {searchQuery.trim().length > 0 && matchingCalls.length === 0 && (
            <div className="admissions-call-search-empty">
              <p role="status">No hay convocatorias publicadas que coincidan con tu búsqueda.</p>
              <button type="button" onClick={() => setSearchQuery('')}>Limpiar búsqueda</button>
            </div>
          )}
        </div>
      )}
      {publicState !== 'published' || selectedCall
        ? <AdmissionsCalendarPage calendar={calendar} />
        : null}
      {authorization?.canRead === true && (
        <AdmissionsCallManagementPanel
          client={client}
          authorization={authorization}
          onAuthorizationRejected={onAuthorizationRejected}
          onPublished={refreshPublicCall}
        />
      )}
    </div>
  )
}

function filterPublishedAdmissionsCalls(calls: readonly PublicAdmissionsCall[], searchQuery: string): PublicAdmissionsCall[] {
  const query = normalizeSearchText(searchQuery)
  if (!query) return [...calls]

  return calls.filter((call) => {
    const searchableText = [
      call.callKey,
      call.officialReference,
      call.content.title,
      call.content.callName,
      ...call.content.milestones.flatMap((milestone) => [milestone.title, milestone.description]),
    ].join(' ')
    return normalizeSearchText(searchableText).includes(query)
  })
}


function toPublicCalendar(call: PublicAdmissionsCall): PublicAdmissionsCalendar {
  return {
    title: call.content.title,
    callName: call.content.callName,
    revisionNumber: call.revisionNumber,
    officialReference: call.officialReference,
    updatedAt: formatAdmissionsDate(call.content.updatedAt),
    checkedAt: formatAdmissionsDate(call.content.checkedAt),
    source: call.content.source,
    confirmationSource: call.content.confirmationSource,
    milestones: call.content.milestones.map((milestone) => ({
      id: milestone.key,
      startsOn: milestone.startsOn,
      endsOn: milestone.endsOn,
      dateLabel: milestoneDateLabel(milestone.startsOn, milestone.endsOn),
      title: milestone.title,
      description: milestone.description,
      kind: toDisplayKind(milestone.kind),
    })),
  }
}

function toDisplayKind(kind: string): DisplayMilestoneKind {
  switch (kind) {
    case 'SELECTION': return 'selection'
    case 'ENROLLMENT': return 'enrollment'
    default: return 'application'
  }
}

function formatAdmissionsDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1))
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(date)
}

function milestoneDateLabel(startsOn: string, endsOn: string): string {
  if (startsOn === endsOn) return compactDate(startsOn)
  return `${compactDate(startsOn)} – ${compactDate(endsOn)}`
}

function compactDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1))
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(date).replace('.', '')
}
