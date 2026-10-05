import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { AdmissionsAdminDemo } from './AdmissionsAdminDemo'
import { createAdmissionsDemoStore } from './admissionsDemoStore'

afterEach(cleanup)

describe('AdmissionsAdminDemo', () => {
  it('shows a synthetic inbox without exposing applicant identity fields or admission decisions', () => {
    // Arrange
    const store = createAdmissionsDemoStore()
    render(<AdmissionsAdminDemo store={store} />)

    // Act
    const inbox = screen.getByRole('region', { name: /bandeja ficticia/i })
    const cases = within(inbox).getAllByRole('article')

    // Assert
    expect(within(inbox).getByRole('article', { name: /ficha demo-0001/i })).toBeVisible()
    expect(within(inbox).getByRole('article', { name: /ficha demo-0002/i })).toBeVisible()
    expect(cases).toHaveLength(2)
    cases.forEach((item) => expect(within(item).getAllByText(/programa ficticio/i)).toHaveLength(2))
    expect(inbox).toHaveTextContent(/datos de ejemplo/i)
    expect(within(inbox).queryByText(/admitir|rechazar|puntaje|documento de identidad/i)).not.toBeInTheDocument()
  })

  it('explains an empty inbox and points to the synthetic applicant journey', () => {
    // Arrange
    const store = createAdmissionsDemoStore()
    store.setState({ applications: [] })
    render(<AdmissionsAdminDemo store={store} />)

    // Act
    const inbox = screen.getByRole('region', { name: /bandeja ficticia/i })

    // Assert
    expect(within(inbox).getByRole('heading', { name: /aún no hay fichas sintéticas/i })).toBeVisible()
    expect(within(inbox).getByText(/cambia a la vista del aspirante/i)).toBeVisible()
    expect(within(inbox).queryByRole('article')).not.toBeInTheDocument()
  })

  it('starts a review and requests a checklist correction through the detail panel', async () => {
    // Arrange
    const user = userEvent.setup()
    const store = createAdmissionsDemoStore()
    render(<AdmissionsAdminDemo store={store} />)
    const firstCase = screen.getByRole('article', { name: /DEMO-0001/i })

    // Act
    await user.click(within(firstCase).getByRole('button', { name: /ver detalle/i }))
    await user.click(screen.getByRole('button', { name: /iniciar revisión demo/i }))
    await user.selectOptions(screen.getByLabelText(/motivo de ajuste demo/i), 'DEMO_COMPLETE_CHECKLIST')
    await user.click(screen.getByRole('button', { name: /solicitar ajuste demo/i }))

    // Assert
    expect(store.getState().applications.find((item) => item.reference === 'DEMO-0001')?.status)
      .toBe('DEMO_CORRECTION_REQUESTED')
    const detail = screen.getByRole('region', { name: /detalle de ficha DEMO-0001/i })
    expect(within(detail).getByText(/ajuste solicitado · demo/i)).toBeVisible()
    expect(within(detail).getByText(/completar la lista ficticia del ejercicio/i)).toBeVisible()
    expect(screen.queryByRole('button', { name: /admitir|rechazar/i })).not.toBeInTheDocument()
  })

  it('resumes review after the applicant response and closes only the demo review', async () => {
    // Arrange
    const user = userEvent.setup()
    const store = createAdmissionsDemoStore()
    store.getState().acknowledgeCorrection('DEMO-0002')
    render(<AdmissionsAdminDemo store={store} />)
    const secondCase = screen.getByRole('article', { name: /DEMO-0002/i })

    // Act
    await user.click(within(secondCase).getByRole('button', { name: /ver detalle/i }))
    const detail = screen.getByRole('region', { name: /detalle de ficha DEMO-0002/i })
    expect(within(detail).getByRole('status')).toHaveTextContent(/respuesta demo recibida/i)
    await user.click(screen.getByRole('button', { name: /reanudar revisión demo/i }))
    await user.click(screen.getByRole('button', { name: /finalizar revisión demo/i }))

    // Assert
    expect(store.getState().applications.find((item) => item.reference === 'DEMO-0002')?.status)
      .toBe('DEMO_REVIEW_COMPLETE')
    expect(within(detail).getByRole('status'))
      .toHaveTextContent(/revisión de ejemplo finalizada · sin decisión de admisión/i)
    expect(within(secondCase).getByRole('button', { name: /ver detalle/i })).toBeVisible()
    expect(screen.queryByRole('button', { name: /admitir|rechazar/i })).not.toBeInTheDocument()
  })

  it('filters the inbox by workflow stage and reference', async () => {
    // Arrange
    const user = userEvent.setup()
    const store = createAdmissionsDemoStore()
    render(<AdmissionsAdminDemo store={store} />)

    // Act
    await user.selectOptions(screen.getByLabelText(/filtrar por estado/i), 'DEMO_CORRECTION_REQUESTED')
    await user.type(screen.getByLabelText(/buscar referencia demo/i), '0002')

    // Assert
    expect(screen.getByRole('article', { name: /ficha demo-0002/i })).toBeVisible()
    expect(screen.queryByRole('article', { name: /ficha demo-0001/i })).not.toBeInTheDocument()
    expect(screen.getByText(/1 ficha demo/i)).toBeVisible()
  })
})
