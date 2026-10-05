import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useStore } from 'zustand'
import type { StoreApi } from 'zustand/vanilla'
import type {
  AdmissionsDemoCorrectionReason,
  AdmissionsDemoProgramId,
  AdmissionsDemoReviewStatus,
  AdmissionsDemoState,
  NewAdmissionsDemoApplication,
} from './admissionsDemoStore'
import {
  ADMISSIONS_DEMO_PROGRAM_OPTIONS,
  getAdmissionsDemoCorrectionReasonLabel,
} from './admissionsDemoStore'

interface ApplicantFormValues {
  firstChoiceId: AdmissionsDemoProgramId | ''
  secondChoiceId: AdmissionsDemoProgramId | ''
  hasReviewedDemoNotice: boolean
  confirmedSyntheticOptions: boolean
}

interface AdmissionsApplicantDemoProps {
  store: StoreApi<AdmissionsDemoState>
}

const DEFAULT_VALUES: ApplicantFormValues = {
  firstChoiceId: '',
  secondChoiceId: '',
  hasReviewedDemoNotice: false,
  confirmedSyntheticOptions: false,
}

const STATUS_LABELS: Record<AdmissionsDemoReviewStatus, string> = {
  DEMO_RECEIVED: 'Recibida · ejemplo',
  DEMO_REVIEWING: 'En revisión · ejemplo',
  DEMO_CORRECTION_REQUESTED: 'Ajuste solicitado · demo',
  DEMO_CORRECTION_SUBMITTED: 'Respuesta enviada · demo',
  DEMO_REVIEW_COMPLETE: 'Revisión finalizada · demo',
}

function isCorrectionReason(reason: string | undefined): reason is AdmissionsDemoCorrectionReason {
  return reason === 'DEMO_CONFIRM_CHOICES' || reason === 'DEMO_COMPLETE_CHECKLIST'
}

