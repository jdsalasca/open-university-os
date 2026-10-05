import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AdmissionsWorkflowLab } from './AdmissionsWorkflowLab'
import { createTerritorialCatalogClient } from '../../territorial-catalog/territorialCatalogClient'

afterEach(cleanup)

describe('AdmissionsWorkflowLab', () => {
  it('presents aspirant and admissions-team journeys as clear, selectable entry cards', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<AdmissionsWorkflowLab calendar={<p>Calendario público conservado</p>} />)
    const applicantTab = screen.getByRole('tab', { name: /aspirante.*demo/i })
    const staffTab = screen.getByRole('tab', { name: /equipo de admisiones.*demo/i })

    // Act
    await user.click(staffTab)

    // Assert
    expect(applicantTab).toBeVisible()
    expect(applicantTab).toHaveAccessibleDescription(/completa una ficha ficticia y sigue su estado/i)
    expect(staffTab).toHaveAccessibleDescription(/revisa la bandeja y solicita un ajuste de ejemplo/i)
    expect(staffTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('region', { name: /bandeja ficticia/i })).toBeVisible()
  })

  it('starts in the applicant demo and keeps a created synthetic case available to the admin view', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<AdmissionsWorkflowLab calendar={<p>Calendario público conservado</p>} />)

    // Act
    await user.selectOptions(screen.getByLabelText(/primera opción ficticia/i), 'demo-program-a')
    await user.selectOptions(screen.getByLabelText(/segunda opción ficticia/i), 'demo-program-b')
    await user.click(screen.getByRole('checkbox', { name: /lee y acepta/i }))
    await user.click(screen.getByRole('checkbox', { name: /confirmo que ambas opciones/i }))
    await user.click(screen.getByRole('button', { name: /crear ficha sintética/i }))
    await user.click(screen.getByRole('tab', { name: /equipo de admisiones/i }))

    // Assert
    const inbox = screen.getByRole('region', { name: /bandeja ficticia/i })
    expect(within(inbox).getByRole('article', { name: /ficha demo-0003/i })).toBeVisible()
    expect(screen.getByText(/demostración local · datos sintéticos/i)).toBeVisible()
  })

  it('supports arrow-key navigation and preserves the public calendar view', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<AdmissionsWorkflowLab calendar={<p>Calendario público conservado</p>} />)
    const applicantTab = screen.getByRole('tab', { name: /aspirante/i })

    // Act
    applicantTab.focus()
    await user.keyboard('{ArrowRight}')
    await user.keyboard('{ArrowRight}')

    // Assert
    expect(screen.getByRole('tab', { name: /calendario público/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel', { name: /calendario público/i })).toHaveTextContent('Calendario público conservado')
  })

  it('keeps the demo store in memory during perspective changes but starts a clean demo after remount', async () => {
    // Arrange
    const user = userEvent.setup()
    const view = render(<AdmissionsWorkflowLab calendar={<p>Calendario público conservado</p>} />)
    await user.click(screen.getByRole('tab', { name: /equipo de admisiones/i }))
    const detail = screen.getByRole('region', { name: /detalle de ficha DEMO-0001/i })

    // Act
    await user.click(within(detail).getByRole('button', { name: /iniciar revisión demo/i }))
    await user.click(screen.getByRole('tab', { name: /aspirante/i }))
    expect(screen.getByText(/2 fichas sintéticas/i)).toBeVisible()
    await user.click(screen.getByRole('tab', { name: /equipo de admisiones/i }))
    expect(screen.getByRole('article', { name: /DEMO-0001/i })).toHaveTextContent(/revisión demo en curso/i)
    view.unmount()
    render(<AdmissionsWorkflowLab calendar={<p>Calendario público conservado</p>} />)
    await user.click(screen.getByRole('tab', { name: /equipo de admisiones/i }))

    // Assert
    expect(screen.getByRole('article', { name: /DEMO-0001/i })).toHaveTextContent(/pendiente de revisión demo/i)
    expect(screen.queryByText('DEMO-0003')).not.toBeInTheDocument()
  })

  it('offers a reference-only territorial selector that does not create an admissions case', async () => {
    // Arrange
    const user = userEvent.setup()
    const source = {
      publisher: 'DANE',
      datasetName: 'DIVIPOLA según Marco Geoestadístico Nacional',
      datasetVersion: 'MGN 2025',
      snapshotRetrievedAt: '2026-10-02',
      serviceUrl: 'https://geoportal.dane.gov.co/mparcgis/rest/services/Divipola/Serv_DIVIPOLA_MGN_2025/FeatureServer',
      documentationUrl: 'https://www.dane.gov.co/index.php/sistema-estadistico-nacional-sen/normas-y-estandares/nomenclaturas-y-clasificaciones/nomenclaturas/codificacion-de-la-division-politica-administrativa-de-colombia-divipola',
    }
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ source, departments: [
        { code: '05', name: 'ANTIOQUIA' }, { code: '15', name: 'BOYACÁ' },
      ] }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ source, department: { code: '15', name: 'BOYACÁ' },
        entities: [{ code: '15001', departmentCode: '15', localCode: '001', name: 'TUNJA',
          type: 'MUNICIPIO', dataYear: 2025 }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const territorialClient = createTerritorialCatalogClient(fetcher)
    render(<AdmissionsWorkflowLab calendar={<p>Calendario público conservado</p>}
      territorialCatalogClient={territorialClient} />)

    // Act
    const territorialTab = screen.queryByRole('tab', { name: /catálogo territorial/i })

    // Assert the missing feature as a normal assertion failure during RED.
    expect(territorialTab).toBeInTheDocument()
    if (!territorialTab) return

    await user.click(territorialTab)
    await user.selectOptions(await screen.findByLabelText(/departamento de referencia/i), '15')
    await user.selectOptions(await screen.findByLabelText(/^entidad territorial$/i), '15001')

    expect(await screen.findByText('15001', { selector: 'strong' })).toBeVisible()
    expect(fetcher).toHaveBeenNthCalledWith(1, '/api/v1/territorial-catalog/departments',
      expect.objectContaining({ method: 'GET', credentials: 'omit' }))
    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/v1/territorial-catalog/departments/15/entities',
      expect.objectContaining({ method: 'GET', credentials: 'omit' }))
    expect(fetcher.mock.calls.every(([, options]) => options?.method === 'GET')).toBe(true)
    expect(screen.queryByRole('button', { name: /crear ficha sintética/i })).not.toBeInTheDocument()
  })
})
