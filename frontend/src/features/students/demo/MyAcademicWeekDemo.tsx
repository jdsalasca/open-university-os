import { useState } from 'react'
import type { DayFilter, SampleSession, SampleSubject } from './sampleAcademicSchedule'
import { listSampleSessions, SAMPLE_SUBJECTS, WEEKDAYS } from './sampleAcademicSchedule'
import './MyAcademicWeekDemo.scss'

type StudentView = 'week' | 'subjects'

const SAMPLE_SESSIONS = listSampleSessions()

export function MyAcademicWeekDemo() {
  const [view, setView] = useState<StudentView>('week')
  const [selectedDay, setSelectedDay] = useState<DayFilter>('Toda la semana')
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)
  const sessions = selectedDay === 'Toda la semana'
    ? SAMPLE_SESSIONS
    : SAMPLE_SESSIONS.filter((session) => session.weekday === selectedDay)
  const selectedSession = SAMPLE_SESSIONS.find((session) => session.id === selectedSessionId)
  const selectedSubject = SAMPLE_SUBJECTS.find((subject) => subject.id === selectedSubjectId)

  function changeView(nextView: StudentView) {
    if (nextView === view) return
    setView(nextView)
    setSelectedSessionId(null)
    setSelectedSubjectId(null)
  }

  return (
    <div className="student-week-demo">
      <header className="student-week-hero">
        <div className="student-week-hero-copy">
          <p className="student-week-eyebrow">EXPERIENCIA LOCAL · SOLO DESARROLLO</p>
          <h1>{view === 'week' ? 'Mi semana académica' : 'Mis asignaturas'}</h1>
          <p>{view === 'week'
            ? 'Explora una agenda ficticia y consulta encuentros por día.'
            : 'Explora materias y sus encuentros en este recorrido de ejemplo.'}</p>
        </div>
        <span className="student-week-demo-mark" aria-hidden="true">7<span>d</span></span>
      </header>

      <aside className="student-week-notice" role="note" aria-label="Alcance de esta demostración">
        <span className="student-week-notice-icon" aria-hidden="true">i</span>
        <span><strong>Datos ficticios.</strong> No reflejan matrícula, docentes ni horarios oficiales de la UPTC.</span>
      </aside>

      <div className="student-week-view-switcher" role="group" aria-label="Vistas académicas de ejemplo">
        <button
          aria-pressed={view === 'week'}
          className={view === 'week' ? 'is-active' : undefined}
          onClick={() => changeView('week')}
          type="button"
        >
          Mi semana
        </button>
        <button
          aria-pressed={view === 'subjects'}
          className={view === 'subjects' ? 'is-active' : undefined}
          onClick={() => changeView('subjects')}
          type="button"
        >
          Mis asignaturas
        </button>
      </div>

      {view === 'week' ? (
        <>
          <section className="student-week-overview" aria-label="Resumen de agenda de ejemplo">
            <div>
              <span className="student-week-overview-label">SEMANA DE EJEMPLO</span>
              <strong>Consulta por día</strong>
            </div>
            <p><strong>{SAMPLE_SESSIONS.length}</strong><span>encuentros ficticios</span></p>
          </section>

          <div className="student-week-filters" role="group" aria-label="Filtrar agenda por día">
            {(['Toda la semana', ...WEEKDAYS] as const).map((day) => (
              <button
                aria-pressed={selectedDay === day}
                className={selectedDay === day ? 'is-active' : undefined}
                key={day}
                onClick={() => {
                  setSelectedDay(day)
                  setSelectedSessionId(null)
                }}
                type="button"
              >
                {day}
              </button>
            ))}
          </div>

          <div className="student-week-layout">
            <SampleWeekAgenda
              onSelect={setSelectedSessionId}
              selectedDay={selectedDay}
              sessions={sessions}
            />
            <SampleSessionDetail session={selectedSession} />
          </div>
        </>
      ) : (
        <>
          <section className="student-week-overview" aria-label="Resumen de asignaturas de ejemplo">
            <div>
              <span className="student-week-overview-label">ASIGNATURAS DE EJEMPLO</span>
              <strong>Consulta cada materia</strong>
            </div>
            <p><strong>{SAMPLE_SUBJECTS.length}</strong><span>materias ficticias</span></p>
          </section>

          <div className="student-week-layout">
            <SampleSubjectList
              onSelect={setSelectedSubjectId}
              selectedSubjectId={selectedSubjectId}
              subjects={SAMPLE_SUBJECTS}
            />
            <SampleSubjectDetail subject={selectedSubject} />
          </div>
        </>
      )}
    </div>
  )
}

