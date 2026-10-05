import { describe, expect, it } from 'vitest'
import { createAdmissionsCalendarIcs } from './admissionsCalendarIcs'
import { OFFICIAL_ADMISSIONS_CALENDAR_2027_I } from './official2027ICalendar'

const GENERATED_AT = new Date('2026-10-01T17:00:00Z')

function unfold(calendar: string): string {
  return calendar.replace(/\r\n /g, '')
}

describe('createAdmissionsCalendarIcs event identity', () => {
  it('keeps event identifiers unique across different published calls', () => {
    // Arrange
    const otherCall = {
      ...OFFICIAL_ADMISSIONS_CALENDAR_2027_I,
      title: 'Pregrado presencial 2028-I',
      callName: 'Primer semestre académico de 2028',
    }

    // Act
    const first = unfold(createAdmissionsCalendarIcs(OFFICIAL_ADMISSIONS_CALENDAR_2027_I, GENERATED_AT))
    const second = unfold(createAdmissionsCalendarIcs(otherCall, GENERATED_AT))

    // Assert
    const uids = (calendar: string) => [...calendar.matchAll(/^UID:(.+)$/gm)].map((match) => match[1])
    const firstUids = uids(first)
    const secondUids = uids(second)
    expect(firstUids.length).toBeGreaterThan(0)
    expect(secondUids.length).toBe(firstUids.length)
    expect(new Set([...firstUids, ...secondUids]).size).toBe(firstUids.length + secondUids.length)
  })

  it('produces the same identifier for the same call and milestone across repeated downloads', () => {
    // Act
    const first = unfold(createAdmissionsCalendarIcs(OFFICIAL_ADMISSIONS_CALENDAR_2027_I, GENERATED_AT))
    const second = unfold(createAdmissionsCalendarIcs(OFFICIAL_ADMISSIONS_CALENDAR_2027_I,
      new Date('2026-10-05T09:30:00Z')))

    // Assert
    const uids = (calendar: string) => [...calendar.matchAll(/^UID:(.+)$/gm)].map((match) => match[1])
    expect(uids(first)).toEqual(uids(second))
  })
})
