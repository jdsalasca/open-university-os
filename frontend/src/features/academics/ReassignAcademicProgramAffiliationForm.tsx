import { useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import type {
  AcademicOperationsClient,
  AcademicOrganizationUnit,
  AcademicProgramAffiliation,
  AcademicProgramAffiliationReassignmentCommand,
  AcademicSite,
  AcademicStructureAuthorization,
} from './academicOperationsContracts'
import type { AcademicProgram } from './contracts'
import { AcademicOperationsApiError } from './academicOperationsClient'
import { containsAsciiControlCharacters } from '../../shared/inputValidation'
import './ReassignAcademicProgramAffiliationForm.scss'

interface ReassignAcademicProgramAffiliationFormProps {
  programs: AcademicProgram[]
  affiliations: AcademicProgramAffiliation[]
  units: AcademicOrganizationUnit[]
  sites: AcademicSite[]
  client: Pick<AcademicOperationsClient, 'reassignProgramAffiliation'>
  authorization: AcademicStructureAuthorization
  onReassigned(): Promise<void>
  onAuthorizationRejected?: (accessToken: string) => Promise<void>
}

interface ReassignmentDraft {
  affiliationId: string
  organizationUnitId: string
  siteId: string
  effectiveFrom: string
  displayOrder: string
  sourceReference: string
}

interface ReassignmentReview {
  programId: string
  affiliationId: string
  sourceValidFrom: string
  effectiveFrom: string
  sourceValidThrough: string | null
  organizationUnitId: string
  siteId: string
  displayOrder: number
  sourceReference: string
}

type Feedback = { type: 'success' | 'warning' | 'error'; text: string }

const EMPTY_DRAFT: ReassignmentDraft = {
  affiliationId: '',
  organizationUnitId: '',
  siteId: '',
  effectiveFrom: '',
  displayOrder: '',
  sourceReference: '',
}

function previousCalendarDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year!, month! - 1, day! - 1)).toISOString().slice(0, 10)
}

function coversInterval(entry: { validFrom: string; validThrough: string | null }, from: string, through: string | null) {
  return entry.validFrom <= from
    && (entry.validThrough === null || (through !== null && entry.validThrough >= through))
}

function compareNames(first: { displayName: string; code: string }, second: { displayName: string; code: string }) {
  return first.displayName.localeCompare(second.displayName) || first.code.localeCompare(second.code)
}

