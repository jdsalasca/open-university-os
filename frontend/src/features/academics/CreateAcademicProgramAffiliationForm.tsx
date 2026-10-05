import { useState } from 'react'
import type { FormEvent } from 'react'
import type { AcademicProgram } from './contracts'
import type {
  AcademicOperationsClient,
  AcademicOrganizationUnit,
  AcademicProgramAffiliationCreateCommand,
  AcademicSite,
  AcademicStructureAuthorization,
} from './academicOperationsContracts'
import { AcademicOperationsApiError } from './academicOperationsClient'
import { localDateInputValue } from '../../shared/localDateInput'

interface CreateAcademicProgramAffiliationFormProps {
  programs: AcademicProgram[]
  units: AcademicOrganizationUnit[]
  sites: AcademicSite[]
  client: Pick<AcademicOperationsClient, 'affiliateProgram'>
  authorization: AcademicStructureAuthorization
  onCreated(): Promise<void>
  onAuthorizationRejected?: (accessToken: string) => Promise<void>
}

interface AffiliationDraft {
  programId: string
  organizationUnitId: string
  siteId: string
  displayOrder: string
  validFrom: string
  validThrough: string
  sourceReference: string
}

type Feedback = { type: 'success' | 'error' | 'warning'; text: string }

function emptyAffiliationDraft(): AffiliationDraft {
  return {
    programId: '',
    organizationUnitId: '',
    siteId: '',
    displayOrder: '0',
    validFrom: localDateInputValue(),
    validThrough: '',
    sourceReference: '',
  }
}

function compareNames(first: { displayName: string; code: string }, second: { displayName: string; code: string }): number {
  return first.displayName.localeCompare(second.displayName) || first.code.localeCompare(second.code)
}

export function CreateAcademicProgramAffiliationForm({
  programs,
  units,
  sites,
  client,
  authorization,
  onCreated,
  onAuthorizationRejected,
}: CreateAcademicProgramAffiliationFormProps) {
  const [draft, setDraft] = useState<AffiliationDraft>(emptyAffiliationDraft)
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const sortedPrograms = [...programs].sort((first, second) => first.programCode.localeCompare(second.programCode)
    || first.programName.localeCompare(second.programName))
  const sortedUnits = [...units].sort(compareNames)
  const sortedSites = [...sites].sort(compareNames)
  const canCreate = authorization.canWrite && sortedPrograms.length > 0 && sortedUnits.length > 0 && sortedSites.length > 0

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || !authorization.canWrite) return
    if (!draft.programId || !draft.organizationUnitId || !draft.siteId) {
      setFeedback({ type: 'error', text: 'Selecciona un programa publicado, una unidad responsable y un lugar de desarrollo.' })
      return
    }
    const normalizedOrder = draft.displayOrder.trim()
    const displayOrder = Number(normalizedOrder)
    if (!/^\d+$/.test(normalizedOrder) || !Number.isSafeInteger(displayOrder) || displayOrder > 100_000) {
      setFeedback({ type: 'error', text: 'El orden debe ser un entero entre 0 y 100000.' })
      return
    }

    const command: AcademicProgramAffiliationCreateCommand = {
      organizationUnitId: draft.organizationUnitId,
      siteId: draft.siteId,
      displayOrder,
      validFrom: draft.validFrom,
      validThrough: draft.validThrough || null,
      sourceReference: draft.sourceReference.trim(),
    }
    setPending(true)
    setFeedback(null)
    try {
      await client.affiliateProgram(draft.programId, command, authorization.accessToken)
    } catch (error) {
      if (error instanceof AcademicOperationsApiError && (error.status === 401 || error.status === 403)) {
        setFeedback({
          type: 'error',
          text: error.status === 401
            ? 'El servidor rechazó la sesión. Estoy comprobando la identidad; inicia sesión de nuevo si hace falta.'
            : 'El servidor negó el permiso para adscribir programas. Estoy volviendo a comprobar los permisos.',
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
            text: 'El servidor encontró un conflicto de vigencia o adscripción y actualicé la estructura. Revisa los datos antes de otro intento.',
          })
        } catch {
          setFeedback({
            type: 'error',
            text: 'El servidor encontró un conflicto y no pude actualizar la estructura. Recarga antes de continuar.',
          })
        }
      } else if (error instanceof AcademicOperationsApiError && error.status === 400) {
        setFeedback({ type: 'error', text: 'El servidor rechazó los datos. Revisa el programa, las entidades, la vigencia, el orden y la referencia institucional.' })
      } else {
        setFeedback({ type: 'error', text: 'No fue posible adscribir el programa. Verifica la conexión e inténtalo de nuevo.' })
      }
      setPending(false)
      return
    }

    setDraft(emptyAffiliationDraft())
    setFeedback({ type: 'success', text: 'Afiliación del programa registrada y estructura actualizada.' })
    try {
      await onCreated()
    } catch {
      setFeedback({
        type: 'warning',
        text: 'La afiliación quedó registrada, pero no pude actualizar la vista. Recarga antes de continuar.',
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="academic-create-entry" aria-labelledby="academic-create-program-affiliation-title">
      <div className="academic-create-entry-heading">
        <div>
          <p className="academic-panel-kicker">ADSCRIPCIÓN AUDITADA</p>
          <h3 id="academic-create-program-affiliation-title">Adscribir programa publicado</h3>
        </div>
        <span aria-hidden="true">↗</span>
      </div>
      <p className="academic-create-entry-intro">
        Relaciona el programa con una unidad y un lugar existentes, con vigencia, orden y referencia institucional.
        El servidor impide vigencias simultáneas para un mismo programa.
      </p>
      <form className="academic-create-entry-form" onSubmit={(event) => void submit(event)}>
        <label>
          Programa publicado
          <select
            required
            value={draft.programId}
            disabled={pending}
            onChange={(event) => {
              const programId = event.currentTarget.value
              setDraft((current) => ({ ...current, programId }))
            }}
          >
            <option value="">Selecciona un programa</option>
            {sortedPrograms.map((program) => (
              <option key={program.id} value={program.id}>{program.programName} · {program.programCode}</option>
            ))}
          </select>
        </label>
        <label>
          Unidad responsable
          <select
            required
            value={draft.organizationUnitId}
            disabled={pending}
            onChange={(event) => {
              const organizationUnitId = event.currentTarget.value
              setDraft((current) => ({ ...current, organizationUnitId }))
            }}
          >
            <option value="">Selecciona una unidad</option>
            {sortedUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>{unit.displayName} · {unit.code}</option>
            ))}
          </select>
        </label>
        <label>
          Lugar de desarrollo
          <select
            required
            value={draft.siteId}
            disabled={pending}
            onChange={(event) => {
              const siteId = event.currentTarget.value
              setDraft((current) => ({ ...current, siteId }))
            }}
          >
            <option value="">Selecciona un lugar</option>
            {sortedSites.map((site) => (
              <option key={site.id} value={site.id}>{site.displayName} · {site.code}</option>
            ))}
          </select>
        </label>
        <label>
          Orden del programa en la unidad
          <input
            type="number"
            min={0}
            max={100_000}
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
          <button type="submit" disabled={pending || !canCreate}>Crear afiliación</button>
          <p>{canCreate
            ? 'La afiliación requiere permiso institucional y queda auditada.'
            : 'Requiere un programa publicado, una unidad y un lugar activos; el cambio queda auditado.'}</p>
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
