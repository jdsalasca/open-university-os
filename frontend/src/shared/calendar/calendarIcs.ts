export interface CalendarIcsEvent {
  id: string
  title: string
  description: string
  startsOn: string
  endsOn: string
  category: string
}

export interface CalendarIcsDocument {
  name: string
  uidScope: string
  uidDomain?: string
  filename: string
  sourceUrl: string
  sourceNotice: string
  events: readonly CalendarIcsEvent[]
}

export function createCalendarIcs(calendar: CalendarIcsDocument, generatedAt: Date = new Date()): string {
  if (Number.isNaN(generatedAt.getTime())) {
    throw new RangeError('La fecha de generación del calendario no es válida.')
  }

  const name = calendar.name.trim()
  const source = parseSourceUrl(calendar.sourceUrl)
  if (!name || !/^[a-z0-9-]+$/.test(calendar.uidScope)) {
    throw new RangeError('El calendario necesita un nombre y un identificador seguros.')
  }
  const uidDomain = calendar.uidDomain ?? 'universiry.local'
  if (!/^[a-z0-9.-]+$/.test(uidDomain) || uidDomain.startsWith('.') || uidDomain.endsWith('.')) {
    throw new RangeError('El dominio de identificadores del calendario no es válido.')
  }
  if (!/^[a-z0-9-]+\.ics$/.test(calendar.filename)) {
    throw new RangeError('El nombre del archivo del calendario no es válido.')
  }

  const timestamp = generatedAt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  const eventIds = new Set<string>()
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//Universiry//Agenda pública UPTC ${escapeText(name)}//ES`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(`UPTC · ${name}`)}`,
  ]

  for (const event of calendar.events) {
    if (!/^[a-z0-9-]+$/.test(event.id) || eventIds.has(event.id)) {
      throw new RangeError('Cada hito debe tener un identificador único en minúsculas.')
    }
    if (!event.title.trim()) {
      throw new RangeError(`El hito ${event.id} necesita un título.`)
    }
    eventIds.add(event.id)

    const startsOn = parseCalendarDate(event.startsOn)
    const endsOn = parseCalendarDate(event.endsOn)
    if (startsOn.getTime() > endsOn.getTime()) {
      throw new RangeError(`El hito ${event.id} termina antes de comenzar.`)
    }

    const exclusiveEnd = new Date(endsOn)
    exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1)
    const description = [
      event.description,
      `Fuente oficial: ${source.toString()}`,
      calendar.sourceNotice,
    ].filter(Boolean).join('\n')

    lines.push(
      'BEGIN:VEVENT',
      `UID:${calendar.uidScope}-${event.id}@${uidDomain}`,
      `DTSTAMP:${timestamp}`,
      `DTSTART;VALUE=DATE:${formatCalendarDate(startsOn)}`,
      `DTEND;VALUE=DATE:${formatCalendarDate(exclusiveEnd)}`,
      `SUMMARY:${escapeText(event.title)}`,
      `DESCRIPTION:${escapeText(description)}`,
      `CATEGORIES:${escapeText(event.category)}`,
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  return `${lines.map(foldLine).join('\r\n')}\r\n`
}

export function downloadCalendarIcs(calendar: CalendarIcsDocument): void {
  const content = createCalendarIcs(calendar)
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = calendar.filename
  link.hidden = true
  document.body.append(link)

  try {
    link.click()
  } finally {
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
  }
}

function parseSourceUrl(value: string): URL {
  try {
    const source = new URL(value)
    if (source.protocol !== 'https:') throw new RangeError('La fuente del calendario debe usar HTTPS.')
    return source
  } catch (error) {
    if (error instanceof RangeError) throw error
    throw new RangeError('La fuente del calendario debe ser una URL HTTPS válida.')
  }
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
      const carrySpace = currentLine.endsWith(' ')
      if (carrySpace) {
        currentLine = currentLine.slice(0, -1)
        currentBytes -= 1
      }
      physicalLines.push(currentLine)
      currentLine = `${carrySpace ? '  ' : ' '}${character}`
      currentBytes = (carrySpace ? 2 : 1) + characterBytes
    } else {
      currentLine += character
      currentBytes += characterBytes
    }
  }

  physicalLines.push(currentLine)
  return physicalLines.join('\r\n')
}
