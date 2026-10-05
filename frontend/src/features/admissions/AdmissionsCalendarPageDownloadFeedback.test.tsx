import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadAdmissionsCalendar } from './admissionsCalendarIcs'
import { AdmissionsCalendarPage } from './AdmissionsCalendarPage'

vi.mock('./admissionsCalendarIcs', () => ({ downloadAdmissionsCalendar: vi.fn() }))

afterEach(cleanup)

describe('AdmissionsCalendarPage download feedback', () => {
  it('announces when the calendar snapshot cannot be generated', () => {
    // Arrange
    vi.mocked(downloadAdmissionsCalendar).mockImplementationOnce(() => {
      throw new RangeError('Cada hito debe tener un identificador único en minúsculas.')
    })

    // Act
    render(<AdmissionsCalendarPage />)
    fireEvent.click(screen.getByRole('button', { name: /descargar fechas oficiales.*ics/i }))

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent(/no fue posible generar el archivo del calendario/i)
  })

  it('clears the announcement after a later download succeeds', () => {
    // Arrange
    vi.mocked(downloadAdmissionsCalendar)
      .mockImplementationOnce(() => {
        throw new RangeError('Cada hito debe tener un identificador único en minúsculas.')
      })
      .mockImplementationOnce(() => undefined)
    render(<AdmissionsCalendarPage />)
    const download = screen.getByRole('button', { name: /descargar fechas oficiales.*ics/i })

    // Act
    fireEvent.click(download)
    expect(screen.getByRole('status')).toHaveTextContent(/no fue posible generar/i)
    fireEvent.click(download)

    // Assert
    expect(screen.queryByText(/no fue posible generar/i)).not.toBeInTheDocument()
  })
})
