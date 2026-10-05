import userEvent from '@testing-library/user-event'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AcademicOperationsClient, AcademicPeriod, AcademicPeriodHistory, AcademicCalendarRevision } from './academicOperationsContracts'

const panelModules = import.meta.glob<typeof import('./AcademicPeriodHistoryPanel')>('./AcademicPeriodHistoryPanel.tsx')

async function loadPanel() {
  const loader = panelModules['./AcademicPeriodHistoryPanel.tsx']
  expect(loader, 'the academic period history panel is implemented').toBeTypeOf('function')
  return loader!()
}

afterEach(() => cleanup())

const period: AcademicPeriod = {
  id: 'fb750786-79cc-49cf-9814-0f1047c76ba4',
  code: '2027-1',
  kind: 'REGULAR',
  academicYear: 2027,
  sequenceNumber: 1,
  startsOn: '2027-01-15',
  endsOn: '2027-06-20',
  status: 'DRAFT',
  calendarRevisionId: null,
  calendarRevisionNumber: null,
  approvalReference: null,
  officialReference: null,
  createdAt: '2026-10-01T10:00:00Z',
}

describe('academic period history administration', () => {
  it('requires an explicit confirmation before publishing a draft calendar revision', async () => {
    // Arrange
    const user = userEvent.setup()
    const { AcademicPeriodHistoryPanel } = await loadPanel()
    const revision: AcademicCalendarRevision = {
      id: 'c2d11854-487b-4d55-b825-0b321fb1f414',
      periodId: period.id,
      version: 1,
      officialReference: 'Resolución de calendario de prueba',
      status: 'DRAFT',
      activities: [{
        key: 'REGISTRATION', label: 'Inscripción', startsAt: '2026-11-01T08:00', endsAt: '2026-11-10T16:00',
        organizationUnitId: null, siteId: null,
      }],
    }
    const publishedRevision = { ...revision, status: 'PUBLISHED' as const }
    const history: AcademicPeriodHistory = { period, calendarRevisions: [revision], auditEvents: [] }
    const getPeriodHistory = vi.fn()
      .mockResolvedValueOnce(history)
      .mockResolvedValueOnce({ ...history, calendarRevisions: [publishedRevision] })
    const publishCalendar = vi.fn().mockResolvedValue(publishedRevision)
    const client = { getPeriodHistory, publishCalendar } as unknown as Pick<AcademicOperationsClient,
      'getPeriodHistory' | 'publishCalendar' | 'createCalendar' | 'approvePeriod'>
    render(<AcademicPeriodHistoryPanel
      period={period}
      accessToken="synthetic-write-token"
      canWrite
      client={client}
    />)

    // Act
    await user.click(screen.getByRole('button', { name: 'Ver historial de 2027-1' }))
    await screen.findByText('Resolución de calendario de prueba')
    await user.click(screen.getByRole('button', { name: 'Publicar revisión 1' }))
    const confirmation = within(screen.getByRole('group', { name: 'Confirmar publicación de revisión 1' }))
    expect(confirmation.getByRole('button', { name: 'Confirmar publicación' })).toBeVisible()
    await user.click(confirmation.getByRole('button', { name: 'Confirmar publicación' }))

    // Assert
    await waitFor(() => expect(publishCalendar).toHaveBeenCalledWith(
      period.id, revision.id, 'synthetic-write-token', expect.any(AbortSignal),
    ))
    await waitFor(() => expect(getPeriodHistory).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Publicada')).toBeVisible()
    expect(screen.queryByRole('group', { name: 'Confirmar publicación de revisión 1' })).not.toBeInTheDocument()
  })

  it('does not expose calendar publishing to a read-only period operator', async () => {
    // Arrange
    const user = userEvent.setup()
    const { AcademicPeriodHistoryPanel } = await loadPanel()
    const getPeriodHistory = vi.fn().mockResolvedValue({ period, calendarRevisions: [], auditEvents: [] })
    const client = { getPeriodHistory } as unknown as Pick<AcademicOperationsClient,
      'getPeriodHistory' | 'publishCalendar' | 'createCalendar' | 'approvePeriod'>
    render(<AcademicPeriodHistoryPanel period={period} accessToken="synthetic-read-token" client={client} />)

    // Act
    await user.click(screen.getByRole('button', { name: 'Ver historial de 2027-1' }))
    await screen.findByText('Este periodo aún no tiene revisiones de calendario.')

    // Assert
    expect(screen.queryByRole('button', { name: /publicar revisión/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /guardar borrador de calendario/i })).not.toBeInTheDocument()
  })
})
