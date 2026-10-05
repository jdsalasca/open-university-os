import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

const demoModules = import.meta.glob<typeof import('./GradeEntryDemo')>('./GradeEntryDemo.tsx')

async function loadDemo() {
  const loader = demoModules['./GradeEntryDemo.tsx']
  expect(loader, 'the grade entry demo is implemented').toBeTypeOf('function')
  return loader!()
}

afterEach(cleanup)

describe('GradeEntryDemo', () => {
  it('shows a local-only grade entry workflow with anonymous sample references', async () => {
    // Arrange
    const { GradeEntryDemo } = await loadDemo()

    // Act
    render(<GradeEntryDemo />)

    // Assert
    expect(screen.getByRole('heading', { name: 'Registro de calificaciones · demo' })).toBeVisible()
    expect(screen.getByText(/solo se guarda en memoria/i)).toBeVisible()
    expect(screen.getByText(/escala de prueba 0 a 5/i)).toBeVisible()
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    expect(screen.getAllByRole('spinbutton')).toHaveLength(3)
    expect(screen.getByText('DEMO-ALU-001')).toBeVisible()
    expect(screen.getByText('DEMO-ALU-002')).toBeVisible()
    expect(screen.getByText('DEMO-ALU-003')).toBeVisible()
    expect(screen.getByText(/no hay promedio, aprobación automática ni nota definitiva/i)).toBeVisible()
    expect(screen.queryByText(/^(?:promedio|resultado final|aprobación):/i)).not.toBeInTheDocument()
  })

  it('requires a value for every fictional roster reference before saving', async () => {
    // Arrange
    const { GradeEntryDemo } = await loadDemo()
    const user = userEvent.setup()
    render(<GradeEntryDemo />)

    // Act
    await user.click(screen.getByRole('button', { name: 'Guardar borrador local' }))

    // Assert
    const form = screen.getByRole('form', { name: 'Captura de calificaciones de ejemplo' })
    expect(within(screen.getByRole('list')).getAllByRole('alert')).toHaveLength(3)
    expect(within(form).getByText('Corrige los valores señalados para guardar este borrador.')).toBeVisible()
    expect(screen.queryByRole('status', { name: /borrador local guardado/i })).not.toBeInTheDocument()
  })

  it('rejects scores outside the explicitly provisional demo range', async () => {
    // Arrange
    const { GradeEntryDemo } = await loadDemo()
    const user = userEvent.setup()
    render(<GradeEntryDemo />)

    // Act
    await user.type(screen.getByRole('spinbutton', { name: 'Calificación para DEMO-ALU-001' }), '5.1')
    await user.type(screen.getByRole('spinbutton', { name: 'Calificación para DEMO-ALU-002' }), '4.0')
    await user.type(screen.getByRole('spinbutton', { name: 'Calificación para DEMO-ALU-003' }), '3.5')
    await user.click(screen.getByRole('button', { name: 'Guardar borrador local' }))

    // Assert
    expect(screen.getAllByRole('alert').some((alert) => /entre 0 y 5/i.test(alert.textContent ?? ''))).toBe(true)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('keeps valid entries as an in-memory draft without publishing or computing a final result', async () => {
    // Arrange
    const { GradeEntryDemo } = await loadDemo()
    const user = userEvent.setup()
    render(<GradeEntryDemo />)
    const grades = screen.getAllByRole('spinbutton')

    // Act
    for (const grade of grades) await user.type(grade, '3.75')
    await user.click(screen.getByRole('button', { name: 'Guardar borrador local' }))

    // Assert
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Borrador local guardado para 3 referencias ficticias. No se publica ninguna nota.',
    )
    expect(grades.map((grade) => (grade as HTMLInputElement).value)).toEqual(['3.75', '3.75', '3.75'])
    expect(screen.queryByRole('button', { name: /publicar|cerrar notas/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/^Promedio:/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Resultado final:/i)).not.toBeInTheDocument()
  })

  it('clears the local draft when switching to another fictional group', async () => {
    // Arrange
    const { GradeEntryDemo } = await loadDemo()
    const user = userEvent.setup()
    render(<GradeEntryDemo />)
    for (const grade of screen.getAllByRole('spinbutton')) await user.type(grade, '4.0')
    await user.click(screen.getByRole('button', { name: 'Guardar borrador local' }))
    expect(await screen.findByRole('status')).toBeVisible()

    // Act
    await user.selectOptions(screen.getByRole('combobox', { name: 'Grupo de ejemplo' }), 'demo-group-02')

    // Assert
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getAllByRole('spinbutton')).toHaveLength(2)
    expect(screen.getByText('DEMO-ALU-004')).toBeVisible()
    expect(screen.queryByText('DEMO-ALU-001')).not.toBeInTheDocument()
    expect(screen.getAllByRole('spinbutton').map((grade) => (grade as HTMLInputElement).value)).toEqual(['', ''])
  })

  it('clears the saved acknowledgement when a grade is edited again', async () => {
    // Arrange
    const { GradeEntryDemo } = await loadDemo()
    const user = userEvent.setup()
    render(<GradeEntryDemo />)
    for (const grade of screen.getAllByRole('spinbutton')) await user.type(grade, '4.0')
    await user.click(screen.getByRole('button', { name: 'Guardar borrador local' }))
    await screen.findByRole('status')

    // Act
    const firstGrade = screen.getByRole('spinbutton', { name: 'Calificación para DEMO-ALU-001' })
    await user.clear(firstGrade)
    await user.type(firstGrade, '4.5')

    // Assert
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
