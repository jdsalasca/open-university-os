import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useStore } from 'zustand'
import type { StoreApi } from 'zustand/vanilla'
import type {
  AdmissionsDemoCorrectionReason,
  AdmissionsDemoReviewStatus,
  AdmissionsDemoState,
} from './admissionsDemoStore'
import {
  ADMISSIONS_DEMO_CORRECTION_REASONS,
  ADMISSIONS_DEMO_PROGRAM_OPTIONS,
  getAdmissionsDemoCorrectionReasonLabel,
} from './admissionsDemoStore'

interface AdmissionsAdminDemoProps {
  store: StoreApi<AdmissionsDemoState>
}

interface CorrectionRequestFormValues {
  correctionReason: AdmissionsDemoCorrectionReason | ''
}

const ALL_STATUSES = ''

const STATUS_LABELS: Record<AdmissionsDemoReviewStatus, string> = {
  DEMO_RECEIVED: 'Recibida · pendiente de revisión demo',
  DEMO_REVIEWING: 'Revisión demo en curso',
  DEMO_CORRECTION_REQUESTED: 'Ajuste solicitado · demo',
  DEMO_CORRECTION_SUBMITTED: 'Respuesta demo recibida',
  DEMO_REVIEW_COMPLETE: 'Revisión de ejemplo finalizada · sin decisión de admisión',
}

function getProgramLabel(programId: string): string {
  return ADMISSIONS_DEMO_PROGRAM_OPTIONS.find((program) => program.id === programId)?.label ?? 'Opción ficticia'
}

