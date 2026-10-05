import { useState } from 'react'
import type { FormEvent } from 'react'
import type {
  AcademicOperationsClient,
  AcademicStructureAuthorization,
  AcademicStructureRelationCreateCommand,
} from './academicOperationsContracts'
import { AcademicOperationsApiError } from './academicOperationsClient'
import { localDateInputValue } from '../../shared/localDateInput'

interface RelationFormSharedProps {
  entries: Array<{ id: string; code: string; displayName: string }>
  authorization: AcademicStructureAuthorization
  onCreated(): Promise<void>
  onAuthorizationRejected?: (accessToken: string) => Promise<void>
}

interface OrganizationRelationFormProps extends RelationFormSharedProps {
  kind: 'unit'
  client: Pick<AcademicOperationsClient, 'relateOrganizationUnits'>
}

interface SiteRelationFormProps extends RelationFormSharedProps {
  kind: 'site'
  client: Pick<AcademicOperationsClient, 'relateSites'>
}

type RelationFormProps = OrganizationRelationFormProps | SiteRelationFormProps

interface RelationDraft {
  parentId: string
  childId: string
  displayOrder: string
  validFrom: string
  validThrough: string
  sourceReference: string
}

type Feedback = { type: 'success' | 'error' | 'warning'; text: string }

function emptyRelationDraft(): RelationDraft {
  return {
    parentId: '',
    childId: '',
    displayOrder: '0',
    validFrom: localDateInputValue(),
    validThrough: '',
    sourceReference: '',
  }
}

export function CreateAcademicStructureRelationForm(props: RelationFormProps) {
  const { kind, client, entries, authorization, onCreated, onAuthorizationRejected } = props
  const [draft, setDraft] = useState<RelationDraft>(emptyRelationDraft)
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const isSite = kind === 'site'
  const entryLabel = isSite ? 'lugar' : 'unidad'
  const pluralEntryLabel = isSite ? 'lugares' : 'unidades'
  const title = isSite ? 'Definir jerarquía de lugares' : 'Definir jerarquía organizacional'
  const sortedEntries = [...entries].sort((first, second) => first.displayName.localeCompare(second.displayName)
    || first.code.localeCompare(second.code))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || !authorization.canWrite) return
    if (!draft.parentId || !draft.childId || draft.parentId === draft.childId) {
      setFeedback({ type: 'error', text: `Los dos ${pluralEntryLabel} deben ser diferentes para crear la relación.` })
      return
    }

    const command: AcademicStructureRelationCreateCommand = {
      displayOrder: Number(draft.displayOrder),
      validFrom: draft.validFrom,
      validThrough: draft.validThrough || null,
      sourceReference: draft.sourceReference,
    }
    setPending(true)
    setFeedback(null)
    try {
      if (isSite) {
        await client.relateSites(draft.parentId, draft.childId, command, authorization.accessToken)
      } else {
        await client.relateOrganizationUnits(draft.parentId, draft.childId, command, authorization.accessToken)
      }
    } catch (error) {
      if (error instanceof AcademicOperationsApiError && (error.status === 401 || error.status === 403)) {
        setFeedback({
          type: 'error',
          text: error.status === 401
            ? 'El servidor rechazó la sesión. Estoy comprobando la identidad; inicia sesión de nuevo si hace falta.'
            : `El servidor negó el permiso para vincular ${pluralEntryLabel}. Estoy volviendo a comprobar los permisos.`,
        })
        try {
          await onAuthorizationRejected?.(authorization.accessToken)
        } catch {
          setFeedback({
            type: 'error',
            text: 'El servidor rechazó la operación y no pude revalidar los permisos. Vuelve a iniciar sesión antes de continuar.',
          })
        }
      } else if (error instanceof AcademicOperationsApiError && error.status === 409) {
        try {
          await onCreated()
          setFeedback({
            type: 'error',
            text: 'El servidor encontró un conflicto y actualicé la estructura. Revisa la jerarquía y la vigencia antes de otro intento.',
          })
        } catch {
          setFeedback({
            type: 'error',
            text: 'El servidor encontró un conflicto y no pude actualizar la estructura. Recarga antes de continuar.',
          })
        }
      } else if (error instanceof AcademicOperationsApiError && error.status === 400) {
        setFeedback({ type: 'error', text: 'El servidor rechazó los datos. Revisa las entidades, la vigencia, el orden y la referencia institucional.' })
      } else {
        setFeedback({ type: 'error', text: `No fue posible vincular los ${pluralEntryLabel}. Verifica la conexión e inténtalo de nuevo.` })
      }
      setPending(false)
      return
    }

    setDraft(emptyRelationDraft())
    setFeedback({ type: 'success', text: `Relación de ${pluralEntryLabel} registrada.` })
    try {
      await onCreated()
    } catch {
      setFeedback({
        type: 'warning',
        text: `La relación de ${pluralEntryLabel} quedó registrada, pero no pude actualizar la vista. Recarga antes de continuar.`,
      })
    } finally {
      setPending(false)
    }
  }

  const parentLabel = isSite ? 'Lugar superior' : 'Unidad superior'
  const childLabel = isSite ? 'Lugar subordinado' : 'Unidad subordinada'
  const orderLabel = isSite ? 'Orden dentro del lugar superior' : 'Orden dentro de la unidad superior'

  return (
    <section className="academic-create-entry" aria-labelledby={`academic-create-${kind}-relation-title`}>
      <div className="academic-create-entry-heading">
        <div>
          <p className="academic-panel-kicker">VÍNCULO AUDITADO</p>
          <h3 id={`academic-create-${kind}-relation-title`}>{title}</h3>
        </div>
        <span aria-hidden="true">↳</span>
      </div>
      <p className="academic-create-entry-intro">
        Vincula dos {pluralEntryLabel} existentes con orden, vigencia y referencia institucional. La jerarquía se valida en el servidor.
      </p>
      <form className="academic-create-entry-form" onSubmit={(event) => void submit(event)}>
        <label>
          {parentLabel}
          <select
            required
            value={draft.parentId}
            disabled={pending}
            onChange={(event) => {
              const parentId = event.currentTarget.value
              setDraft((current) => ({ ...current, parentId }))
            }}
          >
            <option value="">Selecciona {entryLabel} superior</option>
            {sortedEntries.map((entry) => (
              <option key={entry.id} value={entry.id}>{entry.displayName} · {entry.code}</option>
            ))}
          </select>
        </label>
        <label>
          {childLabel}
          <select
            required
            value={draft.childId}
            disabled={pending}
            onChange={(event) => {
              const childId = event.currentTarget.value
              setDraft((current) => ({ ...current, childId }))
            }}
          >
            <option value="">Selecciona {entryLabel} subordinado</option>
            {sortedEntries.map((entry) => (
              <option key={entry.id} value={entry.id}>{entry.displayName} · {entry.code}</option>
            ))}
          </select>
        </label>
        <label>
          {orderLabel}
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
          <button type="submit" disabled={pending || !authorization.canWrite || entries.length < 2}>
            {pending ? 'Vinculando…' : `Vincular ${pluralEntryLabel}`}
          </button>
          <p>{entries.length < 2
            ? `Se necesitan al menos dos ${pluralEntryLabel} en el maestro para definir una relación.`
            : 'El cambio requiere permiso institucional y queda auditado.'}</p>
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
