import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { AcademicCatalogClient, AcademicCurriculum, AcademicCurriculumEntry, AcademicProgram } from './contracts'
import { academicCatalogClient } from './academicCatalogClient'
import type { AcademicPeriod } from './academicOperationsContracts'
import type {
  AcademicOfferingAuditPage,
  AcademicOfferingAuthorization,
  AcademicOfferingDraft,
  AcademicOfferingDraftClient,
  AcademicOfferingDraftSnapshot,
} from './academicOfferingDraftContracts'
import { academicOfferingDraftClient } from './academicOfferingDraftClient'
import { AcademicOfferingDraftApiError } from './academicOfferingDraftClient'
import './AcademicOfferingDraftPanel.scss'

type CatalogClient = Pick<AcademicCatalogClient, 'listCurricula' | 'listPublishedCurriculumEntries'>
type RequestState = 'loading' | 'ready' | 'error'
type FormValues = {
  sectionCode: string
  startsOn: string
  endsOn: string
  proposedCapacity: string
  sourceReference: string
}

const EMPTY_FORM: FormValues = { sectionCode: '', startsOn: '', endsOn: '', proposedCapacity: '', sourceReference: '' }

interface AcademicOfferingDraftPanelProps {
  client?: AcademicOfferingDraftClient
  catalogClient?: CatalogClient
  periods: AcademicPeriod[]
  programs: AcademicProgram[]
  authorization?: AcademicOfferingAuthorization | null
  onAuthorizationRejected?: (accessToken: string) => Promise<void>
}

