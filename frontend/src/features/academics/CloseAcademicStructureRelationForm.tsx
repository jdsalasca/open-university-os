import { useState } from 'react'
import type { FormEvent } from 'react'
import type {
  AcademicOperationsClient,
  AcademicOrganizationRelation,
  AcademicOrganizationUnit,
  AcademicProgramAffiliation,
  AcademicSite,
  AcademicSiteRelation,
  AcademicStructureAuthorization,
  AcademicStructureRelationCloseCommand,
} from './academicOperationsContracts'
import type { AcademicProgram } from './contracts'
import { AcademicOperationsApiError } from './academicOperationsClient'
import { containsAsciiControlCharacters } from '../../shared/inputValidation'
import { localDateInputValue } from '../../shared/localDateInput'

type CommonProps = {
  authorization: AcademicStructureAuthorization
  onClosed(): Promise<void>
  onAuthorizationRejected?: (accessToken: string) => Promise<void>
}

type CloseAcademicStructureRelationFormProps = CommonProps & (
  | {
    kind: 'unit'
    entries: AcademicOrganizationUnit[]
    relations: AcademicOrganizationRelation[]
    client: Pick<AcademicOperationsClient, 'closeOrganizationRelation'>
  }
  | {
    kind: 'site'
    entries: AcademicSite[]
    relations: AcademicSiteRelation[]
    client: Pick<AcademicOperationsClient, 'closeSiteRelation'>
  }
  | {
    kind: 'affiliation'
    programs: AcademicProgram[]
    units: AcademicOrganizationUnit[]
    sites: AcademicSite[]
    relations: AcademicProgramAffiliation[]
    client: Pick<AcademicOperationsClient, 'closeProgramAffiliation'>
  }
)

type RelationDraft = {
  relationKey: string
  effectiveThrough: string
  sourceReference: string
}

type RelationOption = {
  parentId: string
  childId: string
  validFrom: string
  validThrough: string | null
  displayLabel: string
  endpointsExist: boolean
}

type CloseConfirmation = {
  parentId: string
  childId: string
  displayLabel: string
  command: AcademicStructureRelationCloseCommand
}

type Feedback = { type: 'success' | 'warning' | 'error'; text: string }

function relationKey(relation: RelationOption): string {
  return `${relation.parentId}|${relation.childId}|${relation.validFrom}`
}

function previousCalendarDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year!, month! - 1, day! - 1)).toISOString().slice(0, 10)
}

