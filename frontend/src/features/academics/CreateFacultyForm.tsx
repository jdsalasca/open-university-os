import { useState } from 'react'
import type { FormEvent } from 'react'
import type {
  AcademicOperationsClient,
  AcademicSiteType,
  AcademicStructureAuthorization,
} from './academicOperationsContracts'
import { AcademicOperationsApiError } from './academicOperationsClient'
import { localDateInputValue } from '../../shared/localDateInput'

interface SharedCreateEntryProps {
  authorization: AcademicStructureAuthorization
  onCreated(entryId: string): Promise<void>
  onAuthorizationRejected?: (accessToken: string) => Promise<void>
}

interface FacultyCreateProps extends SharedCreateEntryProps {
  client: Pick<AcademicOperationsClient, 'createOrganizationUnit'>
}

interface SiteCreateProps extends SharedCreateEntryProps {
  client: Pick<AcademicOperationsClient, 'createSite'>
}

interface EntryDraft {
  code: string
  siteType: AcademicSiteType | ''
  displayName: string
  displayOrder: string
  validFrom: string
  validThrough: string
  sourceReference: string
}

type Feedback = { type: 'success' | 'error' | 'warning'; text: string }

const siteTypeOptions: Array<{ value: AcademicSiteType; label: string }> = [
  { value: 'CENTRAL', label: 'Central' },
  { value: 'SECCIONAL', label: 'Seccional' },
  { value: 'REGIONAL', label: 'Regional' },
  { value: 'CREAD', label: 'CREAD' },
  { value: 'CAMPUS', label: 'Campus' },
  { value: 'OTHER', label: 'Otro lugar' },
]

function emptyEntryDraft(): EntryDraft {
  return {
    code: '',
    siteType: '',
    displayName: '',
    displayOrder: '0',
    validFrom: localDateInputValue(),
    validThrough: '',
    sourceReference: '',
  }
}

export function CreateFacultyForm(props: FacultyCreateProps) {
  return <AcademicStructureEntryForm {...props} kind="faculty" />
}

export function CreateSiteForm(props: SiteCreateProps) {
  return <AcademicStructureEntryForm {...props} kind="site" />
}

function AcademicStructureEntryForm({
  kind,
  client,
  authorization,
  onCreated,
  onAuthorizationRejected,
}: (FacultyCreateProps & { kind: 'faculty' }) | (SiteCreateProps & { kind: 'site' })) {
  const [draft, setDraft] = useState<EntryDraft>(emptyEntryDraft)
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const isFaculty = kind === 'faculty'
  const displayEntity = isFaculty ? 'facultad' : 'lugar'
  const displayEntityTitle = isFaculty ? 'facultad raíz' : 'lugar académico'
  const title = isFaculty ? 'Registrar facultad raíz' : 'Registrar lugar académico'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || !authorization.canWrite) return
    if (!isFaculty && !draft.siteType) {
      setFeedback({ type: 'error', text: 'Selecciona el tipo de lugar antes de continuar.' })
      return
    }

    const command = {
      code: draft.code,
      displayName: draft.displayName,
      displayOrder: Number(draft.displayOrder),
      validFrom: draft.validFrom,
      validThrough: draft.validThrough || null,
      sourceReference: draft.sourceReference,
    }

    setPending(true)
    setFeedback(null)
    let entryId: string
    try {
      entryId = isFaculty
        ? await client.createOrganizationUnit({ ...command, type: 'FACULTY' }, authorization.accessToken)
        : await client.createSite({ ...command, type: draft.siteType as AcademicSiteType }, authorization.accessToken)
    } catch (error) {
      if (error instanceof AcademicOperationsApiError && (error.status === 401 || error.status === 403)) {
        setFeedback({
          type: 'error',
          text: error.status === 401
            ? 'El servidor rechazó la sesión. Estoy comprobando la identidad; inicia sesión de nuevo si hace falta.'
            : `El servidor negó el permiso para crear ${displayEntity}. Estoy volviendo a comprobar los permisos.`,
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
        setFeedback({ type: 'error', text: 'Ese código ya está registrado o entra en conflicto con la estructura vigente.' })
      } else if (error instanceof AcademicOperationsApiError && error.status === 400) {
        setFeedback({ type: 'error', text: 'El servidor rechazó los datos. Revisa código, vigencia y referencia institucional.' })
      } else {
        setFeedback({ type: 'error', text: `No fue posible registrar el ${displayEntity}. Verifica la conexión e inténtalo de nuevo.` })
      }
      setPending(false)
      return
    }

    setDraft(emptyEntryDraft())
    const futureEffectiveDate = command.validFrom > localDateInputValue()
    const registeredEntity = isFaculty ? 'Facultad' : 'Lugar'
    setFeedback({
      type: 'success',
      text: futureEffectiveDate
        ? `${registeredEntity} ${isFaculty ? 'registrada' : 'registrado'}. Aparecerá en la estructura vigente desde ${command.validFrom}.`
        : `${registeredEntity} ${isFaculty ? 'registrada' : 'registrado'} y estructura actualizada.`,
    })
    try {
      await onCreated(entryId)
    } catch {
      setFeedback({
        type: 'warning',
        text: `El ${displayEntity} quedó registrado, pero no pude actualizar la vista. Recarga antes de continuar.`,
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="academic-create-entry" aria-labelledby={`academic-create-${kind}-title`}>
      <div className="academic-create-entry-heading">
        <div>
          <p className="academic-panel-kicker">ALTA AUDITADA</p>
          <h3 id={`academic-create-${kind}-title`}>{title}</h3>
        </div>
        <span className="academic-operation-icon" aria-hidden="true">＋</span>
      </div>
      <p className="academic-create-entry-intro">
        Registra un {displayEntityTitle} con código, vigencia y referencia institucional. No se cargan registros de ejemplo.
      </p>
      <form className="academic-create-entry-form" onSubmit={(event) => void submit(event)}>
        <label>
          {isFaculty ? 'Código institucional' : 'Código del lugar'}
          <input
            autoComplete="off"
            maxLength={64}
            pattern="[A-Za-z0-9][A-Za-z0-9._-]{0,63}"
            required
            value={draft.code}
            disabled={pending}
            onChange={(event) => {
              const code = event.currentTarget.value
              setDraft((current) => ({ ...current, code }))
            }}
          />
        </label>
        {!isFaculty && (
          <label>
            Tipo de lugar
            <select
              required
              value={draft.siteType}
              disabled={pending}
              onChange={(event) => {
                const siteType = event.currentTarget.value as AcademicSiteType | ''
                setDraft((current) => ({ ...current, siteType }))
              }}
            >
              <option value="">Selecciona un tipo</option>
              {siteTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          {isFaculty ? 'Nombre de la facultad' : 'Nombre del lugar'}
          <input
            autoComplete="organization"
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
          {isFaculty ? 'Prioridad de visualización' : 'Prioridad del lugar'}
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
          <button type="submit" disabled={pending || !authorization.canWrite}>
            {pending ? 'Registrando…' : `Crear ${displayEntity}`}
          </button>
          <p>La escritura requiere permiso institucional y queda auditada.</p>
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
