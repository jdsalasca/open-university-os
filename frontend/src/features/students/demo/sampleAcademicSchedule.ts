export type Weekday = 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado' | 'Domingo'
export type DayFilter = 'Toda la semana' | Weekday

export interface SampleMeeting {
  id: string
  weekday: Weekday
  startTime: string
  endTime: string
  room: string
}

export interface SampleSubject {
  id: string
  name: string
  code: string
  instructor: string
  meetings: readonly SampleMeeting[]
}

export interface SampleSession extends SampleMeeting {
  course: string
  code: string
  instructor: string
}

export const WEEKDAYS: readonly Weekday[] = [
  'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo',
]

// Fictional fixtures shared by both local views; never use them as UPTC or enrollment data.
export const SAMPLE_SUBJECTS: readonly SampleSubject[] = [
  {
    id: 'foundations', name: 'Fundamentos de muestra', code: 'DEMO-101', instructor: 'Docente de ejemplo 1',
    meetings: [{ id: 'lecture', weekday: 'Lunes', startTime: '08:00', endTime: '09:30', room: 'Aula de muestra 01' }],
  },
  {
    id: 'laboratory', name: 'Laboratorio de ejemplo', code: 'DEMO-202', instructor: 'Docente de ejemplo 2',
    meetings: [{ id: 'lab', weekday: 'Lunes', startTime: '10:00', endTime: '11:30', room: 'Taller de muestra 02' }],
  },
  {
    id: 'reading', name: 'Lectura académica de muestra', code: 'DEMO-305', instructor: 'Docente de ejemplo 3',
    meetings: [{ id: 'seminar', weekday: 'Martes', startTime: '09:00', endTime: '10:30', room: 'Aula de muestra 03' }],
  },
  {
    id: 'project', name: 'Proyecto en equipo de muestra', code: 'DEMO-408', instructor: 'Docente de ejemplo 4',
    meetings: [{ id: 'workshop', weekday: 'Miércoles', startTime: '13:00', endTime: '14:30', room: 'Sala de muestra 04' }],
  },
  {
    id: 'systems', name: 'Diseño de sistemas de muestra', code: 'DEMO-411', instructor: 'Docente de ejemplo 5',
    meetings: [
      { id: 'lecture', weekday: 'Jueves', startTime: '10:00', endTime: '11:30', room: 'Aula de muestra 05' },
      { id: 'workshop', weekday: 'Viernes', startTime: '12:00', endTime: '13:30', room: 'Laboratorio de muestra 07' },
    ],
  },
  {
    id: 'reflection', name: 'Cierre y reflexión de muestra', code: 'DEMO-512', instructor: 'Docente de ejemplo 6',
    meetings: [{ id: 'seminar', weekday: 'Viernes', startTime: '08:30', endTime: '10:00', room: 'Sala de muestra 06' }],
  },
]

export function listSampleSessions(subjects: readonly SampleSubject[] = SAMPLE_SUBJECTS): SampleSession[] {
  const weekdayOrder = new Map(WEEKDAYS.map((weekday, index) => [weekday, index]))

  return subjects
    .flatMap((subject) => subject.meetings.map((meeting) => ({
      ...meeting,
      id: `${subject.id}-${meeting.id}`,
      course: subject.name,
      code: subject.code,
      instructor: subject.instructor,
    })))
    .sort((left, right) =>
      (weekdayOrder.get(left.weekday) ?? 0) - (weekdayOrder.get(right.weekday) ?? 0)
      || left.startTime.localeCompare(right.startTime))
}
