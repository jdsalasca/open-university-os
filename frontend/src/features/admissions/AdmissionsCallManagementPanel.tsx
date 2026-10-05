import { useEffect, useRef, useState } from 'react'
import type { ChangeEventHandler } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { AdmissionsCallApiError } from './admissionsCallContracts'
import type {
  AdmissionsCallAdmin,
  AdmissionsCallClient,
  AdmissionsCallContent,
  AdmissionsCallRevision,
  AdmissionsCalendarAuthorization,
  AdmissionsMilestoneKind,
} from './admissionsCallContracts'
import './AdmissionsCallManagementPanel.scss'

type EditorMode = 'new-call' | 'new-revision' | 'draft' | 'published' | null
type RequestState = 'loading' | 'ready' | 'error'
type Feedback = { kind: 'success' | 'error'; text: string }

interface EditorValues {
  callKey: string
  title: string
  callName: string
  updatedAt: string
  checkedAt: string
  sourceLabel: string
  sourceUrl: string
  confirmationSourceLabel: string
  confirmationSourceUrl: string
  milestones: Array<{
    key: string
    kind: AdmissionsMilestoneKind
    startsOn: string
    endsOn: string
    title: string
    description: string
  }>
}

interface AdmissionsCallManagementPanelProps {
  client: AdmissionsCallClient
  authorization: AdmissionsCalendarAuthorization
  onAuthorizationRejected?: (accessToken: string) => Promise<void> | void
  onPublished(): void
}

const EMPTY_VALUES: EditorValues = {
  callKey: '', title: '', callName: '', updatedAt: '', checkedAt: '', sourceLabel: '', sourceUrl: '',
  confirmationSourceLabel: '', confirmationSourceUrl: '', milestones: [emptyMilestone()],
}

