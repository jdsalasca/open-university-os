import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

const demoModules = import.meta.glob<typeof import('./MyAcademicWeekDemo')>('./MyAcademicWeekDemo.tsx')

async function loadDemo() {
  const loader = demoModules['./MyAcademicWeekDemo.tsx']
  expect(loader, 'the student week preview is implemented').toBeTypeOf('function')
  return loader!()
}

afterEach(cleanup)

describe('MyAcademicWeekDemo', () => {
  it('shows a clearly synthetic, read-only weekly agenda', async () => {
    // Arrange
    const { MyAcademicWeekDemo } = await loadDemo()

    // Act
    render(<MyAcademicWeekDemo />)

    // Assert
    expect(screen.getByRole('heading', { name: 'Mi semana académica' })).toBeVisible()
    expect(screen.getByText(/datos ficticios/i)).toBeVisible()
    expect(screen.getByText(/no reflejan matrícula/i)).toBeVisible()
    expect(screen.getAllByRole('article')).toHaveLength(7)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /inscrib|cancelar|nota|calificar/i })).not.toBeInTheDocument()
  })

  it('groups repeated meetings under one sample subject and shows every meeting in its detail', async () => {
    // Arrange
    const { MyAcademicWeekDemo } = await loadDemo()
    const user = userEvent.setup()
    render(<MyAcademicWeekDemo />)

    // Act
    await user.click(screen.getByRole('button', { name: 'Mis asignaturas' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Mis asignaturas' })).toBeVisible()
    const subjects = screen.getByRole('region', { name: 'Asignaturas de ejemplo' })

    // Assert
    expect(within(subjects).getAllByRole('button', { name: /ver asignatura/i })).toHaveLength(6)

    // Act
    await user.click(within(subjects).getByRole('button', { name: /diseño de sistemas de muestra/i }))

    // Assert
    const details = screen.getByRole('region', { name: 'Detalle de la asignatura seleccionada' })
    expect(within(details).getByText('Diseño de sistemas de muestra')).toBeVisible()
    const meetings = within(details).getAllByRole('listitem')
    expect(meetings).toHaveLength(2)
    expect(meetings[0]).toHaveTextContent('Jueves10:00–11:30Aula de muestra 05')
    expect(meetings[1]).toHaveTextContent('Viernes12:00–13:30Laboratorio de muestra 07')
    expect(within(details).getByText('Docente de ejemplo 5')).toBeVisible()
  })

  it('clears the selected subject when returning to the week view', async () => {
    // Arrange
    const { MyAcademicWeekDemo } = await loadDemo()
    const user = userEvent.setup()
    render(<MyAcademicWeekDemo />)

    // Act
    await user.click(screen.getByRole('button', { name: 'Mis asignaturas' }))
    await user.click(screen.getByRole('button', { name: /ver asignatura.*diseño de sistemas de muestra/i }))
    expect(screen.getByRole('region', { name: 'Detalle de la asignatura seleccionada' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Mi semana' }))

    // Assert
    expect(screen.queryByRole('region', { name: 'Detalle de la asignatura seleccionada' })).not.toBeInTheDocument()
    expect(screen.getByText(/elige una sesión para consultar sus detalles de ejemplo/i)).toBeVisible()
  })

  it('keeps the selected subject when its active view is selected again', async () => {
    // Arrange
    const { MyAcademicWeekDemo } = await loadDemo()
    const user = userEvent.setup()
    render(<MyAcademicWeekDemo />)

    // Act
    await user.click(screen.getByRole('button', { name: 'Mis asignaturas' }))
    await user.click(screen.getByRole('button', { name: /ver asignatura.*diseño de sistemas de muestra/i }))
    await user.click(screen.getByRole('button', { name: 'Mis asignaturas' }))

    // Assert
    const details = screen.getByRole('region', { name: 'Detalle de la asignatura seleccionada' })
    expect(within(details).getByRole('heading', { name: 'Diseño de sistemas de muestra' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Mis asignaturas' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('filters sessions by selected weekday without changing the agenda data', async () => {
    // Arrange
    const { MyAcademicWeekDemo } = await loadDemo()
    const user = userEvent.setup()
    render(<MyAcademicWeekDemo />)

    // Act
    await user.click(screen.getByRole('button', { name: 'Martes' }))

    // Assert
    const agenda = screen.getByRole('region', { name: /agenda semanal de ejemplo/i })
    expect(within(agenda).getAllByRole('article')).toHaveLength(1)
    expect(within(agenda).getByText('Martes')).toBeVisible()
    expect(within(agenda).getByText('Lectura académica de muestra')).toBeVisible()
    expect(within(agenda).queryByText('Laboratorio de ejemplo')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Martes' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('opens an accessible detail panel for the selected sample session', async () => {
    // Arrange
    const { MyAcademicWeekDemo } = await loadDemo()
    const user = userEvent.setup()
    render(<MyAcademicWeekDemo />)

    // Act
    await user.click(screen.getByRole('button', { name: /ver detalle de laboratorio de ejemplo/i }))

    // Assert
    const details = screen.getByRole('region', { name: /detalle de la sesión seleccionada/i })
    expect(within(details).getByText('DEMO-202')).toBeVisible()
    expect(within(details).getByText('Taller de muestra 02')).toBeVisible()
    expect(within(details).getByText('Docente de ejemplo 2')).toBeVisible()
  })

  it('explains when a selected day has no sample sessions', async () => {
    // Arrange
    const { MyAcademicWeekDemo } = await loadDemo()
    const user = userEvent.setup()
    render(<MyAcademicWeekDemo />)

    // Act
    await user.click(screen.getByRole('button', { name: 'Domingo' }))

    // Assert
    expect(screen.getByText(/no hay sesiones en este día de la agenda de ejemplo/i)).toBeVisible()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('clears a selected session when the day filter changes', async () => {
    // Arrange
    const { MyAcademicWeekDemo } = await loadDemo()
    const user = userEvent.setup()
    render(<MyAcademicWeekDemo />)

    // Act
    await user.click(screen.getByRole('button', { name: /ver detalle de laboratorio de ejemplo/i }))
    expect(screen.getByText('Taller de muestra 02')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Martes' }))

    // Assert
    expect(screen.queryByText('Taller de muestra 02')).not.toBeInTheDocument()
    expect(screen.getByText(/elige una sesión para consultar sus detalles de ejemplo/i)).toBeVisible()
  })
})
