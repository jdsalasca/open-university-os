import { useState } from 'react'
import type { AdmissionsMilestone, PublicAdmissionsCalendar } from './admissionsContracts'
import { downloadAdmissionsCalendar } from './admissionsCalendarIcs'
import { OFFICIAL_ADMISSIONS_CALENDAR_2027_I } from './official2027ICalendar'
import './AdmissionsCalendarPage.scss'

interface AdmissionsCalendarPageProps {
  calendar?: PublicAdmissionsCalendar
}

const KIND_LABELS: Record<AdmissionsMilestone['kind'], string> = {
  application: 'Inscripción',
  selection: 'Selección',
  enrollment: 'Registro y matrícula',
}

export function AdmissionsCalendarPage({
  calendar = OFFICIAL_ADMISSIONS_CALENDAR_2027_I,
}: AdmissionsCalendarPageProps) {
  const isPublishedCall = calendar.revisionNumber !== undefined
  const [downloadFailed, setDownloadFailed] = useState(false)

  function handleDownload() {
    try {
      setDownloadFailed(false)
      downloadAdmissionsCalendar(calendar)
    } catch {
      setDownloadFailed(true)
    }
  }

  return (
    <section className="admissions-page" aria-label="Admisiones de pregrado presencial">
      <div className="admissions-hero">
        <div className="admissions-hero-copy">
          <p className="admissions-eyebrow"><span aria-hidden="true" /> INFORMACIÓN PÚBLICA · UPTC</p>
          <h1>{calendar.title ?? 'Pregrado presencial 2027-I'}</h1>
          <p className="admissions-intro">
            Una guía de fechas para seguir la convocatoria de la UPTC. Confirma requisitos y novedades directamente con ACRA antes de cada paso.
          </p>
          <div className="admissions-source-stamp">
            <span className="admissions-source-dot" aria-hidden="true" />
            <span>Fuente {calendar.source.label} · actualizada el {calendar.updatedAt} · consultada el {calendar.checkedAt}</span>
          </div>
          <div className="admissions-hero-actions">
            <button
              className="admissions-calendar-download"
              type="button"
              onClick={handleDownload}
            >
              Descargar fechas oficiales (.ics)
            </button>
            {downloadFailed && (
              <p className="admissions-download-note" role="status">
                No fue posible generar el archivo del calendario. Verifica la convocatoria publicada e inténtalo de nuevo.
              </p>
            )}
            <a className="admissions-primary-link" href={calendar.source.url} target="_blank" rel="noreferrer">
              Consultar {calendar.source.label} <span aria-hidden="true">↗</span>
            </a>
          </div>
          <p className="admissions-download-note">Copia personal de las fechas publicadas. Verifica cambios en ACRA.</p>
        </div>

        <aside className="admissions-call-card" aria-label={isPublishedCall ? 'Convocatoria publicada' : 'Convocatoria vigente'}>
          <span className="admissions-call-card-label">CONVOCATORIA · PREGRADO PRESENCIAL</span>
          <strong>{isPublishedCall ? 'Publicada' : <>2027<span>—</span>I</>}</strong>
          <span className="admissions-call-card-name">{calendar.callName}</span>
          <span className="admissions-call-card-rule" aria-hidden="true" />
          <span className="admissions-call-card-note">Calendario publicado por la Universidad</span>
        </aside>
      </div>

      <div className="admissions-operation-note" role="note">
        <span className="admissions-note-icon" aria-hidden="true">i</span>
        <p><strong>Esta pantalla informa; no recibe inscripciones.</strong> La plataforma y los trámites operativos deben consultarse en los enlaces oficiales de UPTC.</p>
      </div>

      <section className="admissions-timeline-section" aria-labelledby="admissions-timeline-title">
        <div className="admissions-section-heading">
          <div>
            <p className="admissions-eyebrow"><span aria-hidden="true" /> RUTA DE LA CONVOCATORIA</p>
            <h2 id="admissions-timeline-title">Fechas clave</h2>
          </div>
          <span className="admissions-count">{calendar.milestones.length.toString().padStart(2, '0')} hitos</span>
        </div>

        <ol className="admissions-timeline">
          {calendar.milestones.map((milestone, index) => (
            <li className={`admissions-timeline-item is-${milestone.kind}`} key={milestone.id}>
              <span className="admissions-timeline-index" aria-hidden="true">{(index + 1).toString().padStart(2, '0')}</span>
              <div className="admissions-milestone-card">
                <div className="admissions-milestone-date">{milestone.dateLabel}</div>
                <div className="admissions-milestone-content">
                  <span className="admissions-milestone-kind">{KIND_LABELS[milestone.kind]}</span>
                  <h3>{milestone.title}</h3>
                  <p>{milestone.description}</p>
                </div>
                <span className="admissions-milestone-arrow" aria-hidden="true">↗</span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="admissions-checklist-grid">
        <section className="admissions-checklist" aria-labelledby="admissions-before-title">
          <p className="admissions-eyebrow"><span aria-hidden="true" /> ANTES DE INSCRIBIRTE</p>
          <h2 id="admissions-before-title">Revisa tus datos</h2>
          <p>ACRA indica que debes contar con los resultados de Saber 11. Verifica que el código SNP, los nombres y los apellidos coincidan con el registro del ICFES.</p>
          <span className="admissions-checklist-footnote">Consulta los requisitos completos en la fuente oficial.</span>
        </section>
        <section className="admissions-official-source" aria-labelledby="admissions-source-title">
          <span className="admissions-source-seal" aria-hidden="true">U</span>
          <div>
            <p className="admissions-eyebrow">FUENTE Y SEGUIMIENTO</p>
            <h2 id="admissions-source-title">Mantente al día con UPTC</h2>
            <p>Las fechas pueden tener ajustes. Consulta el acto enlazado por ACRA y el comunicado institucional antes de realizar cualquier trámite.</p>
            {calendar.officialActSource && (
              <a href={calendar.officialActSource.url} target="_blank" rel="noreferrer">
                Consultar {calendar.officialActSource.label} <span aria-hidden="true">↗</span>
              </a>
            )}
            <a href={calendar.confirmationSource.url} target="_blank" rel="noreferrer">
              {calendar.confirmationSource.label} <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>
      </div>
    </section>
  )
}