export function CloseAcademicStructureRelationForm(props: CloseAcademicStructureRelationFormProps) {
  const [draft, setDraft] = useState<RelationDraft>({ relationKey: '', effectiveThrough: '', sourceReference: '' })
  const [confirmation, setConfirmation] = useState<CloseConfirmation | null>(null)
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const today = localDateInputValue()
  let relationOptions: RelationOption[]
  if (props.kind === 'unit') {
    const entriesById = new Map(props.entries.map((entry) => [entry.id, entry]))
    relationOptions = props.relations.map((relation) => {
      const parent = entriesById.get(relation.parentUnitId)
      const child = entriesById.get(relation.childUnitId)
      return {
        parentId: relation.parentUnitId,
        childId: relation.childUnitId,
        validFrom: relation.validFrom,
        validThrough: relation.validThrough,
        displayLabel: `${parent?.displayName ?? 'Unidad no disponible'} → ${child?.displayName ?? 'Unidad no disponible'}`,
        endpointsExist: parent !== undefined && child !== undefined,
      }
    })
  } else if (props.kind === 'site') {
    const entriesById = new Map(props.entries.map((entry) => [entry.id, entry]))
    relationOptions = props.relations.map((relation) => {
      const parent = entriesById.get(relation.parentSiteId)
      const child = entriesById.get(relation.childSiteId)
      return {
        parentId: relation.parentSiteId,
        childId: relation.childSiteId,
        validFrom: relation.validFrom,
        validThrough: relation.validThrough,
        displayLabel: `${parent?.displayName ?? 'Sede no disponible'} → ${child?.displayName ?? 'Sede no disponible'}`,
        endpointsExist: parent !== undefined && child !== undefined,
      }
    })
  } else {
    const programsById = new Map(props.programs.map((program) => [program.id, program]))
    const unitsById = new Map(props.units.map((unit) => [unit.id, unit]))
    const sitesById = new Map(props.sites.map((site) => [site.id, site]))
    relationOptions = props.relations.map((relation) => {
      const program = programsById.get(relation.programId)
      const unit = unitsById.get(relation.organizationUnitId)
      const site = sitesById.get(relation.siteId)
      return {
        parentId: relation.programId,
        childId: relation.id,
        validFrom: relation.validFrom,
        validThrough: relation.validThrough,
        displayLabel: `${program?.programName ?? 'Programa no disponible'} → ${unit?.displayName ?? 'Unidad no disponible'} · ${site?.displayName ?? 'Sede no disponible'}`,
        endpointsExist: program !== undefined && unit !== undefined && site !== undefined,
      }
    })
  }
  const closeableRelations = relationOptions
    .filter((relation) => {
      const notExpired = relation.validThrough === null || relation.validThrough >= today
      const canShorten = relation.validThrough === null || relation.validThrough > relation.validFrom
      return relation.endpointsExist && notExpired && canShorten && relation.parentId !== relation.childId
    })
    .sort((first, second) => first.validFrom.localeCompare(second.validFrom)
      || relationKey(first).localeCompare(relationKey(second)))
  const selectedRelation = closeableRelations.find((relation) => relationKey(relation) === draft.relationKey)
  const relationLabel = props.kind === 'unit'
    ? 'Relación de unidades'
    : props.kind === 'site' ? 'Relación de sedes' : 'Adscripción de programa'
  const sectionTitle = props.kind === 'unit'
    ? 'Cerrar una relación de unidades'
    : props.kind === 'site' ? 'Cerrar una relación de sedes' : 'Cerrar una adscripción de programa'

  if (!props.authorization.canRead || !props.authorization.canWrite) return null

  function changeDraft(update: Partial<RelationDraft>) {
    setDraft((current) => ({ ...current, ...update }))
    setConfirmation(null)
    setFeedback(null)
  }

  function reviewClosure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const relation = closeableRelations.find((candidate) => relationKey(candidate) === draft.relationKey)
    const sourceReference = draft.sourceReference.trim()
    if (!relation || !draft.effectiveThrough || draft.effectiveThrough < relation.validFrom
      || (relation.validThrough !== null && draft.effectiveThrough >= relation.validThrough)) {
      setFeedback({ type: 'error', text: 'Selecciona una relación y un último día que acorte su vigencia sin preceder su inicio.' })
      return
    }
    if (sourceReference.length === 0 || sourceReference.length > 240 || containsAsciiControlCharacters(sourceReference)) {
      setFeedback({ type: 'error', text: 'La referencia institucional es obligatoria y debe tener hasta 240 caracteres válidos.' })
      return
    }
    setFeedback(null)
    setConfirmation({
      parentId: relation.parentId,
      childId: relation.childId,
      displayLabel: relation.displayLabel,
      command: {
        validFrom: relation.validFrom,
        effectiveThrough: draft.effectiveThrough,
        sourceReference,
      },
    })
  }

  async function confirmClosure() {
    if (pending || !confirmation || !props.authorization.canWrite) return
    setPending(true)
    setFeedback(null)
    try {
      if (props.kind === 'unit') {
        await props.client.closeOrganizationRelation(
          confirmation.parentId, confirmation.childId, confirmation.command, props.authorization.accessToken,
        )
      } else if (props.kind === 'site') {
        await props.client.closeSiteRelation(
          confirmation.parentId, confirmation.childId, confirmation.command, props.authorization.accessToken,
        )
      } else {
        await props.client.closeProgramAffiliation(
          confirmation.parentId, confirmation.childId, confirmation.command, props.authorization.accessToken,
        )
      }
    } catch (error) {
      setConfirmation(null)
      if (error instanceof AcademicOperationsApiError && (error.status === 401 || error.status === 403)) {
        setFeedback({
          type: 'error',
          text: error.status === 401
            ? 'El servidor rechazó la sesión. Estoy comprobando la identidad; inicia sesión de nuevo si hace falta.'
            : 'El servidor negó el permiso para cerrar la relación. Estoy volviendo a comprobar los permisos.',
        })
        try {
          await props.onAuthorizationRejected?.(props.authorization.accessToken)
        } catch {
          setFeedback({
            type: 'error',
            text: 'El servidor rechazó la operación y no pude revalidar los permisos. Vuelve a iniciar sesión antes de continuar.',
          })
        }
      } else if (error instanceof AcademicOperationsApiError && error.status === 409) {
        try {
          await props.onClosed()
          setFeedback({
            type: 'error',
            text: 'El servidor encontró un conflicto y actualicé la estructura. Revisa la relación y su vigencia antes de otro intento.',
          })
        } catch {
          setFeedback({
            type: 'error',
            text: 'El servidor encontró un conflicto y no pude actualizar la estructura. Recarga antes de continuar.',
          })
        }
      } else if (error instanceof AcademicOperationsApiError && error.status === 400) {
        setFeedback({ type: 'error', text: 'El servidor rechazó los datos. Revisa la vigencia y la referencia institucional.' })
      } else {
        setFeedback({ type: 'error', text: 'No fue posible cerrar la relación. Verifica la conexión antes de continuar.' })
      }
      setPending(false)
      return
    }

    setConfirmation(null)
    setDraft({ relationKey: '', effectiveThrough: '', sourceReference: '' })
    setFeedback({ type: 'success', text: 'Relación cerrada con referencia y auditoría.' })
    try {
      await props.onClosed()
    } catch {
      setFeedback({
        type: 'warning',
        text: 'La relación quedó cerrada, pero no pude actualizar la vista. Recarga para confirmar el estado antes de continuar.',
      })
    } finally {
      setPending(false)
    }
  }

  const maximumDate = selectedRelation?.validThrough ? previousCalendarDay(selectedRelation.validThrough) : undefined
  const titleId = `academic-close-${props.kind}-relation-title`

  return (
    <section className="academic-create-entry" aria-labelledby={titleId}>
      <div className="academic-create-entry-heading">
        <div>
          <p className="academic-panel-kicker">VIGENCIA Y AUDITORÍA</p>
          <h3 id={titleId}>{sectionTitle}</h3>
        </div>
        <span className="academic-operation-icon" aria-hidden="true">⌁</span>
      </div>
      <p className="academic-create-entry-intro">
        Acorta el vínculo entre dos registros sin eliminar ninguno. El último día indicado es inclusivo y la referencia queda auditada.
      </p>
      {closeableRelations.length === 0 ? (
        <p className="academic-empty-state">No hay relaciones actuales o futuras que puedan acortarse.</p>
      ) : (
        <form className="academic-create-entry-form" onSubmit={(event) => void reviewClosure(event)}>
          <label>
            {relationLabel}
            <select
              required
              value={draft.relationKey}
              disabled={pending || confirmation !== null}
              onChange={(event) => changeDraft({ relationKey: event.currentTarget.value, effectiveThrough: '' })}
            >
              <option value="">Selecciona una relación fechada</option>
              {closeableRelations.map((relation) => {
                return (
                  <option key={relationKey(relation)} value={relationKey(relation)}>
                    {relation.displayLabel} · Desde {relation.validFrom}
                    {relation.validThrough ? ` · Hasta ${relation.validThrough}` : ' · Sin cierre'}
                  </option>
                )
              })}
            </select>
          </label>
          <label>
            Último día de vigencia (inclusive)
            <input
              type="date"
              required
              min={selectedRelation?.validFrom}
              max={maximumDate}
              value={draft.effectiveThrough}
              disabled={pending || confirmation !== null || !selectedRelation}
              onChange={(event) => changeDraft({ effectiveThrough: event.currentTarget.value })}
            />
          </label>
          {selectedRelation && (
            <p className="academic-relation-close-current">
              Relación vigente desde {selectedRelation.validFrom} hasta {selectedRelation.validThrough ?? 'sin fecha de cierre'}.
              {selectedRelation.validThrough && ' Solo se permite acortar esta vigencia.'}
            </p>
          )}
          <label className="academic-create-entry-reference">
            Referencia institucional
            <input
              autoComplete="off"
              maxLength={240}
              required
              value={draft.sourceReference}
              disabled={pending || confirmation !== null}
              onChange={(event) => changeDraft({ sourceReference: event.currentTarget.value })}
            />
          </label>
          {!confirmation && (
            <div className="academic-create-entry-actions">
              <button type="submit" disabled={pending || !props.authorization.canWrite || closeableRelations.length === 0}>
                Revisar cierre
              </button>
              <p>El cierre termina este vínculo desde la fecha indicada; no borra los registros ni sus demás relaciones.</p>
            </div>
          )}
        </form>
      )}
      {confirmation && (
        <section className="academic-relation-close-confirmation" role="region" aria-label="Confirmar cierre de relación">
          <h4>Confirma el cierre</h4>
          <p>
            {confirmation.displayLabel} quedará vigente hasta{' '}
            <time dateTime={confirmation.command.effectiveThrough}>{confirmation.command.effectiveThrough}</time>, inclusive.
            {' '}La operación conserva ambos registros y registra la referencia “{confirmation.command.sourceReference}”.
          </p>
          <div>
            <button type="button" disabled={pending} onClick={() => void confirmClosure()}>
              {pending ? 'Cerrando…' : 'Confirmar cierre de relación'}
            </button>
            <button type="button" className="secondary" disabled={pending} onClick={() => setConfirmation(null)}>
              Cancelar
            </button>
          </div>
        </section>
      )}
      {feedback && (
        <p className={`academic-create-entry-feedback is-${feedback.type}`}
          role={feedback.type === 'error' ? 'alert' : 'status'}>
          {feedback.text}
        </p>
      )}
    </section>
  )
}
