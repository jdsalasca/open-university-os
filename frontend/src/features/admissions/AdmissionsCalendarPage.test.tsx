import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadAdmissionsCalendar } from './admissionsCalendarIcs'
import { AdmissionsCalendarPage } from './AdmissionsCalendarPage'
import { OFFICIAL_ADMISSIONS_CALENDAR_2027_I } from './official2027ICalendar'

vi.mock('./admissionsCalendarIcs', () => ({ downloadAdmissionsCalendar: vi.fn() }))

afterEach(cleanup)

describe('AdmissionsCalendarPage', () => {
  it('shows the published 2027-I in-person undergraduate milestones without collecting applications', () => {
    // Arrange
    render(<AdmissionsCalendarPage />)

    // Act
    const page = screen.getByRole('region', { name: /admisiones.*pregrado presencial/i })

    // Assert
    expect(page).toHaveTextContent('Primer semestre académico de 2027')
    expect(page).toHaveTextContent('21 sep – 21 oct 2026')
    expect(page).toHaveTextContent('Hasta el 23 oct 2026')
    expect(page).toHaveTextContent('28 y 29 oct 2026')
    expect(page).toHaveTextContent('13 nov 2026')
    expect(page).toHaveTextContent('17–27 nov 2026')
    expect(page).toHaveTextContent('23 nov – 10 dic 2026')
    expect(page).toHaveTextContent('9–15 dic 2026')
    expect(page).toHaveTextContent('Esta pantalla informa; no recibe inscripciones')
    expect(page.querySelector('form')).toBeNull()
    expect(page.querySelector('input')).toBeNull()
  })

  it('links to the official ACRA calendar and identifies when its dates were checked', () => {
    // Arrange
    render(<AdmissionsCalendarPage />)

    // Act
    const officialCalendar = screen.getByRole('link', { name: /consultar calendario oficial de acra/i })

    // Assert
    expect(officialCalendar).toHaveAttribute(
      'href',
      'https://reportes.uptc.edu.co/sitio/portal/sitios/universidad/vic_aca/adm_reg/1aspi/pre/',
    )
    expect(officialCalendar).toHaveAttribute('target', '_blank')
    expect(officialCalendar).toHaveAttribute('rel', 'noreferrer')
    expect(screen.getByText(/fuente.*acra.*actualizada el 15 de septiembre de 2026/i)).toBeVisible()
    expect(screen.getByText(/consultada el 4 de octubre de 2026/i)).toBeVisible()
    expect(screen.getByRole('link', { name: /comunicado institucional.*2027-i/i })).toHaveAttribute(
      'href',
      'https://dsp.uptc.edu.co/sitio/portal/cal_not_eve/noticias/det/UPTC-abre-inscripciones-para-estudiar-un-pregrado-presencial-a-distancia-o-virtual-el-proximo-semestre/',
    )
  })

  it('links the 2027-I public calendar to its official Resolution 111 source safely', () => {
    // Arrange
    render(<AdmissionsCalendarPage />)

    // Act
    const resolution = screen.getByRole('link', { name: /resolución 111 de 2026/i })

    // Assert
    expect(resolution).toHaveAttribute(
      'href',
      'https://apps3.uptc.edu.co/compilacion-normativa-web/#/compilaciones-normativas/detalle-documento/9906',
    )
    expect(resolution).toHaveAttribute('target', '_blank')
    expect(resolution).toHaveAttribute('rel', 'noreferrer')
  })

  it('does not attach the 2027-I resolution link to another published call', () => {
    // Arrange
    const laterCall = {
      ...OFFICIAL_ADMISSIONS_CALENDAR_2027_I,
      title: 'Pregrado presencial 2028-I',
      callName: 'Primer semestre académico de 2028',
      revisionNumber: 2,
      officialReference: 'Resolución institucional 12 de 2028',
      officialActSource: undefined,
    }

    // Act
    render(<AdmissionsCalendarPage calendar={laterCall} />)

    // Assert
    expect(screen.queryByRole('link', { name: /resolución 111 de 2026/i })).toBeNull()
  })

  it('downloads a personal calendar snapshot only after an explicit request', () => {
    // Arrange
    render(<AdmissionsCalendarPage />)

    // Act
    fireEvent.click(screen.getByRole('button', { name: /descargar fechas oficiales.*ics/i }))

    // Assert
    expect(downloadAdmissionsCalendar).toHaveBeenCalledWith(OFFICIAL_ADMISSIONS_CALENDAR_2027_I)
  })
})