export function AdmissionsAdminDemo({ store }: AdmissionsAdminDemoProps) {
  const applications = useStore(store, (state) => state.applications)
  const [statusFilter, setStatusFilter] = useState<AdmissionsDemoReviewStatus | ''>(ALL_STATUSES)
  const [query, setQuery] = useState('')
  const [selectedReference, setSelectedReference] = useState<string | null>(null)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CorrectionRequestFormValues>({
    mode: 'onTouched',
    defaultValues: { correctionReason: '' },
  })
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleApplications = applications.filter((application) => {
    const matchesStatus = statusFilter === ALL_STATUSES || application.status === statusFilter
    const matchesQuery = normalizedQuery === '' || application.reference.toLocaleLowerCase().includes(normalizedQuery)
    return matchesStatus && matchesQuery
  })
  const selectedApplication = visibleApplications.find((application) => application.reference === selectedReference)
    ?? visibleApplications[0]

  const onRequestCorrection = handleSubmit((values) => {
    if (!selectedApplication || values.correctionReason === '') return
    store.getState().requestCorrection(selectedApplication.reference, values.correctionReason)
    reset({ correctionReason: '' })
  })

  return (
    <section className="admissions-lab-view admissions-lab-admin" aria-labelledby="admissions-admin-demo-title">
      <header className="admissions-lab-view-heading">
        <div>
          <p className="admissions-lab-eyebrow">RECORRIDO 02 · EQUIPO</p>
          <h2 id="admissions-admin-demo-title">Una bandeja para acompañar cada revisión</h2>
          <p>Abre una ficha, sigue su estado y comparte una solicitud ficticia de corrección.</p>
        </div>
        <span className="admissions-lab-inbox-count"><strong>{applications.length}</strong> fichas demo</span>
      </header>

      <div className="admissions-lab-notice admissions-lab-notice-admin" role="note">
        <strong>Vista de muestra, sin acceso institucional</strong>
        <span>La perspectiva no inicia sesión ni concede permisos. No contiene aspirantes reales y no permite admitir, rechazar ni asignar puntajes.</span>
      </div>

      <section className="admissions-lab-inbox" aria-label="Bandeja ficticia de admisiones">
        {applications.length === 0 ? (
          <div className="admissions-lab-empty-state">
            <span aria-hidden="true">✳</span>
            <h3>Aún no hay fichas sintéticas</h3>
            <p>Cambia a la vista del aspirante y crea una ficha de ejemplo.</p>
          </div>
        ) : (
          <>
            <div className="admissions-lab-inbox-toolbar">
              <div className="admissions-lab-field">
                <label htmlFor="admissions-demo-reference-search">Buscar referencia demo</label>
                <input
                  autoComplete="off"
                  id="admissions-demo-reference-search"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ej. DEMO-0001"
                  type="search"
                  value={query}
                />
              </div>
              <div className="admissions-lab-field">
                <label htmlFor="admissions-demo-status-filter">Filtrar por estado</label>
                <select
                  id="admissions-demo-status-filter"
                  onChange={(event) => setStatusFilter(event.target.value as AdmissionsDemoReviewStatus | '')}
                  value={statusFilter}
                >
                  <option value={ALL_STATUSES}>Todos los estados</option>
                  {Object.entries(STATUS_LABELS).map(([status, label]) => (
                    <option key={status} value={status}>{label}</option>
                  ))}
                </select>
              </div>
              <span className="admissions-lab-result-count" role="status">
                {visibleApplications.length} {visibleApplications.length === 1 ? 'ficha demo' : 'fichas demo'}
              </span>
            </div>

            {visibleApplications.length === 0 ? (
              <div className="admissions-lab-empty-state" role="status">
                <h3>No hay fichas para estos filtros</h3>
                <p>Cambia la búsqueda o selecciona otro estado de demostración.</p>
              </div>
            ) : (
              <div className="admissions-lab-review-layout">
                <div className="admissions-lab-case-list" aria-label="Resultados de la bandeja demo">
                  {visibleApplications.map((application) => (
                    <article
                      className={`admissions-lab-case-card${selectedApplication?.reference === application.reference ? ' is-selected' : ''}`}
                      key={application.reference}
                      aria-label={`Ficha ${application.reference}`}
                    >
                      <div className="admissions-lab-case-topline">
                        <span className="admissions-lab-case-reference">{application.reference}</span>
                        <span className={`admissions-lab-status admissions-lab-status-${application.status.toLowerCase()}`}>
                          <span aria-hidden="true" />{STATUS_LABELS[application.status]}
                        </span>
                      </div>
                      <div className="admissions-lab-case-options">
                        <div><small>Primera opción</small><strong>{getProgramLabel(application.firstChoiceId)}</strong></div>
                        <span className="admissions-lab-choice-arrow" aria-hidden="true">→</span>
                        <div><small>Segunda opción</small><strong>{getProgramLabel(application.secondChoiceId)}</strong></div>
                      </div>
                      <div className="admissions-lab-case-footer">
                        <span>Ficha sintética · sin identidad personal</span>
                        <button
                          aria-label={`Ver detalle de ${application.reference}`}
                          aria-pressed={selectedApplication?.reference === application.reference}
                          className="admissions-lab-secondary-button"
                          onClick={() => setSelectedReference(application.reference)}
                          type="button"
                        >
                          Ver detalle
                        </button>
                      </div>
                    </article>
                  ))}
                </div>

                {selectedApplication && (
                  <section className="admissions-lab-review-detail" aria-label={`Detalle de ficha ${selectedApplication.reference}`}>
                    <div className="admissions-lab-review-detail-heading">
                      <div>
                        <p className="admissions-lab-eyebrow">DETALLE · DATOS DE EJEMPLO</p>
                        <h3>{selectedApplication.reference}</h3>
                      </div>
                      <span className={`admissions-lab-status admissions-lab-status-${selectedApplication.status.toLowerCase()}`}>
                        <span aria-hidden="true" />{STATUS_LABELS[selectedApplication.status]}
                      </span>
                    </div>

                    <dl className="admissions-lab-review-options">
                      <div><dt>Primera opción ficticia</dt><dd>{getProgramLabel(selectedApplication.firstChoiceId)}</dd></div>
                      <div><dt>Segunda opción ficticia</dt><dd>{getProgramLabel(selectedApplication.secondChoiceId)}</dd></div>
                    </dl>

                    <div className="admissions-lab-review-checklist">
                      <p className="admissions-lab-eyebrow">COMPROBACIONES DEL EJERCICIO</p>
                      <ul>
                        <li><span aria-hidden="true">✓</span> Dos opciones ficticias diferentes</li>
                        <li><span aria-hidden="true">—</span> No se solicitan documentos ni datos personales</li>
                      </ul>
                    </div>

                    <div className="admissions-lab-review-action" aria-live="polite">
                      {selectedApplication.status === 'DEMO_RECEIVED' && (
                        <>
                          <p>Comienza una revisión local de este caso de ejemplo.</p>
                          <button
                            className="admissions-lab-primary-button"
                            onClick={() => store.getState().startReview(selectedApplication.reference)}
                            type="button"
                          >
                            Iniciar revisión demo
                          </button>
                        </>
                      )}

                      {selectedApplication.status === 'DEMO_REVIEWING' && (
                        <form className="admissions-lab-correction-form" noValidate onSubmit={onRequestCorrection}>
                          <div className="admissions-lab-field">
                            <label htmlFor="admissions-demo-correction-reason">Motivo de ajuste demo</label>
                            <select
                              aria-describedby={errors.correctionReason ? 'admissions-demo-correction-error' : undefined}
                              aria-invalid={Boolean(errors.correctionReason)}
                              id="admissions-demo-correction-reason"
                              {...register('correctionReason', { required: 'Elige un motivo de demostración.' })}
                            >
                              <option value="">Selecciona un motivo de ejemplo</option>
                              {ADMISSIONS_DEMO_CORRECTION_REASONS.map((reason) => (
                                <option key={reason.id} value={reason.id}>{reason.label}</option>
                              ))}
                            </select>
                            {errors.correctionReason && (
                              <p className="admissions-lab-field-error" id="admissions-demo-correction-error" role="alert">
                                {errors.correctionReason.message}
                              </p>
                            )}
                          </div>
                          <p>La solicitud es fija y ficticia; no escribas observaciones reales ni datos personales.</p>
                          <button className="admissions-lab-primary-button" type="submit">Solicitar ajuste demo</button>
                          <button
                            className="admissions-lab-secondary-button"
                            onClick={() => store.getState().completeReview(selectedApplication.reference)}
                            type="button"
                          >
                            Finalizar revisión demo
                          </button>
                        </form>
                      )}

                      {selectedApplication.status === 'DEMO_CORRECTION_REQUESTED' && (
                        <>
                          <p role="status">Solicitud de corrección enviada a la perspectiva aspirante de este ejercicio.</p>
                          {selectedApplication.correctionReason && (
                            <p>
                              <strong>Motivo de ajuste solicitado:</strong>{' '}
                              {getAdmissionsDemoCorrectionReasonLabel(selectedApplication.correctionReason)}
                            </p>
                          )}
                        </>
                      )}

                      {selectedApplication.status === 'DEMO_CORRECTION_SUBMITTED' && (
                        <>
                          <p role="status">Respuesta demo recibida; puedes continuar la revisión de ejemplo.</p>
                          <button
                            className="admissions-lab-primary-button"
                            onClick={() => store.getState().resumeReview(selectedApplication.reference)}
                            type="button"
                          >
                            Reanudar revisión demo
                          </button>
                        </>
                      )}

                      {selectedApplication.status === 'DEMO_REVIEW_COMPLETE' && (
                        <p role="status">Revisión de ejemplo finalizada · sin decisión de admisión.</p>
                      )}
                    </div>
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </section>
  )
}
