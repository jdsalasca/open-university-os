import { downloadCalendarIcs } from '../../shared/calendar/calendarIcs'
import {
  STUDENT_ACADEMIC_CALENDAR_2026_II_CHECKED_ON,
  STUDENT_ACADEMIC_CALENDAR_2026_II_EVENTS,
  STUDENT_ACADEMIC_CALENDAR_2026_II_ICS,
  STUDENT_ACADEMIC_CALENDAR_2026_II_UPDATED_ON,
  UPTC_ACRA_UNDERGRADUATE_CALENDAR_URL,
} from './studentAcademicCalendar2026IISnapshot'

const SOURCE_UPDATED_LABEL = '17 sep 2026'

export function StudentAcademicCalendar2026II() {
  return (
    <section className="student-academic-calendar" aria-labelledby="student-academic-calendar-title">
      <div className="student-academic-calendar-heading">
        <div>
          <p className="student-services-eyebrow"><span aria-hidden="true">◷</span> Calendario académico · información pública</p>
          <h2 id="student-academic-calendar-title">Fechas académicas de pregrado · II semestre de 2026</h2>
          <p className="student-academic-calendar-summary">
            Agenda basada en la publicación de ACRA. Conserva las modalidades y poblaciones que aparecen en la fuente.
          </p>
        </div>
        <button
          className="student-academic-calendar-download"
          onClick={() => downloadCalendarIcs(STUDENT_ACADEMIC_CALENDAR_2026_II_ICS)}
          type="button"
        >
          Descargar calendario (.ics)
          <span aria-hidden="true">↓</span>
        </button>
      </div>

      <div className="student-academic-calendar-provenance">
        <p role="note">Instantánea informativa consultada el {formatLongDate(STUDENT_ACADEMIC_CALENDAR_2026_II_CHECKED_ON)}.</p>
        <small>
          Fuente oficial ACRA · <time dateTime={STUDENT_ACADEMIC_CALENDAR_2026_II_UPDATED_ON}>actualizada {SOURCE_UPDATED_LABEL}</time>
        </small>
        <a
          href={UPTC_ACRA_UNDERGRADUATE_CALENDAR_URL}
          rel="noopener noreferrer"
          target="_blank"
          aria-label="Consultar calendario oficial en ACRA"
        >
          Consultar calendario oficial en ACRA <span aria-hidden="true">↗</span>
        </a>
      </div>

      <ol className="student-academic-calendar-events" aria-label="Hitos publicados por ACRA">
        {STUDENT_ACADEMIC_CALENDAR_2026_II_EVENTS.map((event) => (
          <li className="student-academic-calendar-event" key={event.id}>
            <span className="student-academic-calendar-category">{event.category}</span>
            <h3>{event.title}</h3>
            <p>{event.description}</p>
            <p className="student-academic-calendar-date">
              <time dateTime={event.startsOn}>{formatDate(event.startsOn)}</time>
              {event.endsOn !== event.startsOn && (
                <> – <time dateTime={event.endsOn}>{formatDate(event.endsOn)}</time></>
              )}
            </p>
          </li>
        ))}
      </ol>
      <p className="student-academic-calendar-disclaimer">
        La descarga es una copia para tu calendario personal. No registra ni modifica trámites y no confirma que una fecha aplique a cada estudiante.
      </p>
    </section>
  )
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`)).replace(/\./g, '')
}

function formatLongDate(value: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`))
}
