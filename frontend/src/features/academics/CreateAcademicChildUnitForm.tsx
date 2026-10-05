import { useState } from 'react'
import type { FormEvent } from 'react'
import type {
  AcademicOperationsClient,
  AcademicOrganizationUnit,
  AcademicOrganizationUnitType,
  AcademicStructureAuthorization,
} from './academicOperationsContracts'
import { AcademicOperationsApiError } from './academicOperationsClient'
import { localDateInputValue } from '../../shared/localDateInput'

interface CreateAcademicChildUnitFormProps {
  parents: AcademicOrganizationUnit[]
  client: Pick<AcademicOperationsClient, 'createChildUnit'>
  authorization: AcademicStructureAuthorization
  onCreated(unitId: string): Promise<void>
  onRefresh(): Promise<void>
  onAuthorizationRejected?: (accessToken: string) => Promise<void>
}

interface ChildUnitDraft {
  parentUnitId: string
  code: string
  type: AcademicOrganizationUnitType | ''
  displayName: string
  displayOrder: string
  validFrom: string
  validThrough: string
  sourceReference: string
}

type Feedback = { type: 'success' | 'error' | 'warning'; text: string }

const unitTypeOptions: Array<{ value: AcademicOrganizationUnitType; label: string }> = [
  { value: 'FACULTY', label: 'Facultad' },
  { value: 'SCHOOL', label: 'Escuela' },
  { value: 'ACADEMIC_UNIT', label: 'Unidad académica' },
]

function emptyDraft(): ChildUnitDraft {
  return {
    parentUnitId: '',
    code: '',
    type: '',
    displayName: '',
    displayOrder: '0',
    validFrom: localDateInputValue(),
    validThrough: '',
    sourceReference: '',
  }
}

