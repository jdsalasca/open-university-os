import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCalendarIcs, downloadCalendarIcs, type CalendarIcsDocument } from './calendarIcs'

const SOURCE_URL = 'https://uptc.edu.co/calendario'

const CALENDAR: CalendarIcsDocument = {
  name: 'Pregrado presencial 2026-II',
  uidScope: 'pregrado-2026-ii',
  filename: 'uptc-pregrado-2026-ii.ics',
  sourceUrl: SOURCE_URL,
  sourceNotice: 'Instantánea informativa; confirma cambios con ACRA.',
  events: [
    {
      id: 'cancelacion-presencial',
      title: 'Cancelación, presencial; Acuerdo 032/2020',
      description: 'Fecha publicada para pregrado presencial.',
      startsOn: '2026-10-30',
      endsOn: '2026-10-30',
      category: 'Calendario académico',
    },
    {
      id: 'periodo-extraordinario',
      title: 'Matrícula extraordinaria',
      description: 'Estudiantes sin beneficio de gratuidad.',
      startsOn: '2026-10-09',
      endsOn: '2026-10-13',
      category: 'Matrícula',
    },
  ],
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('createCalendarIcs', () => {
  it('serializes date-only events with inclusive visible ends and source attribution', () => {
    // Arrange
    const generatedAt = new Date('2026-10-05T15:30:00.000Z')

    // Act
    const result = createCalendarIcs(CALENDAR, generatedAt)
    const unfolded = result.replace(/\r\n /g, '')

    // Assert
    expect(unfolded).toContain('DTSTAMP:20261005T153000Z')
    expect(unfolded).toContain('UID:pregrado-2026-ii-cancelacion-presencial@universiry.local')
    expect(unfolded).toContain('DTSTART;VALUE=DATE:20261030\r\nDTEND;VALUE=DATE:20261031')
    expect(unfolded).toContain('DTSTART;VALUE=DATE:20261009\r\nDTEND;VALUE=DATE:20261014')
    expect(unfolded).toContain('Fuente oficial: https://uptc.edu.co/calendario')
    expect(unfolded).toContain('Instantánea informativa\\; confirma cambios con ACRA.')
    expect(unfolded).toContain(String.raw`SUMMARY:Cancelación\, presencial\; Acuerdo 032/2020`)
    expect(result).toMatch(/\r\nEND:VCALENDAR\r\n$/)
  })

  it('folds long escaped text at the UTF-8 byte limit without splitting accents', () => {
    // Arrange
    const longCalendar = {
      ...CALENDAR,
      events: [{
        ...CALENDAR.events[0],
        title: 'Calendario, pregrado; 2026-II\\ UPTC',
        description: `${'Información académica á '.repeat(14)}\nConfirma la fuente oficial.`,
      }],
    }

    // Act
    const result = createCalendarIcs(longCalendar, new Date('2026-10-05T15:30:00Z'))
    const unfolded = result.replace(/\r\n /g, '')
    const physicalLines = result.split('\r\n').filter(Boolean)

    // Assert
    expect(unfolded).toContain('SUMMARY:Calendario\\, pregrado\\; 2026-II\\\\ UPTC')
    expect(unfolded).toContain('Información académica á Información académica á')
    expect(unfolded).toContain('Confirma la fuente oficial.')
    expect(physicalLines.every((line) => new TextEncoder().encode(line).byteLength <= 75)).toBe(true)
    expect(physicalLines.every((line) => !line.endsWith(' '))).toBe(true)
  })

  it('preserves a word-boundary space without leaving whitespace at the fold', () => {
    // Arrange
    const title = `${'a'.repeat(66)} b`
    const calendar = {
      ...CALENDAR,
      events: [{ ...CALENDAR.events[0], title }],
    }

    // Act
    const result = createCalendarIcs(calendar, new Date('2026-10-05T15:30:00Z'))
    const unfolded = result.replace(/\r\n /g, '')
    const physicalLines = result.split('\r\n').filter(Boolean)

    // Assert
    expect(unfolded).toContain(`SUMMARY:${title}`)
    expect(physicalLines.every((line) => !line.endsWith(' '))).toBe(true)
  })

  it('rejects duplicate identifiers, malformed dates, reversed intervals and unsafe sources', () => {
    // Arrange
    const duplicateIds = { ...CALENDAR, events: [CALENDAR.events[0], { ...CALENDAR.events[1], id: CALENDAR.events[0].id }] }
    const malformedDate = { ...CALENDAR, events: [{ ...CALENDAR.events[0], startsOn: '2026-02-30' }] }
    const reversedDates = { ...CALENDAR, events: [{ ...CALENDAR.events[0], startsOn: '2026-10-31', endsOn: '2026-10-30' }] }
    const unsafeSource = { ...CALENDAR, sourceUrl: 'javascript:alert(1)' }

    // Act / Assert
    expect(() => createCalendarIcs(duplicateIds)).toThrow(RangeError)
    expect(() => createCalendarIcs(malformedDate)).toThrow(RangeError)
    expect(() => createCalendarIcs(reversedDates)).toThrow(RangeError)
    expect(() => createCalendarIcs(unsafeSource)).toThrow(RangeError)
  })
})

describe('downloadCalendarIcs', () => {
  it('downloads the named calendar and releases the temporary blob URL', () => {
    // Arrange
    const createObjectURL = vi.fn().mockReturnValue('blob:uptc-academic-calendar')
    const revokeObjectURL = vi.fn()
    const MockURL = class extends URL {}
    Object.assign(MockURL, { createObjectURL, revokeObjectURL })
    vi.stubGlobal('URL', MockURL)
    vi.useFakeTimers()
    let fileName = ''
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      fileName = this.download
    })

    // Act
    downloadCalendarIcs(CALENDAR)

    // Assert
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob)
    expect((createObjectURL.mock.calls[0][0] as Blob).type).toBe('text/calendar;charset=utf-8')
    expect(click).toHaveBeenCalledOnce()
    expect(fileName).toBe('uptc-pregrado-2026-ii.ics')
    vi.advanceTimersByTime(0)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:uptc-academic-calendar')
  })
})
