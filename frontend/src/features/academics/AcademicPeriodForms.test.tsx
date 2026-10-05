import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { AcademicOperationsClient, AcademicPeriod, AcademicCalendarRevision } from './academicOperationsContracts'

const formModules = import.meta.glob<typeof import('./AcademicPeriodForms')>('./AcademicPeriodForms.tsx')

async function loadForms() {
  const loader = formModules['./AcademicPeriodForms.tsx']
  expect(loader, 'the academic period forms are implemented').toBeTypeOf('function')
  return loader!()
}

afterEach(() => cleanup())

const draftPeriod: AcademicPeriod = {
  id: 'fb750786-79cc-49cf-9814-0f1047c76ba4',
  code: '2027-INT-1',
  kind: 'INTERSEMESTRAL',
  academicYear: 2027,
  sequenceNumber: 3,
  startsOn: '2027-06-01',
  endsOn: '2027-06-30',
  status: 'DRAFT',
  calendarRevisionId: null,
  calendarRevisionNumber: null,
  approvalReference: null,
  officialReference: null,
  createdAt: '2026-10-01T10:00:00Z',
}

describe('academic period administration forms', () => {
  it('creates an intersemester draft with its own dates and sequence', async () => {
    // Arrange
    const user = userEvent.setup()
    const { CreateAcademicPeriodForm } = await loadForms()
    const createPeriod = vi.fn().mockResolvedValue(draftPeriod)
    const onCreated = vi.fn().mockResolvedValue(undefined)
    render(<CreateAcademicPeriodForm
      client={{ createPeriod } as unknown as Pick<AcademicOperationsClient, 'createPeriod'>}
      accessToken="synthetic-write-token"
      onCreated={onCreated}
    />)

    // Act
    await user.type(screen.getByLabelText('Código del periodo'), '2027-int-1')
    await user.selectOptions(screen.getByLabelText('Tipo de periodo'), 'INTERSEMESTRAL')
    await user.type(screen.getByLabelText('Año académico'), '2027')
    await user.type(screen.getByLabelText('Número del periodo'), '3')
    await user.type(screen.getByLabelText('Inicio de instrucción'), '2027-06-01')
    await user.type(screen.getByLabelText('Fin de instrucción'), '2027-06-30')
    await user.click(screen.getByRole('button', { name: 'Crear borrador de periodo' }))

    // Assert
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(draftPeriod))
    expect(createPeriod).toHaveBeenCalledWith({
      code: '2027-int-1', kind: 'INTERSEMESTRAL', academicYear: 2027, sequenceNumber: 3,
      startsOn: '2027-06-01', endsOn: '2027-06-30',
    }, 'synthetic-write-token')
  })

  it('rejects an intersemester sequence above the API limit before requesting a period', async () => {
    // Arrange
    const user = userEvent.setup()
    const { CreateAcademicPeriodForm } = await loadForms()
    const createPeriod = vi.fn()
    render(<CreateAcademicPeriodForm
      client={{ createPeriod } as unknown as Pick<AcademicOperationsClient, 'createPeriod'>}
      accessToken="synthetic-write-token"
      onCreated={vi.fn()}
    />)

    // Act
    await user.type(screen.getByLabelText('Código del periodo'), '2027-int-100')
    await user.selectOptions(screen.getByLabelText('Tipo de periodo'), 'INTERSEMESTRAL')
    await user.type(screen.getByLabelText('Año académico'), '2027')
    await user.type(screen.getByLabelText('Número del periodo'), '100')
    await user.type(screen.getByLabelText('Inicio de instrucción'), '2027-06-01')
    await user.type(screen.getByLabelText('Fin de instrucción'), '2027-06-30')
    await user.click(screen.getByRole('button', { name: 'Crear borrador de periodo' }))

    // Assert
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/máximo admitido es 99/i))
    expect(createPeriod).not.toHaveBeenCalled()
  })

  it('shows field errors for fractional academic years and sequence numbers before requesting a period', async () => {
    // Arrange
    const user = userEvent.setup()
    const { CreateAcademicPeriodForm } = await loadForms()
    const createPeriod = vi.fn()
    render(<CreateAcademicPeriodForm
      client={{ createPeriod } as unknown as Pick<AcademicOperationsClient, 'createPeriod'>}
      accessToken="synthetic-write-token"
      onCreated={vi.fn()}
    />)

    // Act
    await user.type(screen.getByLabelText('Código del periodo'), '2027-1')
    await user.selectOptions(screen.getByLabelText('Tipo de periodo'), 'REGULAR')
    await user.type(screen.getByLabelText('Año académico'), '2027.5')
    await user.type(screen.getByLabelText('Número del periodo'), '1.5')
    await user.type(screen.getByLabelText('Inicio de instrucción'), '2027-01-01')
    await user.type(screen.getByLabelText('Fin de instrucción'), '2027-06-30')
    await user.click(screen.getByRole('button', { name: 'Crear borrador de periodo' }))

    // Assert
    expect(await screen.findByText('El año académico debe ser un número entero.')).toBeVisible()
    expect(screen.getByText('El número del periodo debe ser entero.')).toBeVisible()
    expect(createPeriod).not.toHaveBeenCalled()
  })

  it('blocks a regular period sequence above two before the server request', async () => {
    // Arrange
    const user = userEvent.setup()
    const { CreateAcademicPeriodForm } = await loadForms()
    const createPeriod = vi.fn()
    render(<CreateAcademicPeriodForm
      client={{ createPeriod } as unknown as Pick<AcademicOperationsClient, 'createPeriod'>}
      accessToken="synthetic-write-token"
      onCreated={vi.fn()}
    />)

    // Act
    await user.type(screen.getByLabelText('Código del periodo'), '2027-3')
    await user.selectOptions(screen.getByLabelText('Tipo de periodo'), 'REGULAR')
    await user.type(screen.getByLabelText('Año académico'), '2027')
    await user.type(screen.getByLabelText('Número del periodo'), '3')
    await user.type(screen.getByLabelText('Inicio de instrucción'), '2027-06-01')
    await user.type(screen.getByLabelText('Fin de instrucción'), '2027-06-30')
    await user.click(screen.getByRole('button', { name: 'Crear borrador de periodo' }))

    // Assert
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/periodo regular.*1 o 2/i))
    expect(createPeriod).not.toHaveBeenCalled()
  })

  it('adds an activity to a calendar draft and preserves administrative dates outside the class range', async () => {
    // Arrange
    const user = userEvent.setup()
    const { AcademicCalendarRevisionForm } = await loadForms()
    const createCalendar = vi.fn().mockResolvedValue({} as AcademicCalendarRevision)
    const onCreated = vi.fn().mockResolvedValue(undefined)
    render(<AcademicCalendarRevisionForm
      periodId={draftPeriod.id}
      accessToken="synthetic-write-token"
      client={{ createCalendar } as unknown as Pick<AcademicOperationsClient, 'createCalendar'>}
      onCreated={onCreated}
    />)

    // Act
    await user.type(screen.getByLabelText('Referencia oficial del calendario'), ' Resolución de prueba ')
    await user.type(screen.getByLabelText('Clave de actividad 1'), 'inscripcion')
    await user.type(screen.getByLabelText('Nombre de actividad 1'), ' Inscripción ')
    await user.type(screen.getByLabelText('Inicio de actividad 1'), '2026-11-01T08:00')
    await user.type(screen.getByLabelText('Fin de actividad 1'), '2026-11-10T16:00')
    await user.click(screen.getByRole('button', { name: 'Añadir actividad' }))
    await user.type(screen.getByLabelText('Clave de actividad 2'), 'CLASES')
    await user.type(screen.getByLabelText('Nombre de actividad 2'), 'Inicio de clases')
    await user.type(screen.getByLabelText('Inicio de actividad 2'), '2027-06-01T08:00')
    await user.type(screen.getByLabelText('Fin de actividad 2'), '2027-06-30T18:00')
    await user.click(screen.getByRole('button', { name: 'Guardar borrador de calendario' }))

    // Assert
    await waitFor(() => expect(createCalendar).toHaveBeenCalledOnce())
    expect(createCalendar).toHaveBeenCalledWith(draftPeriod.id, {
      officialReference: 'Resolución de prueba',
      activities: [
        { key: 'INSCRIPCION', label: 'Inscripción', startsAt: '2026-11-01T08:00', endsAt: '2026-11-10T16:00', organizationUnitId: null, siteId: null },
        { key: 'CLASES', label: 'Inicio de clases', startsAt: '2027-06-01T08:00', endsAt: '2027-06-30T18:00', organizationUnitId: null, siteId: null },
      ],
    }, 'synthetic-write-token')
    expect(onCreated).toHaveBeenCalledOnce()
    expect(screen.getByText(/fechas de inscripción pueden preceder/i)).toBeVisible()
  })

  it('rejects an activity whose end precedes its start without creating a revision', async () => {
    // Arrange
    const user = userEvent.setup()
    const { AcademicCalendarRevisionForm } = await loadForms()
    const createCalendar = vi.fn()
    render(<AcademicCalendarRevisionForm
      periodId={draftPeriod.id}
      accessToken="synthetic-write-token"
      client={{ createCalendar } as unknown as Pick<AcademicOperationsClient, 'createCalendar'>}
      onCreated={vi.fn()}
    />)

    // Act
    await user.type(screen.getByLabelText('Referencia oficial del calendario'), 'Resolución de prueba')
    await user.type(screen.getByLabelText('Clave de actividad 1'), 'INSCRIPCION')
    await user.type(screen.getByLabelText('Nombre de actividad 1'), 'Inscripción')
    await user.type(screen.getByLabelText('Inicio de actividad 1'), '2026-11-10T16:00')
    await user.type(screen.getByLabelText('Fin de actividad 1'), '2026-11-01T08:00')
    await user.click(screen.getByRole('button', { name: 'Guardar borrador de calendario' }))

    // Assert
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/posterior.*inicio/i))
    expect(createCalendar).not.toHaveBeenCalled()
  })

  it('approves only the chosen published revision and sends an explicit approval reference', async () => {
    // Arrange
    const user = userEvent.setup()
    const { ApproveAcademicPeriodForm } = await loadForms()
    const revisionId = 'c2d11854-487b-4d55-b825-0b321fb1f414'
    const revision: AcademicCalendarRevision = {
      id: revisionId,
      periodId: draftPeriod.id,
      version: 2,
      officialReference: 'Resolución de calendario de prueba',
      status: 'PUBLISHED',
      activities: [],
    }
    const approvedPeriod = { ...draftPeriod, status: 'APPROVED' as const }
    const approvePeriod = vi.fn().mockResolvedValue(approvedPeriod)
    const onApproved = vi.fn()
    render(<ApproveAcademicPeriodForm
      periodId={draftPeriod.id}
      publishedRevisions={[revision]}
      accessToken="synthetic-write-token"
      client={{ approvePeriod } as unknown as Pick<AcademicOperationsClient, 'approvePeriod'>}
      onApproved={onApproved}
    />)

    // Act
    await user.selectOptions(screen.getByLabelText('Revisión publicada'), revisionId)
    await user.type(screen.getByLabelText('Referencia del acto de aprobación'), ' Resolución aprobatoria de prueba ')
    await user.click(screen.getByRole('button', { name: 'Aprobar periodo' }))

    // Assert
    await waitFor(() => expect(onApproved).toHaveBeenCalledWith(approvedPeriod))
    expect(approvePeriod).toHaveBeenCalledWith(draftPeriod.id, {
      calendarRevisionId: revisionId, approvalReference: 'Resolución aprobatoria de prueba',
    }, 'synthetic-write-token')
  })
})
