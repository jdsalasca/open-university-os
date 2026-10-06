import { useState } from 'react'
import { downloadCalendarIcs } from '../../shared/calendar/calendarIcs'
import {
  STUDENT_ACADEMIC_CALENDAR_2026_II_CHECKED_ON,
  STUDENT_ACADEMIC_CALENDAR_2026_II_EVENTS,
  STUDENT_ACADEMIC_CALENDAR_2026_II_ICS,
  STUDENT_ACADEMIC_CALENDAR_2026_II_UPDATED_ON,
  UPTC_ACRA_UNDERGRADUATE_CALENDAR_URL,
} from './studentAcademicCalendar2026IISnapshot'
import './StudentAcademicCalendar2026II.scss'

const SOURCE_UPDATED_LABEL = '17 sep 2026'
type CalendarRange = 'CURRENT_AND_UPCOMING' | 'ALL'

export function StudentAcademicCalendar2026II() {
  const [range, setRange] = useState<CalendarRange>('CURRENT_AND_UPCOMING')
  const todayInColombia = getCalendarDateInColombia()
  const currentAndUpcomingEvents = STUDENT_ACADEMIC_CALENDAR_2026_II_EVENTS
    .filter((event) => event.endsOn >= todayInColombia)
  const visibleEvents = range === 'ALL'
    ? STUDENT_ACADEMIC_CALENDAR_2026_II_EVENTS
    : currentAndUpcomingEvents

  return (
    <section className="student-academic-calendar" aria-labelledby="student-academic-calendar-title">
      <div className="student-academic-calendar-heading">
        <div>
          <p className="student-services-eyebrow"><span aria-hidden="true">◷</span> Calendario académico · información pública</p>
          <h2 id="student-academic-calendar-title">Fechas académicas de pregrado · II semestre de 2026</h2>
          <p className="student-academic-calendar-summary">
            Agenda basada en la publicación de ACRA. Prioriza las fechas vigentes o próximas; puedes consultar el calendario completo.
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

      <div className="student-academic-calendar-filter">
        <div className="student-academic-calendar-filter-options" role="group" aria-label="Filtrar fechas académicas">
          <button
            aria-pressed={range === 'CURRENT_AND_UPCOMING'}
            onClick={() => setRange('CURRENT_AND_UPCOMING')}
            type="button"
          >
            Vigentes y próximas <span>{currentAndUpcomingEvents.length}</span>
          </button>
          <button
            aria-pressed={range === 'ALL'}
            onClick={() => setRange('ALL')}
            type="button"
          >
            Todas las fechas <span>{STUDENT_ACADEMIC_CALENDAR_2026_II_EVENTS.length}</span>
          </button>
        </div>
        <p className="student-academic-calendar-filter-status" role="status" aria-live="polite" aria-atomic="true">
          {range === 'ALL'
            ? `Se muestran las ${visibleEvents.length} fechas publicadas.`
            : `${visibleEvents.length} ${visibleEvents.length === 1 ? 'fecha' : 'fechas'} vigentes o próximas según el calendario publicado.`}
        </p>
      </div>

      {visibleEvents.length === 0 && (
        <div className="student-academic-calendar-empty">
          <p>No hay fechas vigentes o próximas en esta instantánea publicada.</p>
          <button onClick={() => setRange('ALL')} type="button">Mostrar las fechas publicadas</button>
        </div>
      )}

      <ol className="student-academic-calendar-events" aria-label="Hitos publicados por ACRA">
        {visibleEvents.map((event) => (
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
        El filtro usa la fecha de Colombia e incluye el día final publicado. La descarga conserva todas las fechas. Esta copia no confirma que un hito aplique a cada estudiante: verifica cambios y condiciones directamente con ACRA.
      </p>
    </section>
  )
}

function getCalendarDateInColombia(date: Date = new Date()): string {
  const dateParts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      calendar: 'gregory',
      day: '2-digit',
      month: '2-digit',
      timeZone: 'America/Bogota',
      year: 'numeric',
    }).formatToParts(date).map(({ type, value }) => [type, value]),
  )

  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`
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