export function AcademicOfferingDraftPanel({
  client = academicOfferingDraftClient,
  catalogClient = academicCatalogClient,
  periods,
  programs,
  authorization = null,
  onAuthorizationRejected,
}: AcademicOfferingDraftPanelProps) {
  const accessToken = authorization?.accessToken ?? ''
  const [rejectedAccessToken, setRejectedAccessToken] = useState<string | null>(null)
  const canRead = authorization?.canRead === true && accessToken.length > 0 && accessToken !== rejectedAccessToken
  const canWrite = canRead && authorization?.canWrite === true
  const [requestedPeriodId, setSelectedPeriodId] = useState(periods[0]?.id ?? '')
  const selectedPeriodId = periods.some((period) => period.id === requestedPeriodId)
    ? requestedPeriodId
    : periods[0]?.id ?? ''
  const [drafts, setDrafts] = useState<AcademicOfferingDraft[]>([])
  const [draftState, setDraftState] = useState<RequestState>('loading')
  const [draftError, setDraftError] = useState('')
  const [draftMessage, setDraftMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [refreshNumber, setRefreshNumber] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [formValues, setFormValues] = useState<FormValues>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [requestedProgramId, setSelectedProgramId] = useState(programs[0]?.id ?? '')
  const selectedProgramId = programs.some((program) => program.id === requestedProgramId)
    ? requestedProgramId
    : programs[0]?.id ?? ''
  const [curricula, setCurricula] = useState<AcademicCurriculum[]>([])
  const [curriculumState, setCurriculumState] = useState<RequestState>('ready')
  const [curriculumError, setCurriculumError] = useState('')
  const [curriculumAttempt, setCurriculumAttempt] = useState(0)
  const [selectedCurriculumId, setSelectedCurriculumId] = useState('')
  const [subjectSearch, setSubjectSearch] = useState('')
  const [subjects, setSubjects] = useState<AcademicCurriculumEntry[]>([])
  const [subjectState, setSubjectState] = useState<RequestState>('ready')
  const [subjectError, setSubjectError] = useState('')
  const [subjectAttempt, setSubjectAttempt] = useState(0)
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [editingOfferingId, setEditingOfferingId] = useState<string | null>(null)
  const [editingValues, setEditingValues] = useState<FormValues>(EMPTY_FORM)
  const [historyOfferingId, setHistoryOfferingId] = useState<string | null>(null)
  const [historyAttempt, setHistoryAttempt] = useState(0)
  const [history, setHistory] = useState<AcademicOfferingAuditPage | null>(null)
  const [historyState, setHistoryState] = useState<RequestState>('ready')
  const [historyError, setHistoryError] = useState('')
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false)
  const currentAuthorizationRef = useRef({ accessToken, canRead, canWrite })
  const mutationControllerRef = useRef<AbortController | null>(null)
  const loadMoreControllerRef = useRef<AbortController | null>(null)
  const historyMoreControllerRef = useRef<AbortController | null>(null)

  useLayoutEffect(() => {
    currentAuthorizationRef.current = { accessToken, canRead, canWrite }
  }, [accessToken, canRead, canWrite])

  const isCurrentAccess = useCallback((token: string, needsWrite: boolean): boolean => {
    const current = currentAuthorizationRef.current
    return current.accessToken === token && current.canRead && (!needsWrite || current.canWrite)
  }, [])

  const handleAuthorizationError = useCallback((error: unknown, token: string) => {
    const status = error instanceof AcademicOfferingDraftApiError || hasStatus(error) ? error.status : 0
    if (status === 401 || status === 403) {
      setRejectedAccessToken(token)
      void Promise.resolve(onAuthorizationRejected?.(token)).catch(() => undefined)
    }
  }, [onAuthorizationRejected])

  useEffect(() => {
    if (!canRead || !accessToken || !selectedPeriodId) {
      // Clear period-scoped administrative data before the prior query can remain visible.
      // oxlint-disable-next-line react/set-state-in-effect
      setDrafts([])
      setNextCursor(null)
      setDraftState('ready')
      return
    }
    const controller = new AbortController()
    setDraftState('loading')
    setDraftError('')
    setDrafts([])
    setNextCursor(null)
    client.listDrafts(selectedPeriodId, { limit: 25 }, accessToken, controller.signal)
      .then((page) => {
        if (controller.signal.aborted || !isCurrentAccess(accessToken, false)) return
        setDrafts(page.drafts)
        setNextCursor(page.nextCursor)
        setDraftState('ready')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || !isCurrentAccess(accessToken, false)) return
        handleAuthorizationError(error, accessToken)
        setDraftError('No se pudieron cargar los borradores de este periodo. Comprueba la conexión e inténtalo de nuevo.')
        setDraftState('error')
      })
    return () => controller.abort()
  }, [accessToken, canRead, client, handleAuthorizationError, isCurrentAccess, refreshNumber, selectedPeriodId])

  useEffect(() => {
    if (!canWrite) {
      // Drop catalog results as soon as the write grant is absent.
      // oxlint-disable-next-line react/set-state-in-effect
      setCurricula([])
      setCurriculumState('ready')
      setSelectedCurriculumId('')
      setSubjects([])
      setSelectedSubjectId('')
      return
    }
    if (!selectedProgramId) {
      setCurricula([])
      setCurriculumState('ready')
      return
    }
    const controller = new AbortController()
    setCurriculumState('loading')
    setCurriculumError('')
    setCurricula([])
    setSelectedCurriculumId('')
    setSubjects([])
    setSelectedSubjectId('')
    catalogClient.listCurricula(selectedProgramId, controller.signal)
      .then((result) => {
        if (controller.signal.aborted || !isCurrentAccess(accessToken, true)) return
        const published = result.filter((curriculum) => curriculum.status === 'PUBLISHED')
        setCurricula(published)
        setSelectedCurriculumId(published[0]?.id ?? '')
        setCurriculumState('ready')
      })
      .catch(() => {
        if (controller.signal.aborted || !isCurrentAccess(accessToken, true)) return
        setCurriculumError('No se pudieron consultar los currículos publicados de este programa.')
        setCurriculumState('error')
      })
    return () => controller.abort()
  }, [accessToken, canWrite, catalogClient, curriculumAttempt, isCurrentAccess, programs, selectedProgramId])

  useEffect(() => {
    if (!canWrite || !selectedCurriculumId) {
      // Do not retain a subject list after the selected published curriculum changes.
      // oxlint-disable-next-line react/set-state-in-effect
      setSubjects([])
      setSubjectState('ready')
      return
    }
    const controller = new AbortController()
    setSubjectState('loading')
    setSubjectError('')
    setSubjects([])
    setSelectedSubjectId('')
    catalogClient.listPublishedCurriculumEntries(selectedCurriculumId, {
      page: 1,
      pageSize: 100,
      search: subjectSearch.trim(),
    }, controller.signal)
      .then((page) => {
        if (controller.signal.aborted || !isCurrentAccess(accessToken, true)) return
        setSubjects(page.entries)
        setSelectedSubjectId(page.entries[0]?.subjectId ?? '')
        setSubjectState('ready')
      })
      .catch(() => {
        if (controller.signal.aborted || !isCurrentAccess(accessToken, true)) return
        setSubjectError('No se pudieron consultar las asignaturas del currículo publicado.')
        setSubjectState('error')
      })
    return () => controller.abort()
  }, [accessToken, canWrite, catalogClient, isCurrentAccess, selectedCurriculumId, subjectAttempt, subjectSearch])

  useEffect(() => {
    if (!canRead || !accessToken || !historyOfferingId) {
      // Audit rows are scoped to the selected draft and its current read grant.
      // oxlint-disable-next-line react/set-state-in-effect
      setHistory(null)
      setHistoryState('ready')
      return
    }
    const controller = new AbortController()
    setHistory(null)
    setHistoryError('')
    setHistoryState('loading')
    client.listAuditEvents(historyOfferingId, { limit: 25 }, accessToken, controller.signal)
      .then((page) => {
        if (controller.signal.aborted || !isCurrentAccess(accessToken, false)) return
        setHistory(page)
        setHistoryState('ready')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || !isCurrentAccess(accessToken, false)) return
        handleAuthorizationError(error, accessToken)
        setHistoryError('No se pudo consultar el historial de este borrador.')
        setHistoryState('error')
      })
    return () => {
      controller.abort()
      historyMoreControllerRef.current?.abort()
      historyMoreControllerRef.current = null
    }
  }, [accessToken, canRead, client, handleAuthorizationError, historyAttempt, historyOfferingId, isCurrentAccess])

  useEffect(() => {
    if (!canWrite) {
      mutationControllerRef.current?.abort()
      mutationControllerRef.current = null
      // Reset an interrupted form mutation when its authorization is revoked.
      // oxlint-disable-next-line react/set-state-in-effect
      setSaving(false)
      setEditingOfferingId(null)
    }
    if (!canRead) {
      loadMoreControllerRef.current?.abort()
      loadMoreControllerRef.current = null
      historyMoreControllerRef.current?.abort()
      historyMoreControllerRef.current = null
    }
  }, [accessToken, canRead, canWrite])

  useEffect(() => () => {
    mutationControllerRef.current?.abort()
    loadMoreControllerRef.current?.abort()
    historyMoreControllerRef.current?.abort()
  }, [])

  const periodOptions = useMemo(() => [...periods].sort((first, second) => second.startsOn.localeCompare(first.startsOn)), [periods])
  const selectedPeriod = periodOptions.find((period) => period.id === selectedPeriodId) ?? null

  function retryHistory() {
    setHistoryAttempt((attempt) => attempt + 1)
  }

  async function loadMore() {
    if (!nextCursor || !canRead || !accessToken || !selectedPeriodId || loadingMore) return
    const cursor = nextCursor
    const controller = new AbortController()
    loadMoreControllerRef.current = controller
    setLoadingMore(true)
    try {
      const page = await client.listDrafts(selectedPeriodId, { limit: 25, before: cursor }, accessToken, controller.signal)
      if (!controller.signal.aborted && isCurrentAccess(accessToken, false)) {
        setDrafts((current) => [...current, ...page.drafts])
        setNextCursor(page.nextCursor)
      }
    } catch (error) {
      if (!controller.signal.aborted && isCurrentAccess(accessToken, false)) {
        handleAuthorizationError(error, accessToken)
        setDraftMessage({ type: 'error', text: 'No se pudo cargar la página siguiente.' })
      }
    } finally {
      if (!controller.signal.aborted) setLoadingMore(false)
      if (loadMoreControllerRef.current === controller) loadMoreControllerRef.current = null
    }
  }

  async function loadMoreHistory() {
    const cursor = history?.nextCursor
    const offeringId = historyOfferingId
    if (!cursor || !offeringId || !canRead || !accessToken || loadingMoreHistory) return
    const controller = new AbortController()
    historyMoreControllerRef.current = controller
    setLoadingMoreHistory(true)
    try {
      const page = await client.listAuditEvents(offeringId, { limit: 25, before: cursor }, accessToken, controller.signal)
      if (!controller.signal.aborted && isCurrentAccess(accessToken, false)) {
        setHistory((current) => current && currentOfferingHistory(current, offeringId)
          ? { events: [...current.events, ...page.events], nextCursor: page.nextCursor }
          : current)
      }
    } catch (error) {
      if (!controller.signal.aborted && isCurrentAccess(accessToken, false)) {
        handleAuthorizationError(error, accessToken)
        setHistoryError('No se pudo cargar la página anterior del historial.')
        setHistoryState('error')
      }
    } finally {
      if (!controller.signal.aborted) setLoadingMoreHistory(false)
      if (historyMoreControllerRef.current === controller) historyMoreControllerRef.current = null
    }
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canWrite || !accessToken || !selectedPeriodId || !selectedCurriculumId || !selectedSubjectId || saving) return
    const controller = new AbortController()
    mutationControllerRef.current = controller
    setSaving(true)
    setDraftMessage(null)
    try {
      const receipt = await client.createDraft({
        periodId: selectedPeriodId,
        curriculumId: selectedCurriculumId,
        subjectId: selectedSubjectId,
        sectionCode: formValues.sectionCode,
        startsOn: formValues.startsOn,
        endsOn: formValues.endsOn,
        proposedCapacity: Number(formValues.proposedCapacity),
        sourceReference: formValues.sourceReference,
      }, accessToken, controller.signal)
      if (controller.signal.aborted || !isCurrentAccess(accessToken, true)) return
      setFormValues(EMPTY_FORM)
      setDraftMessage({ type: 'success', text: `Borrador guardado · versión ${receipt.version}.` })
      setRefreshNumber((number) => number + 1)
    } catch (error) {
      if (controller.signal.aborted || !isCurrentAccess(accessToken, true)) return
      handleAuthorizationError(error, accessToken)
      if (statusOf(error) === 409) {
        setDraftMessage({ type: 'error', text: 'Cambió el estado mientras guardabas. Actualiza la lista y revisa antes de volver a intentarlo.' })
        setRefreshNumber((number) => number + 1)
      } else {
        setDraftMessage({ type: 'error', text: 'No se pudo guardar el borrador. Revisa los campos e inténtalo de nuevo.' })
      }
    } finally {
      if (!controller.signal.aborted) setSaving(false)
      if (mutationControllerRef.current === controller) mutationControllerRef.current = null
    }
  }

  function beginEdit(draft: AcademicOfferingDraft) {
    setEditingOfferingId(draft.id)
    setEditingValues({
      sectionCode: draft.sectionCode,
      startsOn: draft.startsOn,
      endsOn: draft.endsOn,
      proposedCapacity: String(draft.proposedCapacity),
      sourceReference: draft.sourceReference,
    })
    setDraftMessage(null)
  }

  async function submitUpdate(event: FormEvent<HTMLFormElement>, draft: AcademicOfferingDraft) {
    event.preventDefault()
    if (!canWrite || !accessToken || saving) return
    const controller = new AbortController()
    mutationControllerRef.current = controller
    setSaving(true)
    setDraftMessage(null)
    try {
      const receipt = await client.updateDraft(draft.id, {
        expectedVersion: draft.version,
        sectionCode: editingValues.sectionCode,
        startsOn: editingValues.startsOn,
        endsOn: editingValues.endsOn,
        proposedCapacity: Number(editingValues.proposedCapacity),
        sourceReference: editingValues.sourceReference,
      }, accessToken, controller.signal)
      if (controller.signal.aborted || !isCurrentAccess(accessToken, true)) return
      setEditingOfferingId(null)
      setDraftMessage({ type: 'success', text: `Borrador actualizado · versión ${receipt.version}.` })
      setRefreshNumber((number) => number + 1)
    } catch (error) {
      if (controller.signal.aborted || !isCurrentAccess(accessToken, true)) return
      handleAuthorizationError(error, accessToken)
      if (statusOf(error) === 409) {
        setEditingOfferingId(null)
        setDraftMessage({ type: 'error', text: 'La versión del borrador cambió. Actualizamos la lista; vuelve a abrirlo antes de editar.' })
        setRefreshNumber((number) => number + 1)
      } else {
        setDraftMessage({ type: 'error', text: 'No se pudo actualizar el borrador. Revisa los campos e inténtalo de nuevo.' })
      }
    } finally {
      if (!controller.signal.aborted) setSaving(false)
      if (mutationControllerRef.current === controller) mutationControllerRef.current = null
    }
  }

  if (!canRead) return null

  return (
    <section className="academic-panel academic-offerings-panel" role="region" aria-labelledby="academic-offerings-title">
      <header className="academic-panel-heading">
        <span className="academic-panel-icon academic-icon-offerings" aria-hidden="true">▤</span>
        <div>
          <p className="academic-panel-kicker">PROGRAMACIÓN ACADÉMICA · BORRADORES</p>
          <h2 id="academic-offerings-title">Borradores de oferta</h2>
        </div>
        <span className="academic-panel-count">{drafts.length.toString().padStart(2, '0')}</span>
      </header>

      <p className="academic-offerings-intro">
        Cada registro propone un grupo y una capacidad propuesta. Es un borrador técnico: no representa cupos disponibles,
        inscripción, matrícula ni una oferta publicada.
      </p>

      <div className="academic-offerings-period-row">
        <label>
          Periodo académico
          <select aria-label="Periodo académico para borradores" value={selectedPeriodId}
            onChange={(event) => { setSelectedPeriodId(event.target.value); setHistoryOfferingId(null); setEditingOfferingId(null) }}>
            <option value="">Selecciona un periodo</option>
            {periodOptions.map((period) => (
              <option key={period.id} value={period.id}>{period.code} · {period.kind === 'INTERSEMESTRAL' ? 'Intersemestral' : 'Semestral'} · {period.status}</option>
            ))}
          </select>
        </label>
        {selectedPeriod && <span className="academic-offerings-period-dates">{selectedPeriod.startsOn} — {selectedPeriod.endsOn}</span>}
      </div>

      {draftMessage && <p className={`academic-offering-message is-${draftMessage.type}`} role={draftMessage.type === 'error' ? 'alert' : 'status'}>{draftMessage.text}</p>}

      {canWrite && selectedPeriodId && (
        <form className="academic-offering-form" onSubmit={(event) => void submitCreate(event)}>
          <div className="academic-offering-form-heading">
            <div><p className="academic-panel-kicker">NUEVO REGISTRO</p><h3>Preparar grupo</h3></div>
            <span className="academic-offering-status">Borrador técnico</span>
          </div>
          <div className="academic-offering-fields">
            <label>
              Programa publicado
              <select aria-label="Programa publicado" value={selectedProgramId} required
                onChange={(event) => setSelectedProgramId(event.target.value)}>
                <option value="">Selecciona un programa</option>
                {programs.map((program) => <option key={program.id} value={program.id}>{program.programCode} · {program.programName}</option>)}
              </select>
            </label>
            <label>
              Currículo publicado
              <select aria-label="Currículo publicado" value={selectedCurriculumId} required
                disabled={curriculumState !== 'ready' || curricula.length === 0}
                onChange={(event) => setSelectedCurriculumId(event.target.value)}>
                <option value="">Selecciona un currículo</option>
                {curricula.map((curriculum) => <option key={curriculum.id} value={curriculum.id}>{curriculum.curriculumVersion} · {curriculum.entryCount} asignaturas</option>)}
              </select>
            </label>
            <label>
              Buscar asignatura
              <input aria-label="Buscar asignatura" value={subjectSearch} maxLength={120}
                onChange={(event) => setSubjectSearch(event.target.value)} placeholder="Código o nombre" />
            </label>
            <label>
              Asignatura del currículo
              <select aria-label="Asignatura del currículo" value={selectedSubjectId} required
                disabled={subjectState !== 'ready' || subjects.length === 0}
                onChange={(event) => setSelectedSubjectId(event.target.value)}>
                <option value="">Selecciona una asignatura</option>
                {subjects.map((subject) => <option key={`${subject.subjectId}:${subject.rowOrder}`} value={subject.subjectId}>{subject.subjectCode} · {subject.subjectName} · semestre {subject.semester}</option>)}
              </select>
            </label>
            <label>
              Código del grupo
              <input aria-label="Código del grupo" value={formValues.sectionCode} required maxLength={24} pattern="[A-Za-z0-9][A-Za-z0-9._-]{0,23}"
                onChange={(event) => setFormValues((current) => ({ ...current, sectionCode: event.target.value }))} />
            </label>
            <label>
              Fecha de inicio
              <input aria-label="Fecha de inicio" type="date" value={formValues.startsOn} required
                onChange={(event) => setFormValues((current) => ({ ...current, startsOn: event.target.value }))} />
            </label>
            <label>
              Fecha de cierre
              <input aria-label="Fecha de cierre" type="date" min={formValues.startsOn || undefined} value={formValues.endsOn} required
                onChange={(event) => setFormValues((current) => ({ ...current, endsOn: event.target.value }))} />
            </label>
            <label>
              Capacidad propuesta (borrador)
              <input aria-label="Capacidad propuesta" type="number" min="1" max="2147483647" step="1" value={formValues.proposedCapacity} required
                onChange={(event) => setFormValues((current) => ({ ...current, proposedCapacity: event.target.value }))} />
            </label>
            <label className="academic-offering-reference-field">
              Referencia institucional
              <input aria-label="Referencia institucional" value={formValues.sourceReference} maxLength={240} required
                onChange={(event) => setFormValues((current) => ({ ...current, sourceReference: event.target.value }))} />
            </label>
          </div>
          {curriculumState === 'loading' && <p className="academic-offering-inline-status" role="status">Cargando currículos publicados…</p>}
          {curriculumState === 'error' && (
            <div className="academic-offering-inline-error" role="alert">
              <span>{curriculumError}</span>
              <button type="button" onClick={() => setCurriculumAttempt((attempt) => attempt + 1)}>
                Reintentar consulta de currículos
              </button>
            </div>
          )}
          {curriculumState === 'ready' && selectedProgramId && curricula.length === 0 && <p className="academic-offering-inline-status">Este programa no tiene currículos publicados disponibles.</p>}
          {subjectState === 'loading' && <p className="academic-offering-inline-status" role="status">Buscando asignaturas en el currículo publicado…</p>}
          {subjectState === 'error' && (
            <div className="academic-offering-inline-error" role="alert">
              <span>{subjectError}</span>
              <button type="button" onClick={() => setSubjectAttempt((attempt) => attempt + 1)}>
                Reintentar consulta de asignaturas
              </button>
            </div>
          )}
          {subjectState === 'ready' && selectedCurriculumId && subjects.length === 0 && <p className="academic-offering-inline-status">No hay asignaturas que coincidan con la búsqueda.</p>}
          <footer className="academic-offering-form-footer">
            <p>El grupo queda ligado a este periodo y a la revisión publicada del currículo.</p>
            <button type="submit" disabled={saving || curricula.length === 0 || subjects.length === 0}>{saving ? 'Guardando…' : 'Guardar borrador'}</button>
          </footer>
        </form>
      )}

      <div className="academic-offering-list-heading">
        <h3>Grupos registrados <span>{selectedPeriod?.code ?? 'Sin periodo'}</span></h3>
        <button type="button" className="academic-offering-refresh" disabled={!selectedPeriodId || draftState === 'loading'}
          onClick={() => setRefreshNumber((number) => number + 1)}>Actualizar lista</button>
      </div>

      {periodOptions.length === 0 && <p className="academic-empty-state">No hay periodos académicos para consultar borradores.</p>}
      {periodOptions.length > 0 && !selectedPeriodId && <p className="academic-empty-state">Selecciona un periodo académico para consultar sus borradores.</p>}
      {selectedPeriodId && draftState === 'loading' && <p className="academic-offering-inline-status" role="status">Cargando borradores…</p>}
      {draftState === 'error' && <div className="academic-offering-inline-error" role="alert"><span>{draftError}</span><button type="button" onClick={() => setRefreshNumber((number) => number + 1)}>Reintentar consulta</button></div>}
      {selectedPeriodId && draftState === 'ready' && drafts.length === 0 && <p className="academic-empty-state">No hay borradores de grupos para este periodo.</p>}

      {drafts.length > 0 && (
        <ul className="academic-offering-draft-list">
          {drafts.map((draft) => (
            <li key={draft.id}>
              <article className="academic-offering-draft-card">
                <div className="academic-offering-draft-heading">
                  <div><span className="academic-offering-status">Borrador técnico · v{draft.version}</span><strong>{draft.sectionCode}</strong></div>
                  <span>{draft.subjectCode}</span>
                </div>
                <p className="academic-offering-subject">{draft.subjectName}</p>
                <p className="academic-offering-program">{draft.programCode} · {draft.programName} · currículo {draft.curriculumVersion}</p>
                <dl className="academic-offering-facts">
                  <div><dt>Periodo</dt><dd>{draft.periodCode} · {draft.periodKind === 'INTERSEMESTRAL' ? 'Intersemestral' : 'Semestral'}</dd></div>
                  <div><dt>Fechas propuestas</dt><dd>{draft.startsOn} — {draft.endsOn}</dd></div>
                  <div><dt>Capacidad propuesta (borrador)</dt><dd>{draft.proposedCapacity}</dd></div>
                  <div><dt>Actualizado por</dt><dd>{draft.updatedBy}</dd></div>
                  <div className="academic-offering-reference-fact"><dt>Referencia institucional</dt><dd>{draft.sourceReference}</dd></div>
                </dl>
                <div className="academic-offering-card-actions">
                  {canWrite && <button type="button" onClick={() => beginEdit(draft)}>Editar borrador</button>}
                  <button type="button" aria-expanded={historyOfferingId === draft.id}
                    onClick={() => setHistoryOfferingId((current) => current === draft.id ? null : draft.id)}>
                    {historyOfferingId === draft.id ? 'Ocultar historial' : 'Consultar historial'}
                  </button>
                </div>
                {canWrite && editingOfferingId === draft.id && (
                  <form className="academic-offering-edit-form" onSubmit={(event) => void submitUpdate(event, draft)}>
                    <h4>Editar borrador · versión {draft.version}</h4>
                    <div className="academic-offering-fields">
                      <label>Código del grupo<input aria-label={`Código del grupo del borrador ${draft.sectionCode}`} value={editingValues.sectionCode} required maxLength={24}
                        onChange={(event) => setEditingValues((current) => ({ ...current, sectionCode: event.target.value }))} /></label>
                      <label>Fecha de inicio<input type="date" aria-label={`Inicio del borrador ${draft.sectionCode}`} value={editingValues.startsOn} required
                        onChange={(event) => setEditingValues((current) => ({ ...current, startsOn: event.target.value }))} /></label>
                      <label>Fecha de cierre<input type="date" aria-label={`Cierre del borrador ${draft.sectionCode}`} min={editingValues.startsOn || undefined} value={editingValues.endsOn} required
                        onChange={(event) => setEditingValues((current) => ({ ...current, endsOn: event.target.value }))} /></label>
                      <label>Capacidad propuesta (borrador)<input type="number" aria-label={`Capacidad propuesta del borrador ${draft.sectionCode}`} min="1" step="1" value={editingValues.proposedCapacity} required
                        onChange={(event) => setEditingValues((current) => ({ ...current, proposedCapacity: event.target.value }))} /></label>
                      <label>Referencia institucional<input aria-label={`Referencia institucional del borrador ${draft.sectionCode}`} value={editingValues.sourceReference} maxLength={240} required
                        onChange={(event) => setEditingValues((current) => ({ ...current, sourceReference: event.target.value }))} /></label>
                    </div>
                    <div className="academic-offering-card-actions">
                      <button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
                      <button type="button" onClick={() => setEditingOfferingId(null)}>Cancelar</button>
                    </div>
                  </form>
                )}
                {historyOfferingId === draft.id && <AuditHistory state={historyState} error={historyError} history={history}
                  loadingMore={loadingMoreHistory} onLoadMore={() => void loadMoreHistory()} onRetry={retryHistory} />}
              </article>
            </li>
          ))}
        </ul>
      )}
      {nextCursor && <button type="button" className="academic-offering-load-more" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Cargando…' : 'Cargar más borradores'}</button>}
    </section>
  )
}

