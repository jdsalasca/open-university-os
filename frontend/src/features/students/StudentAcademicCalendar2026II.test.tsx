import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as calendarIcs from '../../shared/calendar/calendarIcs'
import { StudentAcademicCalendar2026II } from './StudentAcademicCalendar2026II'
import { STUDENT_ACADEMIC_CALENDAR_2026_II_ICS } from './studentAcademicCalendar2026IISnapshot'

function renderCalendar() {
  render(<StudentAcademicCalendar2026II />)
  return screen.getByRole('region', { name: 'Fechas académicas de pregrado · II semestre de 2026' })
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  cleanup()
})

describe('StudentAcademicCalendar2026II', () => {
  it('prioritizes dates that are active or upcoming in Colombia and can show the full snapshot', async () => {
    // Arrange
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-07T02:00:00.000Z'))
    const calendar = renderCalendar()
    const events = within(calendar).getByRole('list', { name: 'Hitos publicados por ACRA' })

    // Act

    // Assert
    expect(events.querySelectorAll('li')).toHaveLength(13)
    expect(within(events).getByRole('heading', { name: 'Matrícula · estudiantes sin beneficio de gratuidad · ordinaria' })).toBeVisible()
    expect(within(events).queryByRole('heading', { name: 'Grados · primera fecha' })).not.toBeInTheDocument()

    // Act
    fireEvent.click(within(calendar).getByRole('button', { name: /todas las fechas/i }))

    // Assert
    expect(events.querySelectorAll('li')).toHaveLength(18)
    expect(within(events).getByRole('heading', { name: 'Grados · primera fecha' })).toBeVisible()
  })

  it('includes events on their final published date using the Colombia calendar day', () => {
    // Arrange
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-09T02:00:00.000Z'))
    const calendar = renderCalendar()
    const events = within(calendar).getByRole('list', { name: 'Hitos publicados por ACRA' })

    // Act

    // Assert
    expect(within(events).getByRole('heading', { name: 'Matrícula · estudiantes sin beneficio de gratuidad · ordinaria' })).toBeVisible()
  })

  it('keeps a published multi-day event visible while its end date has not passed', () => {
    // Arrange
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-11T18:00:00.000Z'))
    const calendar = renderCalendar()

    // Act

    // Assert
    expect(within(calendar).getByRole('heading', { name: 'Matrícula · estudiantes sin beneficio de gratuidad · extraordinaria' })).toBeVisible()
  })

  it('offers all published dates when the snapshot has no current or upcoming events', async () => {
    // Arrange
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-12-01T17:00:00.000Z'))
    const calendar = renderCalendar()

    // Act

    // Assert
    expect(within(calendar).getByRole('status')).toHaveTextContent(/0 fechas vigentes o próximas/i)
    expect(within(calendar).getByText(/no hay fechas vigentes o próximas/i)).toBeVisible()
    expect(within(calendar).getByRole('list', { name: 'Hitos publicados por ACRA' }).querySelectorAll('li')).toHaveLength(0)

    // Act
    fireEvent.click(within(calendar).getByRole('button', { name: /mostrar las fechas publicadas/i }))

    // Assert
    expect(within(calendar).getByRole('list', { name: 'Hitos publicados por ACRA' }).querySelectorAll('li')).toHaveLength(18)
  })

  it('exports all published calendar dates while the visible list is filtered', async () => {
    // Arrange
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-07T02:00:00.000Z'))
    const download = vi.spyOn(calendarIcs, 'downloadCalendarIcs').mockImplementation(() => {})
    const calendar = renderCalendar()

    // Act
    fireEvent.click(within(calendar).getByRole('button', { name: 'Descargar calendario (.ics)' }))

    // Assert
    expect(within(calendar).getByRole('list', { name: 'Hitos publicados por ACRA' }).querySelectorAll('li')).toHaveLength(13)
    expect(download).toHaveBeenCalledOnce()
    expect(download).toHaveBeenCalledWith(STUDENT_ACADEMIC_CALENDAR_2026_II_ICS)
    expect(download.mock.calls[0][0].events).toHaveLength(18)
  })
})