export function AdmissionsCallManagementPanel({
  client,
  authorization,
  onAuthorizationRejected,
  onPublished,
}: AdmissionsCallManagementPanelProps) {
  const canWrite = authorization.canRead && authorization.canWrite
  const [calls, setCalls] = useState<AdmissionsCallAdmin[]>([])
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null)
  const [activeRevisionId, setActiveRevisionId] = useState<string | null>(null)
  const [draftVersion, setDraftVersion] = useState<number | null>(null)
  const [expectedPublishedRevisionId, setExpectedPublishedRevisionId] = useState<string | null>(null)
  const [editorMode, setEditorMode] = useState<EditorMode>(null)
  const [officialReference, setOfficialReference] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [requestState, setRequestState] = useState<RequestState>('loading')
  const [reloadNumber, setReloadNumber] = useState(0)
  const [busy, setBusy] = useState(false)
  const mutationController = useRef<AbortController | null>(null)
  const { control, register, handleSubmit, getValues, reset, formState: { errors, isSubmitting } } =
    useForm<EditorValues>({ defaultValues: EMPTY_VALUES })
  const { fields, append, remove } = useFieldArray({ control, name: 'milestones', rules: {
    minLength: { value: 1, message: 'Agrega al menos un hito para publicar la convocatoria.' },
    maxLength: { value: 50, message: 'Cada revisión admite hasta 50 hitos.' },
  } })

  useEffect(() => {
    const controller = new AbortController()
    setRequestState('loading')
    client.getAdminCalls(authorization.accessToken, controller.signal)
      .then((loadedCalls) => {
        if (controller.signal.aborted) return
        setCalls(loadedCalls)
        setRequestState('ready')
        if (selectedCallId) {
          const current = loadedCalls.find((call) => call.id === selectedCallId)
          if (current) selectCall(current)
          else clearEditor()
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setCalls([])
        setRequestState('error')
        if (isAuthorizationError(error)) void onAuthorizationRejected?.(authorization.accessToken)
      })
    return () => controller.abort()
    // State selection is applied after each successful read; the request restarts only on its explicit key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, authorization.accessToken, reloadNumber, onAuthorizationRejected])

  useEffect(() => {
    const controller = new AbortController()
    mutationController.current = controller
    return () => {
      controller.abort()
      mutationController.current = null
    }
  }, [authorization.accessToken, canWrite])

  const selectedCall = calls.find((call) => call.id === selectedCallId) ?? null

  function clearEditor() {
    setSelectedCallId(null)
    setActiveRevisionId(null)
    setDraftVersion(null)
    setExpectedPublishedRevisionId(null)
    setEditorMode(null)
    setOfficialReference('')
    reset(EMPTY_VALUES)
  }

  function selectCall(call: AdmissionsCallAdmin) {
    setSelectedCallId(call.id)
    setExpectedPublishedRevisionId(call.currentPublishedRevisionId)
    const revision = call.latestRevision
    if (revision.status === 'DRAFT') {
      setEditorMode('draft')
      setActiveRevisionId(revision.id)
      setDraftVersion(revision.draftVersion)
      setOfficialReference('')
      reset(toEditorValues(call.callKey, revision))
      return
    }
    const published = call.publishedRevision ?? revision
    setEditorMode('published')
    setActiveRevisionId(null)
    setDraftVersion(null)
    setOfficialReference(published.officialReference ?? '')
    reset(toEditorValues(call.callKey, published))
  }

  function startNewCall() {
    setSelectedCallId(null)
    setActiveRevisionId(null)
    setDraftVersion(null)
    setExpectedPublishedRevisionId(null)
    setEditorMode('new-call')
    setOfficialReference('')
    setFeedback(null)
    reset(EMPTY_VALUES)
  }

  function startNewRevision() {
    if (!selectedCall) return
    const source = selectedCall.publishedRevision ?? selectedCall.latestRevision
    setActiveRevisionId(null)
    setDraftVersion(null)
    setExpectedPublishedRevisionId(selectedCall.currentPublishedRevisionId)
    setEditorMode('new-revision')
    setOfficialReference('')
    setFeedback(null)
    reset(toEditorValues(selectedCall.callKey, source))
  }

  async function saveDraft(values: EditorValues) {
    if (!canWrite || !editorMode || editorMode === 'published') return
    const signal = mutationController.current?.signal
    if (!signal || signal.aborted) return
    setFeedback(null)
    try {
      const content = toContent(values)
      if (editorMode === 'new-call') {
        const created = await client.createCall({ callKey: values.callKey.trim(), content }, authorization.accessToken, signal)
        upsertCall(created)
        selectCall(created)
        setFeedback({ kind: 'success', text: 'Borrador de convocatoria guardado.' })
      } else if (editorMode === 'new-revision' && selectedCallId) {
        const revision = await client.createRevision(selectedCallId, content, authorization.accessToken, signal)
        const updated = { ...selectedCall!, latestRevision: revision }
        upsertCall(updated)
        setActiveRevisionId(revision.id)
        setDraftVersion(revision.draftVersion)
        setEditorMode('draft')
        setFeedback({ kind: 'success', text: `Borrador de revisión ${revision.revisionNumber} guardado.` })
      } else if (editorMode === 'draft' && selectedCallId && activeRevisionId && draftVersion) {
        const revision = await client.updateDraft(selectedCallId, activeRevisionId, draftVersion, content,
          authorization.accessToken, signal)
        const updated = { ...selectedCall!, latestRevision: revision }
        upsertCall(updated)
        setDraftVersion(revision.draftVersion)
        setFeedback({ kind: 'success', text: 'Borrador actualizado.' })
      }
    } catch (error) {
      await handleMutationError(error)
    }
  }

  async function publishDraft() {
    if (!canWrite || !selectedCallId || !activeRevisionId || !draftVersion || editorMode !== 'draft' || busy) return
    const reference = officialReference.trim()
    if (!reference) {
      setFeedback({ kind: 'error', text: 'Escribe la referencia oficial antes de publicar.' })
      return
    }
    if (!window.confirm('¿Publicar esta revisión de convocatoria para consulta pública?')) return
    const signal = mutationController.current?.signal
    if (!signal || signal.aborted) return
    setBusy(true)
    setFeedback(null)
    try {
      const published = await client.publish(selectedCallId, activeRevisionId, {
        expectedDraftVersion: draftVersion,
        expectedPublishedRevisionId,
        officialReference: reference,
      }, authorization.accessToken, signal)
      const updated: AdmissionsCallAdmin = {
        ...selectedCall!,
        currentPublishedRevisionId: published.id,
        latestRevision: published,
        publishedRevision: published,
      }
      upsertCall(updated)
      selectCall(updated)
      setFeedback({ kind: 'success', text: `Revisión ${published.revisionNumber} publicada.` })
      onPublished()
    } catch (error) {
      await handleMutationError(error)
    } finally {
      setBusy(false)
    }
  }

  function retryLoad() {
    setReloadNumber((current) => current + 1)
  }

  function upsertCall(call: AdmissionsCallAdmin) {
    setCalls((current) => {
      const found = current.some((entry) => entry.id === call.id)
      return found ? current.map((entry) => entry.id === call.id ? call : entry) : [...current, call]
    })
    setSelectedCallId(call.id)
  }

  async function handleMutationError(error: unknown) {
    if (isAuthorizationError(error)) {
      clearEditor()
      setCalls([])
      await onAuthorizationRejected?.(authorization.accessToken)
      return
    }
    if (error instanceof AdmissionsCallApiError && error.status === 409) {
      setFeedback({ kind: 'error', text: 'La convocatoria cambió en otra sesión. Se recargará; revisa de nuevo antes de guardar.' })
      setReloadNumber((current) => current + 1)
      return
    }
    if (error instanceof DOMException && error.name === 'AbortError') return
    setFeedback({ kind: 'error', text: 'No fue posible guardar el cambio. Revisa los datos e inténtalo de nuevo.' })
  }

  const writableDraft = canWrite && (editorMode === 'new-call' || editorMode === 'new-revision' || editorMode === 'draft')

  return (
    <section className="admissions-admin" aria-label="Administración de convocatorias">
      <div className="admissions-admin-heading">
        <div>
          <p className="admissions-eyebrow"><span aria-hidden="true" /> GESTIÓN VERSIONADA · PREGRADO</p>
          <h2>Convocatorias</h2>
          <p>Prepara calendarios en borrador y publica una revisión solo con su referencia oficial.</p>
        </div>
        {canWrite && <button className="admissions-admin-primary" type="button" onClick={startNewCall}>Nueva convocatoria</button>}
      </div>

      {requestState === 'loading' && <p className="admissions-admin-status" role="status">Cargando convocatorias…</p>}
      {requestState === 'error' && (
        <>
          <p className="admissions-admin-error" role="alert">No fue posible consultar la consola de convocatorias.</p>
          <button className="admissions-admin-secondary" type="button" onClick={retryLoad}>Reintentar</button>
        </>
      )}
      {requestState === 'ready' && calls.length === 0 && (
        <p className="admissions-admin-empty" role="status">No hay convocatorias administradas todavía.</p>
      )}

      {calls.length > 0 && (
        <div className="admissions-admin-layout">
          <nav className="admissions-admin-list" aria-label="Convocatorias administradas">
            {calls.map((call) => (
              <button key={call.id} className={call.id === selectedCallId ? 'is-selected' : ''} type="button"
                aria-pressed={call.id === selectedCallId} onClick={() => selectCall(call)}>
                <strong>{call.callKey}</strong>
                <span>{call.latestRevision.status === 'DRAFT' ? 'Borrador' : `Publicada · revisión ${call.latestRevision.revisionNumber}`}</span>
              </button>
            ))}
          </nav>
          {selectedCall && editorMode === 'published' && canWrite && (
            <button className="admissions-admin-secondary admissions-admin-new-revision" type="button"
              onClick={startNewRevision}>Crear nueva revisión</button>
          )}
        </div>
      )}

      {writableDraft && (
        <form className="admissions-admin-form" aria-label="Editar convocatoria" noValidate
          onSubmit={(event) => void handleSubmit(saveDraft)(event)}>
          <div className="admissions-admin-form-title">
            <div><span className="admissions-admin-kicker">{editorMode === 'new-call' ? 'NUEVA CONVOCATORIA' : 'BORRADOR'}</span>
              <h3>{editorMode === 'new-call' ? 'Preparar calendario público' : `Editar revisión ${selectedCall?.latestRevision.revisionNumber ?? ''}`}</h3></div>
            {selectedCall && <span className="admissions-admin-version">{selectedCall.callKey}</span>}
          </div>

          {editorMode === 'new-call' && <Field id="admissions-call-key" label="Clave estable" error={errors.callKey?.message}
            registration={register('callKey', { required: 'Escribe una clave estable.', maxLength: 64,
              pattern: { value: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, message: 'Usa minúsculas, números y guiones.' } })}
            disabled={isSubmitting || busy} />}
          <div className="admissions-admin-grid">
            <Field id="admissions-call-title" label="Título público" error={errors.title?.message}
              registration={register('title', { required: 'Escribe el título de la convocatoria.', maxLength: 160 })}
              disabled={isSubmitting || busy} />
            <Field id="admissions-call-name" label="Nombre de convocatoria" error={errors.callName?.message}
              registration={register('callName', { required: 'Escribe el nombre de la convocatoria.', maxLength: 160 })}
              disabled={isSubmitting || busy} />
            <Field id="admissions-call-updated" label="Fecha de actualización de la fuente" type="date"
              error={errors.updatedAt?.message} registration={register('updatedAt', { required: 'Indica la fecha de actualización.' })}
              disabled={isSubmitting || busy} />
            <Field id="admissions-call-checked" label="Fecha de consulta" type="date" error={errors.checkedAt?.message}
              registration={register('checkedAt', { required: 'Indica la fecha de consulta.',
                validate: (value) => value >= getValues('updatedAt') || 'La consulta no puede anteceder la actualización de la fuente.' })}
              disabled={isSubmitting || busy} />
            <Field id="admissions-source-label" label="Nombre de la fuente principal" error={errors.sourceLabel?.message}
              registration={register('sourceLabel', { required: 'Escribe el nombre de la fuente.', maxLength: 120 })}
              disabled={isSubmitting || busy} />
            <Field id="admissions-source-url" label="URL de la fuente principal" type="url" error={errors.sourceUrl?.message}
              registration={register('sourceUrl', { required: 'Escribe una URL HTTPS.', maxLength: 500,
                validate: httpsUrl || 'Usa una URL HTTPS pública.' })} disabled={isSubmitting || busy} />
            <Field id="admissions-confirmation-label" label="Nombre de la fuente de confirmación"
              error={errors.confirmationSourceLabel?.message}
              registration={register('confirmationSourceLabel', { required: 'Escribe la fuente de confirmación.', maxLength: 120 })}
              disabled={isSubmitting || busy} />
            <Field id="admissions-confirmation-url" label="URL de la fuente de confirmación" type="url"
              error={errors.confirmationSourceUrl?.message}
              registration={register('confirmationSourceUrl', { required: 'Escribe una URL HTTPS.', maxLength: 500,
                validate: httpsUrl || 'Usa una URL HTTPS pública.' })} disabled={isSubmitting || busy} />
          </div>

          <div className="admissions-admin-section-heading">
            <div><h4>Hitos de la convocatoria</h4><p>El cierre es una fecha inclusiva; ordenamos la agenda por fecha de inicio.</p></div>
            <button className="admissions-admin-secondary" type="button" disabled={isSubmitting || busy || fields.length >= 50}
              onClick={() => append(emptyMilestone())}>Añadir hito</button>
          </div>
          {fields.map((field, index) => {
            const keyPath = `milestones.${index}.key` as const
            const kindPath = `milestones.${index}.kind` as const
            const startPath = `milestones.${index}.startsOn` as const
            const endPath = `milestones.${index}.endsOn` as const
            const titlePath = `milestones.${index}.title` as const
            const descriptionPath = `milestones.${index}.description` as const
            return (
              <fieldset className="admissions-admin-milestone" key={field.id}>
                <legend>Hito {index + 1}</legend>
                <div className="admissions-admin-grid">
                  <Field id={`admissions-milestone-key-${index}`} label={`Clave del hito ${index + 1}`}
                    error={errors.milestones?.[index]?.key?.message}
                    registration={register(keyPath, { required: 'Escribe una clave estable.', maxLength: 64,
                      pattern: { value: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, message: 'Usa minúsculas, números y guiones.' },
                      validate: (key) => getValues('milestones').filter((milestone) => milestone.key.trim() === key.trim()).length === 1
                        || 'Cada hito debe tener una clave única.' })} disabled={isSubmitting || busy} />
                  <div className="admissions-admin-field">
                    <label htmlFor={`admissions-milestone-kind-${index}`}>Tipo del hito {index + 1}</label>
                    <select id={`admissions-milestone-kind-${index}`} disabled={isSubmitting || busy} {...register(kindPath)}>
                      <option value="APPLICATION">Inscripción</option>
                      <option value="SELECTION">Selección</option>
                      <option value="ENROLLMENT">Registro y matrícula</option>
                    </select>
                  </div>
                  <Field id={`admissions-milestone-start-${index}`} label={`Inicio del hito ${index + 1}`} type="date"
                    error={errors.milestones?.[index]?.startsOn?.message}
                    registration={register(startPath, { required: 'Indica el inicio del hito.' })} disabled={isSubmitting || busy} />
                  <Field id={`admissions-milestone-end-${index}`} label={`Fin del hito ${index + 1}`} type="date"
                    error={errors.milestones?.[index]?.endsOn?.message}
                    registration={register(endPath, { required: 'Indica el fin del hito.',
                      validate: (value) => value >= getValues(startPath) || 'El fin debe ser igual o posterior al inicio.' })}
                    disabled={isSubmitting || busy} />
                  <Field id={`admissions-milestone-title-${index}`} label={`Título del hito ${index + 1}`}
                    error={errors.milestones?.[index]?.title?.message}
                    registration={register(titlePath, { required: 'Escribe el título del hito.', maxLength: 160 })}
                    disabled={isSubmitting || busy} />
                  <Field id={`admissions-milestone-description-${index}`} label={`Descripción del hito ${index + 1}`}
                    error={errors.milestones?.[index]?.description?.message}
                    registration={register(descriptionPath, { required: 'Escribe una descripción.', maxLength: 500 })}
                    disabled={isSubmitting || busy} />
                </div>
                {fields.length > 1 && <button className="admissions-admin-remove" type="button" disabled={isSubmitting || busy}
                  onClick={() => remove(index)}>Quitar hito {index + 1}</button>}
              </fieldset>
            )
          })}
          {errors.milestones?.root?.message && <p role="alert" className="admissions-admin-error">{errors.milestones.root.message}</p>}

          <div className="admissions-admin-publish-row">
            <Field id="admissions-publication-reference" label="Referencia oficial de publicación"
              value={officialReference} onChange={(event) => setOfficialReference(event.currentTarget.value)}
              disabled={isSubmitting || busy} />
            <div className="admissions-admin-actions">
              <button className="admissions-admin-secondary" type="submit" disabled={isSubmitting || busy}>
                {isSubmitting ? 'Guardando…' : 'Guardar borrador'}
              </button>
              {editorMode === 'draft' && <button className="admissions-admin-primary" type="button"
                disabled={isSubmitting || busy} onClick={() => void publishDraft()}>
                {busy ? 'Publicando…' : 'Publicar revisión'}
              </button>}
            </div>
          </div>
        </form>
      )}

      {feedback && <p className={`admissions-admin-feedback is-${feedback.kind}`}
        role={feedback.kind === 'error' ? 'alert' : 'status'}>{feedback.text}</p>}
    </section>
  )
}

function Field({
  id,
  label,
  registration,
  error,
  type = 'text',
  disabled = false,
  value,
  onChange,
}: {
  id: string
  label: string
  registration?: UseFormRegisterReturn
  error?: string
  type?: string
  disabled?: boolean
  value?: string
  onChange?: ChangeEventHandler<HTMLInputElement>
}) {
  return (
    <div className="admissions-admin-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} disabled={disabled} value={value} onChange={onChange} {...registration} aria-invalid={!!error} />
      {error && <span className="admissions-admin-field-error" role="alert">{error}</span>}
    </div>
  )
}

function emptyMilestone(): EditorValues['milestones'][number] {
  return { key: '', kind: 'APPLICATION', startsOn: '', endsOn: '', title: '', description: '' }
}

function toEditorValues(callKey: string, revision: AdmissionsCallRevision): EditorValues {
  const content = revision.content
  return {
    callKey,
    title: content.title,
    callName: content.callName,
    updatedAt: content.updatedAt,
    checkedAt: content.checkedAt,
    sourceLabel: content.source.label,
    sourceUrl: content.source.url,
    confirmationSourceLabel: content.confirmationSource.label,
    confirmationSourceUrl: content.confirmationSource.url,
    milestones: content.milestones.map((milestone) => ({ ...milestone })),
  }
}

function toContent(values: EditorValues): AdmissionsCallContent {
  return {
    title: values.title.trim(),
    callName: values.callName.trim(),
    updatedAt: values.updatedAt,
    checkedAt: values.checkedAt,
    source: { label: values.sourceLabel.trim(), url: values.sourceUrl.trim() },
    confirmationSource: { label: values.confirmationSourceLabel.trim(), url: values.confirmationSourceUrl.trim() },
    milestones: values.milestones.map((milestone) => ({ ...milestone,
      key: milestone.key.trim(), title: milestone.title.trim(), description: milestone.description.trim() })),
  }
}

function httpsUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password
  } catch {
    return false
  }
}

function isAuthorizationError(error: unknown): boolean {
  return error instanceof AdmissionsCallApiError && (error.status === 401 || error.status === 403)
}
