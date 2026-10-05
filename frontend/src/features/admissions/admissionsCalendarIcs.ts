import type { AdmissionsMilestone, PublicAdmissionsCalendar } from './admissionsContracts'

const MILESTONE_CATEGORIES: Record<AdmissionsMilestone['kind'], string> = {
  application: 'Inscripción',
  selection: 'Selección',
  enrollment: 'Registro y matrícula',
}

export function createAdmissionsCalendarIcs(
  calendar: PublicAdmissionsCalendar,
  generatedAt: Date = new Date(),
): string {
  if (Number.isNaN(generatedAt.getTime())) {
    throw new RangeError('La fecha de generación del calendario no es válida.')
  }

  const timestamp = generatedAt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  const callScope = createCallScope(calendar)
  const eventIds = new Set<string>()
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//Universiry//Agenda pública UPTC ${escapeText(calendar.callName)}//ES`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(`UPTC · ${calendar.callName}`)}`,
  ]

  for (const milestone of calendar.milestones) {
    if (!/^[a-z0-9-]+$/.test(milestone.id) || eventIds.has(milestone.id)) {
      throw new RangeError('Cada hito debe tener un identificador único en minúsculas.')
    }
    eventIds.add(milestone.id)

    const startsOn = parseCalendarDate(milestone.startsOn)
    const endsOn = parseCalendarDate(milestone.endsOn)
    if (startsOn.getTime() > endsOn.getTime()) {
      throw new RangeError(`El hito ${milestone.id} termina antes de comenzar.`)
    }

    const exclusiveEnd = new Date(endsOn)
    exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1)
    const description = [
      milestone.description,
      `Fuente oficial: ${calendar.source.url}`,
      'Instantánea descargada; confirma cambios directamente con ACRA.',
    ].join('\n')

    lines.push(
      'BEGIN:VEVENT',
      `UID:${callScope}-${milestone.id}@admisiones.universiry.local`,
      `DTSTAMP:${timestamp}`,
      `DTSTART;VALUE=DATE:${formatCalendarDate(startsOn)}`,
      `DTEND;VALUE=DATE:${formatCalendarDate(exclusiveEnd)}`,
      `SUMMARY:${escapeText(milestone.title)}`,
      `DESCRIPTION:${escapeText(description)}`,
      `CATEGORIES:${escapeText(MILESTONE_CATEGORIES[milestone.kind])}`,
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  return `${lines.map(foldLine).join('\r\n')}\r\n`
}

export function downloadAdmissionsCalendar(calendar: PublicAdmissionsCalendar): void {
  const filename = createAdmissionsCalendarFilename(calendar)
  const content = createAdmissionsCalendarIcs(calendar)
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  link.hidden = true
  document.body.append(link)

  try {
    link.click()
  } finally {
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
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

function parseCalendarDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RangeError(`La fecha ${value} debe usar el formato AAAA-MM-DD.`)
  }

  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new RangeError(`La fecha ${value} no existe.`)
  }
  return date
}

function formatCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '')
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function foldLine(line: string): string {
  const encoder = new TextEncoder()
  const physicalLines: string[] = []
  let currentLine = ''
  let currentBytes = 0

  for (const character of line) {
    const characterBytes = encoder.encode(character).byteLength
    if (currentBytes + characterBytes > 75) {
      physicalLines.push(currentLine)
      currentLine = ` ${character}`
      currentBytes = 1 + characterBytes
    } else {
      currentLine += character
      currentBytes += characterBytes
    }
  }

  physicalLines.push(currentLine)
  return physicalLines.join('\r\n')
}
