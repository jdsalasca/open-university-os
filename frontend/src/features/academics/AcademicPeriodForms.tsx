import { useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { RHFInputField } from '../../shared/forms/RHFInputField'
import { AcademicOperationsApiError } from './academicOperationsClient'
import type {
  AcademicCalendarRevision,
  AcademicOperationsClient,
  AcademicOrganizationUnit,
  AcademicPeriod,
  AcademicPeriodKind,
  AcademicSite,
} from './academicOperationsContracts'

type Feedback = { type: 'success' | 'warning' | 'error'; text: string }

type PeriodFormValues = {
  code: string
  kind: AcademicPeriodKind
  academicYear: number | undefined
  sequenceNumber: number | undefined
  startsOn: string
  endsOn: string
}

interface CreateAcademicPeriodFormProps {
  client: Pick<AcademicOperationsClient, 'createPeriod'>
  accessToken: string
  onCreated(period: AcademicPeriod): Promise<void> | void
  onAuthorizationRejected?: (accessToken: string) => Promise<void>
}

export function CreateAcademicPeriodForm({
  client,
  accessToken,
  onCreated,
  onAuthorizationRejected,
}: CreateAcademicPeriodFormProps) {
  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<PeriodFormValues>({
    defaultValues: { code: '', kind: 'REGULAR', academicYear: undefined, sequenceNumber: undefined, startsOn: '', endsOn: '' },
  })
  const kind = useWatch({ control, name: 'kind' })
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  async function submit(values: PeriodFormValues) {
    setFeedback(null)
    try {
      const period = await client.createPeriod({
        code: values.code.trim(),
        kind: values.kind,
        academicYear: Number(values.academicYear),
        sequenceNumber: Number(values.sequenceNumber),
        startsOn: values.startsOn,
        endsOn: values.endsOn,
      }, accessToken)
      reset()
      setFeedback({ type: 'success', text: 'Se creó el borrador ' + period.code + '. Aún no está aprobado ni abierto.' })
      try {
        await onCreated(period)
      } catch {
        setFeedback({ type: 'warning', text: 'El borrador ' + period.code + ' se creó, pero la lista no se actualizó. Recarga antes de continuar.' })
      }
    } catch (error) {
      setFeedback({ type: 'error', text: await academicWriteError(error, 'crear el periodo', accessToken, onAuthorizationRejected) })
    }
  }

  return (
    <section className="academic-period-form-panel" aria-labelledby="academic-period-create-title">
      <header><p className="academic-panel-kicker">BORRADOR AUDITADO</p><h3 id="academic-period-create-title">Crear periodo académico</h3></header>
      <p className="academic-period-form-intro">Elige si corresponde a un periodo regular o intersemestral. Las fechas se registran sin publicar oferta ni abrir matrícula.</p>
      <form className="academic-period-form-grid" aria-label="Crear periodo académico" noValidate onSubmit={handleSubmit(submit)}>
        <RHFInputField
          id="academic-period-code"
          label="Código del periodo"
          autoComplete="off"
          maxLength={64}
          registration={register('code', {
            required: 'Escribe un código institucional.',
            maxLength: { value: 64, message: 'El código admite hasta 64 caracteres.' },
            pattern: { value: /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/, message: 'Usa letras, números, punto, guion o guion bajo.' },
          })}
          error={errors.code?.message}
          hint="Debe ser único; la institución define su nomenclatura."
          disabled={isSubmitting}
        />
        <div className="academic-period-form-field">
          <label htmlFor="academic-period-kind">Tipo de periodo</label>
          <select id="academic-period-kind" className="academic-period-form-select" disabled={isSubmitting}
            aria-invalid={errors.kind ? 'true' : 'false'} {...register('kind', { required: 'Selecciona el tipo de periodo.' })}>
            <option value="REGULAR">Regular</option>
            <option value="INTERSEMESTRAL">Intersemestral</option>
          </select>
          {errors.kind?.message && <span role="alert">{errors.kind.message}</span>}
        </div>
        <RHFInputField
          id="academic-period-year"
          label="Año académico"
          type="number"
          min={1900}
          max={9999}
          step={1}
          registration={register('academicYear', {
            valueAsNumber: true,
            required: 'Escribe el año académico.',
            min: { value: 1900, message: 'El año mínimo admitido es 1900.' },
            max: { value: 9999, message: 'El año máximo admitido es 9999.' },
            validate: (value) => Number.isInteger(value) || 'El año académico debe ser un número entero.',
          })}
          error={errors.academicYear?.message}
          disabled={isSubmitting}
        />
        <RHFInputField
          id="academic-period-sequence"
          label="Número del periodo"
          type="number"
          min={1}
          max={kind === 'REGULAR' ? 2 : 99}
          step={1}
          registration={register('sequenceNumber', {
            valueAsNumber: true,
            required: 'Escribe el número del periodo.',
            min: { value: 1, message: 'El número debe ser mayor que cero.' },
            validate: (value) => {
              if (typeof value !== 'number' || !Number.isInteger(value)) return 'El número del periodo debe ser entero.'
              if (value > 99) return 'El número máximo admitido es 99.'
              return kind !== 'REGULAR' || value <= 2 || 'En un periodo regular el número debe ser 1 o 2.'
            },
          })}
          error={errors.sequenceNumber?.message}
          hint={kind === 'REGULAR' ? 'Los periodos regulares admiten 1 o 2.' : 'Usa un número del 1 al 99, independiente del semestre curricular.'}
          disabled={isSubmitting}
        />
        <RHFInputField
          id="academic-period-start"
          label="Inicio de instrucción"
          type="date"
          registration={register('startsOn', { required: 'Indica la fecha inicial.' })}
          error={errors.startsOn?.message}
          disabled={isSubmitting}
        />
        <RHFInputField
          id="academic-period-end"
          label="Fin de instrucción"
          type="date"
          registration={register('endsOn', {
            required: 'Indica la fecha final.',
            validate: (end, values) => !values.startsOn || end >= values.startsOn || 'El fin debe ser igual o posterior al inicio.',
          })}
          error={errors.endsOn?.message}
          disabled={isSubmitting}
        />
        <div className="academic-period-form-actions">
          <button type="submit" disabled={isSubmitting || !accessToken.trim()}>
            {isSubmitting ? 'Creando borrador…' : 'Crear borrador de periodo'}
          </button>
          <span>El servidor verifica permiso, código y fechas antes de guardar.</span>
        </div>
      </form>
      {feedback && <p className={'academic-period-form-feedback is-' + feedback.type}
        role={feedback.type === 'error' ? 'alert' : 'status'}>{feedback.text}</p>}
    </section>
  )
}

interface CalendarActivityFormValue {
  key: string
  label: string
  startsAt: string
  endsAt: string
  organizationUnitId: string
  siteId: string
}

interface CalendarFormValues {
  officialReference: string
  activities: CalendarActivityFormValue[]
}

interface AcademicCalendarRevisionFormProps {
  periodId: string
  accessToken: string
  client: Pick<AcademicOperationsClient, 'createCalendar'>
  units?: AcademicOrganizationUnit[]
  sites?: AcademicSite[]
  onCreated(): Promise<void> | void
  onAuthorizationRejected?: (accessToken: string) => Promise<void>
}

export function AcademicCalendarRevisionForm({
  periodId,
  accessToken,
  client,
  units = [],
  sites = [],
  onCreated,
  onAuthorizationRejected,
}: AcademicCalendarRevisionFormProps) {
  const { register, handleSubmit, control, getValues, reset, formState: { errors, isSubmitting } } = useForm<CalendarFormValues>({
    defaultValues: { officialReference: '', activities: [emptyActivity()] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'activities', rules: {
    minLength: { value: 1, message: 'Agrega al menos una actividad al calendario.' },
    maxLength: { value: 200, message: 'El calendario admite hasta 200 actividades.' },
  } })
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  async function submit(values: CalendarFormValues) {
    setFeedback(null)
    try {
      await client.createCalendar(periodId, {
        officialReference: values.officialReference.trim(),
        activities: values.activities.map((activity) => ({
          key: activity.key.trim().toLocaleUpperCase('en-US'),
          label: activity.label.trim(),
          startsAt: activity.startsAt,
          endsAt: activity.endsAt,
          organizationUnitId: activity.organizationUnitId || null,
          siteId: activity.siteId || null,
        })),
      }, accessToken)
      reset({ officialReference: '', activities: [emptyActivity()] })
      setFeedback({ type: 'success', text: 'Se guardó una nueva revisión en borrador; la versión publicada anterior permanece intacta.' })
      try {
        await onCreated()
      } catch {
        setFeedback({ type: 'warning', text: 'La revisión se guardó, pero el historial no se actualizó. Cierra y vuelve a abrir el historial.' })
      }
    } catch (error) {
      setFeedback({ type: 'error', text: await academicWriteError(error, 'guardar el calendario', accessToken, onAuthorizationRejected) })
    }
  }

  return (
    <section className="academic-period-form-panel academic-calendar-create-panel" aria-labelledby={'academic-calendar-create-' + periodId}>
      <header><p className="academic-panel-kicker">CALENDARIO VERSIONADO</p><h4 id={'academic-calendar-create-' + periodId}>Crear revisión de calendario</h4></header>
      <p className="academic-period-form-intro">Escribe la referencia oficial y agrega actividades. Las fechas de inscripción pueden preceder o suceder las fechas de instrucción; la hora se interpreta en Colombia.</p>
      <form className="academic-period-form-grid" aria-label="Crear revisión de calendario" noValidate onSubmit={handleSubmit(submit)}>
        <RHFInputField
          id={'academic-calendar-reference-' + periodId}
          label="Referencia oficial del calendario"
          autoComplete="off"
          maxLength={240}
          registration={register('officialReference', {
            required: 'Escribe la referencia del acto o calendario oficial.',
            maxLength: { value: 240, message: 'La referencia admite hasta 240 caracteres.' },
            validate: (value) => value.trim().length > 0 || 'Escribe la referencia del acto o calendario oficial.',
          })}
          error={errors.officialReference?.message}
          disabled={isSubmitting}
        />
        {fields.map((field, index) => {
          const idBase = 'academic-calendar-' + periodId + '-activity-' + (index + 1)
          const keyPath = ('activities.' + index + '.key') as 'activities.0.key'
          const labelPath = ('activities.' + index + '.label') as 'activities.0.label'
          const startPath = ('activities.' + index + '.startsAt') as 'activities.0.startsAt'
          const endPath = ('activities.' + index + '.endsAt') as 'activities.0.endsAt'
          const unitPath = ('activities.' + index + '.organizationUnitId') as 'activities.0.organizationUnitId'
          const sitePath = ('activities.' + index + '.siteId') as 'activities.0.siteId'
          return (
            <fieldset className="academic-calendar-activity" key={field.id}>
              <legend>Actividad {index + 1}</legend>
              <div className="academic-period-form-grid">
                <RHFInputField id={idBase + '-key'} label={'Clave de actividad ' + (index + 1)} autoComplete="off"
                  maxLength={64}
                  registration={register(keyPath, {
                    required: 'Escribe una clave para la actividad.',
                    pattern: { value: /^[A-Za-z][A-Za-z0-9_]{0,63}$/, message: 'Usa una letra inicial y luego letras, números o guion bajo.' },
                    validate: (key, values) => values.activities.filter((item) => item.key.trim().toLocaleUpperCase('en-US') === key.trim().toLocaleUpperCase('en-US')).length === 1
                      || 'Cada actividad debe tener una clave única.',
                  })}
                  error={errors.activities?.[index]?.key?.message}
                  disabled={isSubmitting}
                />
                <RHFInputField id={idBase + '-label'} label={'Nombre de actividad ' + (index + 1)} maxLength={160}
                  registration={register(labelPath, {
                    required: 'Escribe un nombre para la actividad.',
                    maxLength: { value: 160, message: 'El nombre admite hasta 160 caracteres.' },
                    validate: (value) => value.trim().length > 0 || 'Escribe un nombre para la actividad.',
                  })}
                  error={errors.activities?.[index]?.label?.message}
                  disabled={isSubmitting}
                />
                <RHFInputField id={idBase + '-start'} label={'Inicio de actividad ' + (index + 1)} type="datetime-local"
                  registration={register(startPath, { required: 'Indica el inicio de la actividad.' })}
                  error={errors.activities?.[index]?.startsAt?.message}
                  disabled={isSubmitting}
                />
                <RHFInputField id={idBase + '-end'} label={'Fin de actividad ' + (index + 1)} type="datetime-local"
                  registration={register(endPath, {
                    required: 'Indica el fin de la actividad.',
                    validate: (end) => end >= getValues(startPath) || 'El fin debe ser igual o posterior al inicio.',
                  })}
                  error={errors.activities?.[index]?.endsAt?.message}
                  disabled={isSubmitting}
                />
                <div className="academic-period-form-field">
                  <label htmlFor={idBase + '-unit'}>Unidad responsable (opcional)</label>
                  <select id={idBase + '-unit'} className="academic-period-form-select" disabled={isSubmitting} {...register(unitPath)}>
                    <option value="">Alcance general</option>
                    {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.displayName}</option>)}
                  </select>
                </div>
                <div className="academic-period-form-field">
                  <label htmlFor={idBase + '-site'}>Sede (opcional)</label>
                  <select id={idBase + '-site'} className="academic-period-form-select" disabled={isSubmitting} {...register(sitePath)}>
                    <option value="">Todas las sedes</option>
                    {sites.map((site) => <option key={site.id} value={site.id}>{site.displayName}</option>)}
                  </select>
                </div>
                {fields.length > 1 && <button type="button" className="academic-period-form-remove"
                  aria-label={'Quitar actividad ' + (index + 1)} disabled={isSubmitting} onClick={() => remove(index)}>Quitar actividad</button>}
              </div>
            </fieldset>
          )
        })}
        {errors.activities?.root?.message && <p className="academic-period-form-field-error" role="alert">{errors.activities.root.message}</p>}
        <div className="academic-period-form-actions">
          <button type="button" className="secondary" disabled={isSubmitting || fields.length >= 200}
            onClick={() => append(emptyActivity())}>Añadir actividad</button>
          <button type="submit" disabled={isSubmitting || !accessToken.trim()}>
            {isSubmitting ? 'Guardando revisión…' : 'Guardar borrador de calendario'}
          </button>
        </div>
      </form>
      {feedback && <p className={'academic-period-form-feedback is-' + feedback.type}
        role={feedback.type === 'error' ? 'alert' : 'status'}>{feedback.text}</p>}
    </section>
  )
}