export function ReassignAcademicProgramAffiliationForm({
  programs,
  affiliations,
  units,
  sites,
  client,
  authorization,
  onReassigned,
  onAuthorizationRejected,
}: ReassignAcademicProgramAffiliationFormProps) {
  const [review, setReview] = useState<ReassignmentReview | null>(null)
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const pendingRef = useRef(false)
  const { control, register, handleSubmit, setError, clearErrors, reset, formState: { errors } } =
    useForm<ReassignmentDraft>({ defaultValues: EMPTY_DRAFT })
  const values = useWatch({ control })
  const programsById = new Map(programs.map((program) => [program.id, program]))
  const unitsById = new Map(units.map((unit) => [unit.id, unit]))
  const sitesById = new Map(sites.map((site) => [site.id, site]))
  const source = affiliations.find(({ id }) => id === values.affiliationId)
  const sourceProgram = source ? programsById.get(source.programId) : undefined
  const sourceUnit = source ? unitsById.get(source.organizationUnitId) : undefined
  const sourceSite = source ? sitesById.get(source.siteId) : undefined
  const sortedAffiliations = [...affiliations].sort((first, second) => {
    const firstProgram = programsById.get(first.programId)?.programCode ?? first.programId
    const secondProgram = programsById.get(second.programId)?.programCode ?? second.programId
    return firstProgram.localeCompare(secondProgram) || first.validFrom.localeCompare(second.validFrom)
  })
  const activeUnits = units.filter((unit) => unit.status === 'ACTIVE').sort(compareNames)
  const activeSites = sites.filter((site) => site.status === 'ACTIVE').sort(compareNames)

  if (!authorization.canRead || !authorization.canWrite) return null

  function changeDraft() {
    if (review) setReview(null)
    if (feedback) setFeedback(null)
    clearErrors()
  }

  function prepareReview(draft: ReassignmentDraft) {
    const selected = affiliations.find(({ id }) => id === draft.affiliationId)
    const unit = unitsById.get(draft.organizationUnitId)
    const site = sitesById.get(draft.siteId)
    if (!selected || !unit || !site) {
      setError('root', { message: 'Selecciona la adscripción y los dos destinos institucionales.' })
      return
    }
    if (draft.effectiveFrom <= selected.validFrom
      || (selected.validThrough !== null && draft.effectiveFrom > selected.validThrough)) {
      setError('effectiveFrom', { message: 'La fecha debe ser posterior al inicio y estar dentro de la vigencia actual.' })
      return
    }
    if (unit.id === selected.organizationUnitId && site.id === selected.siteId) {
      setError('root', { message: 'Cambia la unidad o la sede; el orden se administra por separado.' })
      return
    }
    if (!coversInterval(unit, draft.effectiveFrom, selected.validThrough)
      || !coversInterval(site, draft.effectiveFrom, selected.validThrough)) {
      setError('root', { message: 'Ambos destinos deben estar activos y cubrir toda la vigencia que recibirá la adscripción.' })
      return
    }
    const displayOrder = Number(draft.displayOrder.trim())
    if (!/^\d+$/.test(draft.displayOrder.trim()) || !Number.isSafeInteger(displayOrder) || displayOrder > 100_000) {
      setError('displayOrder', { message: 'El orden debe ser un entero entre 0 y 100000.' })
      return
    }
    const sourceReference = draft.sourceReference.trim()
    if (sourceReference.length === 0 || sourceReference.length > 240
      || containsAsciiControlCharacters(sourceReference)) {
      setError('sourceReference', { message: 'Escribe una referencia institucional válida de hasta 240 caracteres.' })
      return
    }
    setFeedback(null)
    setReview({
      programId: selected.programId,
      affiliationId: selected.id,
      sourceValidFrom: selected.validFrom,
      effectiveFrom: draft.effectiveFrom,
      sourceValidThrough: selected.validThrough,
      organizationUnitId: unit.id,
      siteId: site.id,
      displayOrder,
      sourceReference,
    })
  }

  async function refreshAfterUncertainResult() {
    try {
      await onReassigned()
      return true
    } catch {
      return false
    }
  }

  async function confirmReassignment() {
    if (!review || pendingRef.current || !authorization.canWrite) return
    pendingRef.current = true
    setPending(true)
    setFeedback(null)
    const command: AcademicProgramAffiliationReassignmentCommand = {
      expectedValidFrom: review.sourceValidFrom,
      expectedValidThrough: review.sourceValidThrough,
      effectiveFrom: review.effectiveFrom,
      organizationUnitId: review.organizationUnitId,
      siteId: review.siteId,
      displayOrder: review.displayOrder,
      sourceReference: review.sourceReference,
    }
    try {
      await client.reassignProgramAffiliation(
        review.programId, review.affiliationId, command, authorization.accessToken,
      )
      setReview(null)
      reset(EMPTY_DRAFT)
      if (await refreshAfterUncertainResult()) {
        setFeedback({ type: 'success', text: 'Adscripción reasignada y estructura actualizada.' })
      } else {
        setFeedback({ type: 'warning', text: 'La reasignación quedó registrada, pero no pude actualizar la vista. Recarga antes de continuar.' })
      }
    } catch (error) {
      setReview(null)
      if (error instanceof AcademicOperationsApiError && (error.status === 401 || error.status === 403)) {
        setFeedback({
          type: 'error',
          text: error.status === 401
            ? 'El servidor rechazó la sesión. Estoy comprobando la identidad; inicia sesión de nuevo si hace falta.'
            : 'El servidor negó el permiso para reasignar programas. Estoy volviendo a comprobar los permisos.',
        })
        try {
          await onAuthorizationRejected?.(authorization.accessToken)
        } catch {
          setFeedback({ type: 'error', text: 'El servidor rechazó la operación y no pude revalidar los permisos. Vuelve a iniciar sesión antes de continuar.' })
        }
      } else if (error instanceof AcademicOperationsApiError && error.status === 400) {
        setFeedback({ type: 'error', text: 'El servidor rechazó los datos. Revisa la vigencia, los destinos, el orden y la referencia institucional.' })
      } else if (error instanceof AcademicOperationsApiError && error.status === 409) {
        setFeedback(await refreshAfterUncertainResult()
          ? { type: 'error', text: 'El servidor encontró un conflicto y actualicé la estructura. Revisa la vigencia y los destinos antes de otro intento.' }
          : { type: 'error', text: 'El servidor encontró un conflicto y no pude actualizar la estructura. Recarga antes de continuar.' })
      } else if (error instanceof AcademicOperationsApiError && error.status === 404) {
        setFeedback(await refreshAfterUncertainResult()
          ? { type: 'error', text: 'La adscripción o un destino cambió. Actualicé la estructura; vuelve a revisar los datos.' }
          : { type: 'error', text: 'No encontré la adscripción o un destino y no pude actualizar la vista. Recarga antes de continuar.' })
      } else {
        setFeedback(await refreshAfterUncertainResult()
          ? { type: 'warning', text: 'No pude confirmar la respuesta del servidor. Actualicé la estructura; verifica el resultado antes de enviar otro cambio.' }
          : { type: 'warning', text: 'No pude confirmar la respuesta ni actualizar la estructura. Recarga y verifica el resultado antes de enviar otro cambio.' })
      }
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  const registeredDraft = (name: keyof ReassignmentDraft) => ({
    ...register(name, { onChange: changeDraft }),
    disabled: pending || review !== null,
  })

  return (
    <section className="academic-reassign" aria-labelledby="academic-reassign-title">
      <div className="academic-reassign-heading">
        <div>
          <p className="academic-panel-kicker">CAMBIO DE ADSCRIPCIÓN</p>
          <h3 id="academic-reassign-title">Reasignar programa entre unidades y sedes</h3>
        </div>
        <span className="academic-operation-icon" aria-hidden="true">⇢</span>
      </div>
      <p className="academic-reassign-intro">
        El sistema conserva la historia del programa: cierra su adscripción actual el día anterior y registra la nueva desde la fecha efectiva.
      </p>
      <form className="academic-reassign-form" onSubmit={(event) => void handleSubmit(prepareReview)(event)}>
        <label>
          Adscripción de origen
          <select {...registeredDraft('affiliationId')} required>
            <option value="">Selecciona programa y vigencia</option>
            {sortedAffiliations.map((entry) => {
              const program = programsById.get(entry.programId)
              const unit = unitsById.get(entry.organizationUnitId)
              const site = sitesById.get(entry.siteId)
              return <option key={entry.id} value={entry.id}>
                {program?.programName ?? `Programa ${entry.programId}`} · {unit?.displayName ?? 'Unidad no disponible'} · {site?.displayName ?? 'Sede no disponible'} · desde {entry.validFrom}
              </option>
            })}
          </select>
        </label>
        <label>
          Nueva unidad responsable
          <select {...registeredDraft('organizationUnitId')} required>
            <option value="">Selecciona una unidad activa</option>
            {activeUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.displayName} · {unit.code}</option>)}
          </select>
        </label>
        <label>
          Nueva sede de desarrollo
          <select {...registeredDraft('siteId')} required>
            <option value="">Selecciona una sede activa</option>
            {activeSites.map((site) => <option key={site.id} value={site.id}>{site.displayName} · {site.code}</option>)}
          </select>
        </label>
        <label>
          Fecha efectiva de reasignación
          <input type="date" required {...registeredDraft('effectiveFrom')} />
          {errors.effectiveFrom?.message && <small className="academic-reassign-field-error">{errors.effectiveFrom.message}</small>}
        </label>
        <label>
          Orden del programa en la unidad
          <input type="number" min={0} max={100_000} step={1} required {...registeredDraft('displayOrder')} />
          {errors.displayOrder?.message && <small className="academic-reassign-field-error">{errors.displayOrder.message}</small>}
        </label>
        <label className="academic-reassign-reference">
          Referencia institucional
          <input type="text" autoComplete="off" maxLength={240} required {...registeredDraft('sourceReference')} />
          {errors.sourceReference?.message && <small className="academic-reassign-field-error">{errors.sourceReference.message}</small>}
        </label>
        <div className="academic-reassign-actions">
          <button type="submit" disabled={pending || review !== null || sortedAffiliations.length === 0
            || activeUnits.length === 0 || activeSites.length === 0}>
            Revisar reasignación
          </button>
          <p>La fecha y el acto de soporte quedan registrados en una sola transacción auditada.</p>
        </div>
        {errors.root?.message && <p className="academic-reassign-feedback is-error" role="alert">{errors.root.message}</p>}
      </form>

      {review && (
        <div className="academic-reassign-confirmation" role="group" aria-label="Confirmar reasignación">
          <div>
            <p className="academic-panel-kicker">VISTA PREVIA TEMPORAL</p>
            <h4>{sourceProgram?.programName ?? 'Programa seleccionado'}</h4>
            <p>{sourceUnit?.displayName ?? 'Unidad actual'} · {sourceSite?.displayName ?? 'Sede actual'} finalizará el <time dateTime={previousCalendarDay(review.effectiveFrom)}>{previousCalendarDay(review.effectiveFrom)}</time>.</p>
            <p>La nueva adscripción iniciará el <time dateTime={review.effectiveFrom}>{review.effectiveFrom}</time> en {unitsById.get(review.organizationUnitId)?.displayName} · {sitesById.get(review.siteId)?.displayName}.
              {' '}Final previsto: {review.sourceValidThrough ?? 'sin fecha de cierre'}.</p>
            <small>Referencia: {review.sourceReference}</small>
          </div>
          <div className="academic-reassign-confirmation-actions">
            <button type="button" disabled={pending} onClick={() => void confirmReassignment()}>
              {pending ? 'Guardando…' : 'Confirmar reasignación'}
            </button>
            <button type="button" className="secondary" disabled={pending} onClick={() => setReview(null)}>
              Editar reasignación
            </button>
          </div>
        </div>
      )}

      {feedback && <p className={`academic-reassign-feedback is-${feedback.type}`}
        role={feedback.type === 'error' ? 'alert' : 'status'}>{feedback.text}</p>}
    </section>
  )
}