export function AdmissionsApplicantDemo({ store }: AdmissionsApplicantDemoProps) {
  const applications = useStore(store, (state) => state.applications)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const { register, handleSubmit, getValues, reset, formState: { errors, isSubmitting } } =
    useForm<ApplicantFormValues>({ mode: 'onTouched', defaultValues: DEFAULT_VALUES })

  const onSubmit = handleSubmit((values) => {
    setConfirmation(null)
    const application: NewAdmissionsDemoApplication = {
      firstChoiceId: values.firstChoiceId as AdmissionsDemoProgramId,
      secondChoiceId: values.secondChoiceId as AdmissionsDemoProgramId,
      hasReviewedDemoNotice: values.hasReviewedDemoNotice,
      confirmedSyntheticOptions: values.confirmedSyntheticOptions,
    }

    try {
      const created = store.getState().addApplication(application)
      setConfirmation(`Ficha de demostración ${created.reference}: solo existe en memoria en este navegador.`)
      reset(DEFAULT_VALUES)
    } catch (error) {
      setConfirmation(error instanceof Error ? error.message : 'No se pudo crear la ficha de demostración.')
    }
  })

  return (
    <section className="admissions-lab-view admissions-lab-applicant" aria-labelledby="admissions-applicant-demo-title">
      <header className="admissions-lab-view-heading">
        <div>
          <p className="admissions-lab-eyebrow">RECORRIDO 01 · ASPIRANTE</p>
          <h2 id="admissions-applicant-demo-title">Explora cómo podría sentirse postularte</h2>
          <p>Completa un recorrido ficticio y mira cómo llega una ficha de muestra al equipo.</p>
        </div>
        <span className="admissions-lab-step-count">1 <span>de</span> 2</span>
      </header>

      <ol className="admissions-lab-steps" aria-label="Pasos de demostración">
        <li className="is-current"><span>01</span><div><strong>Elige tus opciones</strong><small>Programas completamente ficticios</small></div></li>
        <li><span>02</span><div><strong>Revisa y continúa</strong><small>Sin datos personales ni documentos</small></div></li>
      </ol>

      <div className="admissions-lab-notice" role="note">
        <strong>Demostración local</strong>
        <span>No escribas datos reales. Esta ficha no se envía a la UPTC ni se guarda al cerrar o recargar la página.</span>
      </div>

      <form className="admissions-lab-form" noValidate onSubmit={onSubmit}>
        <div className="admissions-lab-form-heading">
          <span className="admissions-lab-step-number">1</span>
          <div><h3>Organiza tus opciones</h3><p>Prueba la interacción con nombres de ejemplo.</p></div>
        </div>

        <div className="admissions-lab-choice-grid">
          <div className="admissions-lab-field">
            <label htmlFor="admissions-demo-first-choice">Primera opción ficticia</label>
            <select
              id="admissions-demo-first-choice"
              aria-invalid={Boolean(errors.firstChoiceId)}
              aria-describedby={errors.firstChoiceId ? 'admissions-demo-first-choice-error' : undefined}
              {...register('firstChoiceId', { required: 'Selecciona una primera opción ficticia.' })}
            >
              <option value="">Selecciona una opción de ejemplo</option>
              {ADMISSIONS_DEMO_PROGRAM_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            {errors.firstChoiceId && <p className="admissions-lab-field-error" id="admissions-demo-first-choice-error" role="alert">{errors.firstChoiceId.message}</p>}
          </div>

          <div className="admissions-lab-field">
            <label htmlFor="admissions-demo-second-choice">Segunda opción ficticia</label>
            <select
              id="admissions-demo-second-choice"
              aria-invalid={Boolean(errors.secondChoiceId)}
              aria-describedby={errors.secondChoiceId ? 'admissions-demo-second-choice-error' : undefined}
              {...register('secondChoiceId', {
                required: 'Selecciona una segunda opción ficticia.',
                validate: (value) => value !== getValues('firstChoiceId') || 'Elige una segunda opción diferente.',
              })}
            >
              <option value="">Selecciona una opción de ejemplo</option>
              {ADMISSIONS_DEMO_PROGRAM_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            {errors.secondChoiceId && <p className="admissions-lab-field-error" id="admissions-demo-second-choice-error" role="alert">{errors.secondChoiceId.message}</p>}
          </div>
        </div>

        <div className="admissions-lab-form-heading admissions-lab-confirm-heading">
          <span className="admissions-lab-step-number">2</span>
          <div><h3>Antes de continuar</h3><p>Estas confirmaciones pertenecen solo al recorrido ficticio.</p></div>
        </div>

        <label className="admissions-lab-check-field">
          <input
            type="checkbox"
            aria-invalid={Boolean(errors.hasReviewedDemoNotice)}
            aria-describedby={errors.hasReviewedDemoNotice ? 'admissions-demo-notice-error' : undefined}
            {...register('hasReviewedDemoNotice', { validate: (value) => value || 'Lee y acepta el aviso de demostración.' })}
          />
          <span>Lee y acepta el aviso de demostración</span>
        </label>
        {errors.hasReviewedDemoNotice && <p className="admissions-lab-field-error" id="admissions-demo-notice-error" role="alert">{errors.hasReviewedDemoNotice.message}</p>}

        <label className="admissions-lab-check-field">
          <input
            type="checkbox"
            aria-invalid={Boolean(errors.confirmedSyntheticOptions)}
            aria-describedby={errors.confirmedSyntheticOptions ? 'admissions-demo-options-error' : undefined}
            {...register('confirmedSyntheticOptions', { validate: (value) => value || 'Confirma que ambas opciones son ficticias.' })}
          />
          <span>Confirmo que ambas opciones y toda la información son ficticias</span>
        </label>
        {errors.confirmedSyntheticOptions && <p className="admissions-lab-field-error" id="admissions-demo-options-error" role="alert">{errors.confirmedSyntheticOptions.message}</p>}

        {confirmation && <p className="admissions-lab-feedback" role="status" aria-live="polite">{confirmation}</p>}

        <div className="admissions-lab-form-actions">
          <span>{applications.length} fichas sintéticas en la bandeja de este navegador</span>
          <button type="submit" className="admissions-lab-primary-button" disabled={isSubmitting}>
            Crear ficha sintética
          </button>
        </div>
      </form>

      <section className="admissions-lab-applicant-tracking" aria-label="Seguimiento de fichas demo">
        <div className="admissions-lab-section-heading">
          <div>
            <p className="admissions-lab-eyebrow">SEGUIMIENTO · SOLO DEMO</p>
            <h3>El estado de tus fichas de ejemplo</h3>
          </div>
          <span>{applications.length} casos ficticios</span>
        </div>

        {applications.length === 0 ? (
          <div className="admissions-lab-empty-state" role="status">
            <h3>Aún no hay fichas de ejemplo</h3>
            <p>Crea una ficha sintética para ver aquí el seguimiento.</p>
          </div>
        ) : (
          <div className="admissions-lab-applicant-case-list">
            {applications.map((application) => (
              <article
                className="admissions-lab-applicant-case"
                key={application.reference}
                aria-label={`Ficha ${application.reference}`}
              >
                <div className="admissions-lab-case-topline">
                  <span className="admissions-lab-case-reference">{application.reference}</span>
                  <span className={`admissions-lab-status admissions-lab-status-${application.status.toLowerCase()}`}>
                    <span aria-hidden="true" />{STATUS_LABELS[application.status]}
                  </span>
                </div>
                <div className="admissions-lab-applicant-choices">
                  <span>{ADMISSIONS_DEMO_PROGRAM_OPTIONS.find((option) => option.id === application.firstChoiceId)?.label}</span>
                  <span aria-hidden="true">→</span>
                  <span>{ADMISSIONS_DEMO_PROGRAM_OPTIONS.find((option) => option.id === application.secondChoiceId)?.label}</span>
                </div>

                {application.status === 'DEMO_CORRECTION_REQUESTED' && isCorrectionReason(application.correctionReason) ? (
                  <div className="admissions-lab-correction-panel">
                    <div>
                      <strong>El equipo dejó un ajuste para este ejercicio</strong>
                      <p>{getAdmissionsDemoCorrectionReasonLabel(application.correctionReason)}</p>
                    </div>
                    <button
                      className="admissions-lab-secondary-button"
                      type="button"
                      onClick={() => store.getState().acknowledgeCorrection(application.reference)}
                    >
                      Confirmo la respuesta demo
                    </button>
                    <small>Solo cambia el estado ficticio; no se envían documentos ni datos.</small>
                  </div>
                ) : application.status === 'DEMO_CORRECTION_SUBMITTED' ? (
                  <p className="admissions-lab-feedback" role="status">Respuesta demo enviada al equipo para continuar la revisión.</p>
                ) : (
                  <p className="admissions-lab-applicant-case-note">
                    {application.status === 'DEMO_REVIEW_COMPLETE'
                      ? 'La revisión del ejemplo terminó. No existe una decisión de admisión.'
                      : 'Ficha ficticia · sin datos personales ni soportes reales.'}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}