interface ApproveAcademicPeriodFormProps {
  periodId: string
  publishedRevisions: AcademicCalendarRevision[]
  accessToken: string
  client: Pick<AcademicOperationsClient, 'approvePeriod'>
  onApproved(period: AcademicPeriod): void
  onAuthorizationRejected?: (accessToken: string) => Promise<void>
}

interface ApprovalFormValues {
  calendarRevisionId: string
  approvalReference: string
}

export function ApproveAcademicPeriodForm({
  periodId,
  publishedRevisions,
  accessToken,
  client,
  onApproved,
  onAuthorizationRejected,
}: ApproveAcademicPeriodFormProps) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ApprovalFormValues>({
    defaultValues: { calendarRevisionId: '', approvalReference: '' },
  })
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  async function submit(values: ApprovalFormValues) {
    setFeedback(null)
    try {
      const approved = await client.approvePeriod(periodId, {
        calendarRevisionId: values.calendarRevisionId,
        approvalReference: values.approvalReference.trim(),
      }, accessToken)
      reset()
      onApproved(approved)
      setFeedback({ type: 'success', text: 'El periodo quedó aprobado con el acto indicado. Su apertura es una acción separada.' })
    } catch (error) {
      setFeedback({ type: 'error', text: await academicWriteError(error, 'aprobar el periodo', accessToken, onAuthorizationRejected) })
    }
  }

  return (
    <section className="academic-period-form-panel academic-period-approval-panel" aria-labelledby={'academic-period-approve-' + periodId}>
      <header><p className="academic-panel-kicker">APROBACIÓN EXPLÍCITA</p><h4 id={'academic-period-approve-' + periodId}>Aprobar periodo</h4></header>
      <p className="academic-period-form-intro">Selecciona una revisión publicada y registra el acto de aprobación correspondiente.</p>
      <form className="academic-period-form-grid" aria-label="Aprobar periodo" noValidate onSubmit={handleSubmit(submit)}>
        <div className="academic-period-form-field">
          <label htmlFor={'academic-period-approval-revision-' + periodId}>Revisión publicada</label>
          <select id={'academic-period-approval-revision-' + periodId} className="academic-period-form-select"
            disabled={isSubmitting} aria-invalid={errors.calendarRevisionId ? 'true' : 'false'}
            {...register('calendarRevisionId', { required: 'Selecciona una revisión publicada.' })}>
            <option value="">Selecciona una revisión</option>
            {publishedRevisions.map((revision) => <option key={revision.id} value={revision.id}>
              Revisión {revision.version} · {revision.officialReference}
            </option>)}
          </select>
          {errors.calendarRevisionId?.message && <span role="alert">{errors.calendarRevisionId.message}</span>}
        </div>
        <RHFInputField id={'academic-period-approval-reference-' + periodId} label="Referencia del acto de aprobación"
          autoComplete="off" maxLength={240}
          registration={register('approvalReference', {
            required: 'Escribe la referencia del acto de aprobación.',
            maxLength: { value: 240, message: 'La referencia admite hasta 240 caracteres.' },
            validate: (value) => value.trim().length > 0 || 'Escribe la referencia del acto de aprobación.',
          })}
          error={errors.approvalReference?.message}
          disabled={isSubmitting}
        />
        <div className="academic-period-form-actions">
          <button type="submit" disabled={isSubmitting || !accessToken.trim()}>
            {isSubmitting ? 'Aprobando…' : 'Aprobar periodo'}
          </button>
        </div>
      </form>
      {feedback && <p className={'academic-period-form-feedback is-' + feedback.type}
        role={feedback.type === 'error' ? 'alert' : 'status'}>{feedback.text}</p>}
    </section>
  )
}