function AuditHistory({ state, error, history, loadingMore, onLoadMore, onRetry }: {
  state: RequestState
  error: string
  history: AcademicOfferingAuditPage | null
  loadingMore: boolean
  onLoadMore: () => void
  onRetry: () => void
}) {
  if (state === 'loading') return <p className="academic-offering-inline-status" role="status">Consultando el historial…</p>
  if (state === 'error') {
    return <div className="academic-offering-inline-error" role="alert">
      <span>{error}</span>
      <button type="button" onClick={onRetry}>Reintentar consulta</button>
    </div>
  }
  if (!history || history.events.length === 0) return <p className="academic-offering-inline-status">Este borrador todavía no tiene eventos de historial.</p>
  return (
    <ol className="academic-offering-audit-list">
      {history.events.map((event) => (
        <li key={event.id}>
          <div className="academic-offering-audit-heading"><strong>{event.actionKey === 'OFFERING_DRAFT_CREATED' ? 'Borrador creado' : 'Borrador actualizado'}</strong><time dateTime={event.occurredAt}>{formatInstant(event.occurredAt)}</time></div>
          <p>Actor: {event.actor} · Referencia: {event.sourceReference}</p>
          <SnapshotSummary label="Antes" snapshot={event.before} />
          <SnapshotSummary label="Después" snapshot={event.after} />
        </li>
      ))}
      {history.nextCursor && <li><button type="button" disabled={loadingMore} onClick={onLoadMore}>{loadingMore ? 'Cargando…' : 'Cargar eventos anteriores'}</button></li>}
    </ol>
  )
}

function SnapshotSummary({ label, snapshot }: { label: string; snapshot: AcademicOfferingDraftSnapshot | null }) {
  if (!snapshot) return <p>{label}: sin versión anterior</p>
  return <p>{label} · versión {snapshot.version}: grupo {snapshot.sectionCode}, {snapshot.startsOn} — {snapshot.endsOn}, capacidad propuesta {snapshot.proposedCapacity}</p>
}

function formatInstant(value: string): string {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
}

function hasStatus(value: unknown): value is { status: number } {
  return typeof value === 'object' && value !== null && 'status' in value && typeof value.status === 'number'
}

function statusOf(value: unknown): number {
  return hasStatus(value) ? value.status : 0
}

function currentOfferingHistory(page: AcademicOfferingAuditPage, offeringId: string): boolean {
  return page.events.length === 0 || page.events.every((event) => event.offeringId === offeringId)
}
