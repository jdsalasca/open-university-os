import type { AdmissionsMilestone, PublicAdmissionsCalendar } from './admissionsContracts'
import { createCalendarIcs, downloadCalendarIcs, type CalendarIcsDocument } from '../../shared/calendar/calendarIcs'

const MILESTONE_CATEGORIES: Record<AdmissionsMilestone['kind'], string> = {
  application: 'Inscripción',
  selection: 'Selección',
  enrollment: 'Registro y matrícula',
}
export function createAdmissionsCalendarIcs(
  calendar: PublicAdmissionsCalendar,
  generatedAt: Date = new Date(),
): string {
  return createCalendarIcs(createAdmissionsCalendarDocument(calendar), generatedAt)
}

export function downloadAdmissionsCalendar(calendar: PublicAdmissionsCalendar): void {
  downloadCalendarIcs(createAdmissionsCalendarDocument(calendar))
}

function createAdmissionsCalendarDocument(calendar: PublicAdmissionsCalendar): CalendarIcsDocument {
  return {
    name: calendar.callName.trim() || calendar.title?.trim() || '',
    uidScope: createCallScope(calendar),
    uidDomain: 'admisiones.universiry.local',
    filename: createAdmissionsCalendarFilename(calendar),
    sourceUrl: calendar.source.url,
    sourceNotice: 'Copia descargada; verifica los cambios en los enlaces oficiales de admisiones de UPTC.',
    events: calendar.milestones.map((milestone) => ({
      ...milestone,
      category: MILESTONE_CATEGORIES[milestone.kind],
    })),
  }
}

function createCallScope(calendar: PublicAdmissionsCalendar): string {
  const source = calendar.callName.trim() || calendar.title?.trim() || ''
  const scope = source
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (!scope) {
    throw new RangeError('La convocatoria necesita un nombre para identificar sus eventos.')
  }
  return scope
}

function createAdmissionsCalendarFilename(calendar: PublicAdmissionsCalendar): string {
  const calendarName = calendar.title?.trim() || calendar.callName.trim()
  const slug = calendarName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (!slug) {
    throw new RangeError('La convocatoria necesita un nombre para generar el archivo ICS.')
  }

  return `uptc-${slug}.ics`
}