export function CreateAcademicChildUnitForm({
  parents,
  client,
  authorization,
  onCreated,
  onRefresh,
  onAuthorizationRejected,
}: CreateAcademicChildUnitFormProps) {
  const [draft, setDraft] = useState<ChildUnitDraft>(emptyDraft)
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const today = localDateInputValue()
  const availableParents = parents
    .filter((parent) => parent.status === 'ACTIVE' && (parent.validThrough === null || parent.validThrough >= today))
    .sort((first, second) => first.displayName.localeCompare(second.displayName)
      || first.code.localeCompare(second.code))
  const selectedParent = availableParents.find((parent) => parent.id === draft.parentUnitId)

  function chooseParent(parentUnitId: string) {
    const parent = availableParents.find((entry) => entry.id === parentUnitId)
    const earliestValidDate = parent && parent.validFrom > today ? parent.validFrom : today
    setDraft((current) => ({
      ...current,
      parentUnitId,
      validFrom: earliestValidDate,
      validThrough: parent?.validThrough ?? '',
    }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || !authorization.canWrite) return
    if (!selectedParent) {
      setFeedback({ type: 'error', text: 'Selecciona una unidad superior activa antes de continuar.' })
      return
    }
    if (!draft.type) {
      setFeedback({ type: 'error', text: 'Selecciona el tipo de unidad antes de continuar.' })
      return
    }
    const validThrough = draft.validThrough || null
    if (draft.validFrom < selectedParent.validFrom
      || (selectedParent.validThrough !== null
        && (validThrough === null || validThrough > selectedParent.validThrough))) {
      setFeedback({ type: 'error', text: 'La vigencia de la unidad hija debe estar dentro de la vigencia de la unidad superior.' })
      return
    }

    const command = {
      code: draft.code,
      type: draft.type,
      displayName: draft.displayName,
      displayOrder: Number(draft.displayOrder),
      validFrom: draft.validFrom,
      validThrough,
      sourceReference: draft.sourceReference,
    }

    setPending(true)
    setFeedback(null)
    let unitId: string
    try {
      unitId = await client.createChildUnit(selectedParent.id, command, authorization.accessToken)
    } catch (error) {
      if (error instanceof AcademicOperationsApiError && (error.status === 401 || error.status === 403)) {
        setFeedback({
          type: 'error',
          text: error.status === 401
            ? 'El servidor rechazó la sesión. Estoy comprobando la identidad; inicia sesión de nuevo si hace falta.'
            : 'El servidor negó el permiso para crear la unidad hija. Estoy volviendo a comprobar los permisos.',
        })
        try {
          await onAuthorizationRejected?.(authorization.accessToken)
        } catch {
          setFeedback({
            type: 'error',
            text: 'El servidor rechazó la creación y no pude revalidar los permisos. Vuelve a iniciar sesión antes de continuar.',
          })
        }
      } else if (error instanceof AcademicOperationsApiError && error.status === 409) {
        try {
          await onRefresh()
          setFeedback({
            type: 'error',
            text: 'El servidor encontró un conflicto y actualicé la estructura. Revisa el código y la vigencia de la unidad superior antes de otro intento.',
          })
        } catch {
          setFeedback({
            type: 'error',
            text: 'El servidor encontró un conflicto y no pude actualizar la estructura. Recarga antes de continuar.',
          })
        }
      } else if (error instanceof AcademicOperationsApiError && error.status === 400) {
        setFeedback({ type: 'error', text: 'El servidor rechazó los datos. Revisa código, tipo, vigencia y referencia institucional.' })
      } else {
        setFeedback({ type: 'error', text: 'No fue posible crear la unidad hija. Verifica la conexión antes de continuar.' })
      }
      setPending(false)
      return
    }

    setDraft(emptyDraft())
    setFeedback({ type: 'success', text: 'Unidad hija registrada y jerarquía actualizada.' })
    try {
      await onCreated(unitId)
    } catch {
      setFeedback({
        type: 'warning',
        text: 'La unidad hija quedó registrada, pero no pude actualizar la vista. Recarga antes de continuar.',
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="academic-create-entry" aria-labelledby="academic-create-child-unit-title">
      <div className="academic-create-entry-heading">
        <div>
          <p className="academic-panel-kicker">ALTA JERÁRQUICA AUDITADA</p>
          <h3 id="academic-create-child-unit-title">Crear unidad hija</h3>
        </div>
        <span aria-hidden="true">↳</span>
      </div>
      <p className="academic-create-entry-intro">
        Crea la unidad y su vínculo con una unidad superior en una sola operación. La vigencia y el orden quedan auditados.
      </p>
      <form className="academic-create-entry-form" onSubmit={(event) => void submit(event)}>
        <label>
          Unidad superior
          <select
            required
            value={draft.parentUnitId}
            disabled={pending || availableParents.length === 0}
            onChange={(event) => chooseParent(event.currentTarget.value)}
          >
            <option value="">Selecciona unidad superior</option>
            {availableParents.map((parent) => (
              <option key={parent.id} value={parent.id}>{parent.displayName} · {parent.code}</option>
            ))}
          </select>
        </label>
        <label>
          Código institucional
          <input
            autoComplete="off"
            maxLength={64}
            pattern="[A-Za-z0-9][A-Za-z0-9._-]*"
            required
            value={draft.code}
            disabled={pending}
            onChange={(event) => {
              const code = event.currentTarget.value
              setDraft((current) => ({ ...current, code }))
            }}
          />
        </label>
        <label>
          Tipo de unidad
          <select
            required
            value={draft.type}
            disabled={pending}
            onChange={(event) => {
              const type = event.currentTarget.value as AcademicOrganizationUnitType | ''
              setDraft((current) => ({ ...current, type }))
            }}
          >
            <option value="">Selecciona tipo de unidad</option>
            {unitTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          Nombre de la unidad
          <input
            maxLength={240}
            required
            value={draft.displayName}
            disabled={pending}
            onChange={(event) => {
              const displayName = event.currentTarget.value
              setDraft((current) => ({ ...current, displayName }))
            }}
          />
        </label>
        <label>
          Orden dentro de la unidad superior
          <input
            type="number"
            min={0}
            max={2_147_483_647}
            step={1}
            required
            value={draft.displayOrder}
            disabled={pending}
            onChange={(event) => {
              const displayOrder = event.currentTarget.value
              setDraft((current) => ({ ...current, displayOrder }))
            }}
          />
        </label>
        <label>
          Vigente desde
          <input
            type="date"
            min={selectedParent?.validFrom}
            max={selectedParent?.validThrough ?? undefined}
            required
            value={draft.validFrom}
            disabled={pending}
            onChange={(event) => {
              const validFrom = event.currentTarget.value
              setDraft((current) => ({ ...current, validFrom }))
            }}
          />
        </label>
        <label>
          Vigente hasta (opcional)
          <input
            type="date"
            min={draft.validFrom}
            max={selectedParent?.validThrough ?? undefined}
            required={selectedParent?.validThrough !== null && selectedParent !== undefined}
            value={draft.validThrough}
            disabled={pending}
            onChange={(event) => {
              const validThrough = event.currentTarget.value
              setDraft((current) => ({ ...current, validThrough }))
            }}
          />
        </label>
        <label className="academic-create-entry-reference">
          Referencia institucional
          <input
            autoComplete="off"
            maxLength={240}
            required
            value={draft.sourceReference}
            disabled={pending}
            onChange={(event) => {
              const sourceReference = event.currentTarget.value
              setDraft((current) => ({ ...current, sourceReference }))
            }}
          />
        </label>
        <div className="academic-create-entry-actions">
          <button type="submit" disabled={pending || !authorization.canWrite || availableParents.length === 0}>
            {pending ? 'Creando…' : 'Crear unidad hija'}
          </button>
          <p>{availableParents.length === 0
            ? 'Se necesita una unidad superior activa para crear una unidad hija.'
            : 'La unidad y su relación se guardan juntas y requieren permiso institucional de escritura.'}</p>
        </div>
      </form>
      {feedback && (
        <p className={`academic-create-entry-feedback is-${feedback.type}`}
          role={feedback.type === 'error' ? 'alert' : 'status'}>
          {feedback.text}
        </p>
      )}
    </section>
  )
}