function SampleWeekAgenda({
  onSelect,
  selectedDay,
  sessions,
}: {
  onSelect: (id: string) => void
  selectedDay: DayFilter
  sessions: readonly SampleSession[]
}) {
  return (
    <section className="student-week-agenda" role="region" aria-label="Agenda semanal de ejemplo">
      <div className="student-week-section-heading">
        <div>
          <p className="student-week-eyebrow">AGENDA · DATOS DE MUESTRA</p>
          <h2>{selectedDay === 'Toda la semana' ? 'La semana, de un vistazo' : selectedDay}</h2>
        </div>
        <span className="student-week-session-count">{sessions.length} {sessions.length === 1 ? 'encuentro' : 'encuentros'}</span>
      </div>

      {sessions.length > 0 ? (
        <ol className="student-week-session-list">
          {sessions.map((session, index) => (
            <li key={session.id}>
              {selectedDay === 'Toda la semana' && (index === 0 || sessions[index - 1].weekday !== session.weekday) && (
                <h3 className="student-week-day-heading">{session.weekday}</h3>
              )}
              <article className="student-week-session-card">
                <div className="student-week-session-time">
                  <strong>{session.startTime}</strong>
                  <span>{session.endTime}</span>
                </div>
                <div className="student-week-session-copy">
                  <span className="student-week-session-code">{session.code}</span>
                  <h3>{session.course}</h3>
                  <p>{session.room} <span aria-hidden="true">·</span> {session.instructor}</p>
                </div>
                <button
                  aria-label={`Ver detalle de ${session.course.toLowerCase()}`}
                  className="student-week-detail-button"
                  onClick={() => onSelect(session.id)}
                  type="button"
                >
                  <span aria-hidden="true">↗</span>
                </button>
              </article>
            </li>
          ))}
        </ol>
      ) : (
        <div className="student-week-empty" role="status">
          <span aria-hidden="true">○</span>
          <strong>Un día tranquilo</strong>
          <p>No hay sesiones en este día de la agenda de ejemplo.</p>
        </div>
      )}
    </section>
  )
}

function SampleSubjectList({
  onSelect,
  selectedSubjectId,
  subjects,
}: {
  onSelect: (id: string) => void
  selectedSubjectId: string | null
  subjects: readonly SampleSubject[]
}) {
  return (
    <section className="student-week-agenda" role="region" aria-label="Asignaturas de ejemplo">
      <div className="student-week-section-heading">
        <div>
          <p className="student-week-eyebrow">MATERIAS · DATOS DE MUESTRA</p>
          <h2>Mis asignaturas</h2>
        </div>
        <span className="student-week-session-count">{subjects.length} {subjects.length === 1 ? 'materia' : 'materias'}</span>
      </div>

      {subjects.length > 0 ? (
        <ol className="student-subject-list">
          {subjects.map((subject) => (
            <li key={subject.id}>
              <button
                aria-label={`Ver asignatura: ${subject.name}`}
                aria-pressed={selectedSubjectId === subject.id}
                className={`student-subject-card${selectedSubjectId === subject.id ? ' is-active' : ''}`}
                onClick={() => onSelect(subject.id)}
                type="button"
              >
                <span className="student-week-session-code">{subject.code}</span>
                <strong>{subject.name}</strong>
                <span>{subject.meetings.length} {subject.meetings.length === 1 ? 'encuentro' : 'encuentros'} por semana</span>
                <span>{subject.instructor}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <div className="student-week-empty" role="status">
          <span aria-hidden="true">○</span>
          <strong>Sin asignaturas de ejemplo</strong>
          <p>Esta vista local no tiene materias ficticias para mostrar.</p>
        </div>
      )}
    </section>
  )
}

function SampleSessionDetail({ session }: { session: SampleSession | undefined }) {
  return (
    <section className="student-week-detail" role="region" aria-label="Detalle de la sesión seleccionada" aria-live="polite">
      {session ? (
        <>
          <p className="student-week-eyebrow">DETALLE · EJEMPLO</p>
          <span className="student-week-detail-code">{session.code}</span>
          <h2>{session.course}</h2>
          <dl>
            <div><dt>Día</dt><dd>{session.weekday}</dd></div>
            <div><dt>Hora</dt><dd>{session.startTime}–{session.endTime}</dd></div>
            <div><dt>Espacio</dt><dd>{session.room}</dd></div>
            <div><dt>Docente</dt><dd>{session.instructor}</dd></div>
          </dl>
          <p className="student-week-detail-note">Información inventada para esta demostración.</p>
        </>
      ) : (
        <DetailPlaceholder>Elige una sesión para consultar sus detalles de ejemplo.</DetailPlaceholder>
      )}
    </section>
  )
}

function SampleSubjectDetail({ subject }: { subject: SampleSubject | undefined }) {
  return (
    <section className="student-week-detail" role="region" aria-label="Detalle de la asignatura seleccionada" aria-live="polite">
      {subject ? (
        <>
          <p className="student-week-eyebrow">MATERIA · EJEMPLO</p>
          <span className="student-week-detail-code">{subject.code}</span>
          <h2>{subject.name}</h2>
          <dl>
            <div><dt>Docente de ejemplo</dt><dd>{subject.instructor}</dd></div>
            <div><dt>Encuentros por semana</dt><dd>{subject.meetings.length}</dd></div>
          </dl>
          <h3 className="student-subject-meetings-heading">Horario de ejemplo</h3>
          <ol className="student-subject-meetings">
            {subject.meetings.map((meeting) => (
              <li key={meeting.id}>
                <strong>{meeting.weekday}</strong>
                <span>{meeting.startTime}–{meeting.endTime}</span>
                <span>{meeting.room}</span>
              </li>
            ))}
          </ol>
          <p className="student-week-detail-note">Información inventada para esta demostración; no es una matrícula ni un horario oficial.</p>
        </>
      ) : (
        <DetailPlaceholder>Elige una asignatura para consultar sus detalles de ejemplo.</DetailPlaceholder>
      )}
    </section>
  )
}

function DetailPlaceholder({ children }: { children: string }) {
  return (
    <div className="student-week-detail-placeholder">
      <span aria-hidden="true">⌁</span>
      <p>{children}</p>
    </div>
  )
}