function emptyActivity(): CalendarActivityFormValue {
  return { key: '', label: '', startsAt: '', endsAt: '', organizationUnitId: '', siteId: '' }
}

async function academicWriteError(
  error: unknown,
  action: string,
  accessToken: string,
  onAuthorizationRejected?: (accessToken: string) => Promise<void>,
): Promise<string> {
  if (error instanceof AcademicOperationsApiError && (error.status === 401 || error.status === 403)) {
    try {
      await onAuthorizationRejected?.(accessToken)
    } catch {
      return 'El servidor rechazó la sesión y no fue posible revalidarla. Inicia sesión de nuevo antes de continuar.'
    }
    return error.status === 401
      ? 'El servidor rechazó la sesión. Se comprobó la identidad; inicia sesión de nuevo si hace falta.'
      : 'El servidor negó el permiso para ' + action + '. Se están revalidando los permisos.'
  }
  if (error instanceof AcademicOperationsApiError && error.status === 409) {
    return 'El estado cambió mientras trabajabas o el código ya existe. Actualiza la vista y revisa antes de intentar otra vez.'
  }
  if (error instanceof AcademicOperationsApiError && error.status === 400) {
    return 'El servidor rechazó los datos. Revisa tipo, fechas, actividades y referencias institucionales.'
  }
  return 'No fue posible ' + action + '. Verifica la conexión y el estado actual antes de volver a enviar.'
}

