import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  AcademicOperationsClient,
  AcademicOrganizationRelation,
  AcademicOrganizationUnit,
  AcademicSite,
  AcademicSiteRelation,
  AcademicProgramAffiliation,
} from './academicOperationsContracts'
import type { AcademicProgram } from './contracts'
import { AcademicOperationsApiError } from './academicOperationsClient'

const formModules = import.meta.glob<typeof import('./CloseAcademicStructureRelationForm')>(
  './CloseAcademicStructureRelationForm.tsx',
)

async function loadForm() {
  const loader = formModules['./CloseAcademicStructureRelationForm.tsx']
  expect(loader, 'the protected relation closure form is implemented').toBeTypeOf('function')
  return loader!()
}

afterEach(() => cleanup())

const units: AcademicOrganizationUnit[] = [
  {
    id: 'fae06170-9acf-4718-854e-92e945a7db17',
    code: 'FACULTY-TEST',
    type: 'FACULTY',
    displayName: 'Facultad de prueba',
    displayOrder: 1,
    status: 'ACTIVE',
    validFrom: '2020-01-01',
    validThrough: null,
  },
  {
    id: '127d89c9-a72a-436a-9a90-26da60bc9570',
    code: 'SCHOOL-TEST',
    type: 'SCHOOL',
    displayName: 'Escuela de prueba',
    displayOrder: 2,
    status: 'ACTIVE',
    validFrom: '2020-01-01',
    validThrough: null,
  },
]

const relations: AcademicOrganizationRelation[] = [
  {
    parentUnitId: units[0]!.id,
    childUnitId: units[1]!.id,
    displayOrder: 1,
    validFrom: '2024-01-01',
    validThrough: null,
  },
  {
    parentUnitId: units[0]!.id,
    childUnitId: units[1]!.id,
    displayOrder: 1,
    validFrom: '2019-01-01',
    validThrough: '2019-12-31',
  },
  {
    parentUnitId: units[0]!.id,
    childUnitId: units[1]!.id,
    displayOrder: 1,
    validFrom: '2018-01-01',
    validThrough: '2018-01-01',
  },
]

const authorization = { accessToken: 'institutional-access-token', canRead: true, canWrite: true }

const sites: AcademicSite[] = [
  {
    id: 'b16116a1-10ba-4d79-839b-4195e4851d73',
    code: 'SITE-CENTRAL-TEST',
    type: 'CENTRAL',
    displayName: 'Sede central de prueba',
    displayOrder: 1,
    status: 'ACTIVE',
    validFrom: '2020-01-01',
    validThrough: null,
  },
  {
    id: '34a06170-9acf-4718-854e-92e945a7db17',
    code: 'SITE-REGIONAL-TEST',
    type: 'REGIONAL',
    displayName: 'Sede regional de prueba',
    displayOrder: 2,
    status: 'ACTIVE',
    validFrom: '2020-01-01',
    validThrough: null,
  },
]

const siteRelations: AcademicSiteRelation[] = [{
  parentSiteId: sites[0]!.id,
  childSiteId: sites[1]!.id,
  displayOrder: 1,
  validFrom: '2024-01-01',
  validThrough: null,
}]

const programs: AcademicProgram[] = [{
  id: '8ab62b62-b65b-4b70-9bf0-df868abfe7eb',
  programCode: 'ING-SIS',
  academicLevel: 'PREGRADO',
  studyModality: 'PRESENCIAL',
  campusCode: 'LEGACY-TUNJA',
  programName: 'Ingeniería de Sistemas de prueba',
  faculty: 'Texto legado que no se usa como relación',
  campusName: 'Texto legado que no se usa como relación',
}]

const programAffiliations: AcademicProgramAffiliation[] = [{
  id: '9ab62b62-b65b-4b70-9bf0-df868abfe7eb',
  programId: programs[0]!.id,
  organizationUnitId: units[0]!.id,
  siteId: sites[0]!.id,
  displayOrder: 1,
  validFrom: '2024-01-01',
  validThrough: null,
  sourceReference: 'Referencia de adscripción',
}]

describe('CloseAcademicStructureRelationForm', () => {
  it('requires review and explicit confirmation, then closes only the selected dated relation', async () => {
    // Arrange
    const user = userEvent.setup()
    const closeOrganizationRelation = vi.fn().mockResolvedValue(undefined)
    const onClosed = vi.fn().mockResolvedValue(undefined)
    const client = { closeOrganizationRelation } as unknown as Pick<AcademicOperationsClient, 'closeOrganizationRelation'>
    const { CloseAcademicStructureRelationForm } = await loadForm()
    render(<CloseAcademicStructureRelationForm
      kind="unit"
      entries={units}
      relations={relations}
      client={client}
      authorization={authorization}
      onClosed={onClosed}
    />)

    await user.selectOptions(screen.getByLabelText('Relación de unidades'), `${units[0]!.id}|${units[1]!.id}|2024-01-01`)
    await user.type(screen.getByLabelText('Último día de vigencia (inclusive)'), '2026-06-30')
    await user.type(screen.getByLabelText('Referencia institucional'), 'Acta de reorganización 17 de 2026')

    // Act
    await user.click(screen.getByRole('button', { name: 'Revisar cierre' }))

    // Assert
    expect(closeOrganizationRelation).not.toHaveBeenCalled()
    expect(screen.getByRole('region', { name: 'Confirmar cierre de relación' })).toHaveTextContent('2026-06-30')

    // Act
    await user.click(screen.getByRole('button', { name: 'Confirmar cierre de relación' }))

    // Assert
    await waitFor(() => expect(closeOrganizationRelation).toHaveBeenCalledWith(
      units[0]!.id,
      units[1]!.id,
      {
        validFrom: '2024-01-01',
        effectiveThrough: '2026-06-30',
        sourceReference: 'Acta de reorganización 17 de 2026',
      },
      'institutional-access-token',
    ))
    expect(closeOrganizationRelation).toHaveBeenCalledTimes(1)
    expect(onClosed).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/relación.*cerrada/i))
  })

  it('closes a dated site relation with the same confirmation and refresh safeguards', async () => {
    // Arrange
    const user = userEvent.setup()
    const closeSiteRelation = vi.fn().mockResolvedValue(undefined)
    const onClosed = vi.fn().mockResolvedValue(undefined)
    const client = { closeSiteRelation } as unknown as Pick<AcademicOperationsClient, 'closeSiteRelation'>
    const { CloseAcademicStructureRelationForm } = await loadForm()
    render(<CloseAcademicStructureRelationForm
      kind="site"
      entries={sites}
      relations={siteRelations}
      client={client}
      authorization={authorization}
      onClosed={onClosed}
    />)

    await user.selectOptions(screen.getByLabelText('Relación de sedes'),
      `${sites[0]!.id}|${sites[1]!.id}|2024-01-01`)
    await user.type(screen.getByLabelText('Último día de vigencia (inclusive)'), '2026-06-30')
    await user.type(screen.getByLabelText('Referencia institucional'), 'Acta territorial de prueba')
    await user.click(screen.getByRole('button', { name: 'Revisar cierre' }))

    // Act
    await user.click(screen.getByRole('button', { name: 'Confirmar cierre de relación' }))

    // Assert
    await waitFor(() => expect(closeSiteRelation).toHaveBeenCalledWith(
      sites[0]!.id,
      sites[1]!.id,
      {
        validFrom: '2024-01-01',
        effectiveThrough: '2026-06-30',
        sourceReference: 'Acta territorial de prueba',
      },
      'institutional-access-token',
    ))
    expect(onClosed).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/relación.*cerrada/i))
  })

  it('closes one dated program affiliation without confusing it with the legacy faculty or campus labels', async () => {
    // Arrange
    const user = userEvent.setup()
    const closeProgramAffiliation = vi.fn().mockResolvedValue(undefined)
    const onClosed = vi.fn().mockResolvedValue(undefined)
    const client = { closeProgramAffiliation } as unknown as Pick<AcademicOperationsClient, 'closeProgramAffiliation'>
    const { CloseAcademicStructureRelationForm } = await loadForm()
    render(<CloseAcademicStructureRelationForm
      kind="affiliation"
      programs={programs}
      units={units}
      sites={sites}
      relations={programAffiliations}
      client={client}
      authorization={authorization}
      onClosed={onClosed}
    />)

    await user.selectOptions(screen.getByLabelText('Adscripción de programa'),
      `${programs[0]!.id}|${programAffiliations[0]!.id}|2024-01-01`)
    await user.type(screen.getByLabelText('Último día de vigencia (inclusive)'), '2026-06-30')
    await user.type(screen.getByLabelText('Referencia institucional'), 'Acta de adscripción de prueba')
    await user.click(screen.getByRole('button', { name: 'Revisar cierre' }))

    // Act
    expect(screen.getByRole('region', { name: 'Confirmar cierre de relación' })).toHaveTextContent(
      'Ingeniería de Sistemas de prueba → Facultad de prueba · Sede central de prueba',
    )
    expect(closeProgramAffiliation).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Confirmar cierre de relación' }))

    // Assert
    await waitFor(() => expect(closeProgramAffiliation).toHaveBeenCalledWith(
      programs[0]!.id,
      programAffiliations[0]!.id,
      {
        validFrom: '2024-01-01',
        effectiveThrough: '2026-06-30',
        sourceReference: 'Acta de adscripción de prueba',
      },
      'institutional-access-token',
    ))
    expect(onClosed).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/relación cerrada/i))
  })

  it('refreshes after a concurrent change and does not retry the close automatically', async () => {
    // Arrange
    const user = userEvent.setup()
    const closeOrganizationRelation = vi.fn().mockRejectedValue(new AcademicOperationsApiError(409, 'Conflict'))
    const onClosed = vi.fn().mockResolvedValue(undefined)
    const client = { closeOrganizationRelation } as unknown as Pick<AcademicOperationsClient, 'closeOrganizationRelation'>
    const { CloseAcademicStructureRelationForm } = await loadForm()
    render(<CloseAcademicStructureRelationForm
      kind="unit"
      entries={units}
      relations={[relations[0]!]}
      client={client}
      authorization={authorization}
      onClosed={onClosed}
    />)

    await user.selectOptions(screen.getByLabelText('Relación de unidades'), `${units[0]!.id}|${units[1]!.id}|2024-01-01`)
    await user.type(screen.getByLabelText('Último día de vigencia (inclusive)'), '2026-06-30')
    await user.type(screen.getByLabelText('Referencia institucional'), 'Referencia de prueba')
    await user.click(screen.getByRole('button', { name: 'Revisar cierre' }))

    // Act
    await user.click(screen.getByRole('button', { name: 'Confirmar cierre de relación' }))

    // Assert
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/conflicto.*actualicé la estructura/i))
    expect(closeOrganizationRelation).toHaveBeenCalledTimes(1)
    expect(onClosed).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('region', { name: 'Confirmar cierre de relación' })).not.toBeInTheDocument()
  })

  it('caps an existing finite interval and rejects an extension even if submitted programmatically', async () => {
    // Arrange
    const closeOrganizationRelation = vi.fn()
    const client = { closeOrganizationRelation } as unknown as Pick<AcademicOperationsClient, 'closeOrganizationRelation'>
    const { CloseAcademicStructureRelationForm } = await loadForm()
    const finiteRelation: AcademicOrganizationRelation = { ...relations[0]!, validThrough: '2027-01-01' }
    const { container } = render(<CloseAcademicStructureRelationForm
      kind="unit"
      entries={units}
      relations={[finiteRelation]}
      client={client}
      authorization={authorization}
      onClosed={vi.fn()}
    />)

    await userEvent.setup().selectOptions(
      screen.getByLabelText('Relación de unidades'),
      `${units[0]!.id}|${units[1]!.id}|2024-01-01`,
    )
    const dateInput = screen.getByLabelText('Último día de vigencia (inclusive)')
    expect(dateInput).toHaveAttribute('max', '2026-12-31')
    fireEvent.change(dateInput, { target: { value: '2027-01-01' } })
    fireEvent.change(screen.getByLabelText('Referencia institucional'), { target: { value: 'Referencia de prueba' } })

    // Act
    fireEvent.submit(container.querySelector('form')!)

    // Assert
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/acorte su vigencia/i))
    expect(closeOrganizationRelation).not.toHaveBeenCalled()
  })

  it('does not expose a close action to an operator without write permission', async () => {
    // Arrange
    const closeOrganizationRelation = vi.fn()
    const client = { closeOrganizationRelation } as unknown as Pick<AcademicOperationsClient, 'closeOrganizationRelation'>
    const { CloseAcademicStructureRelationForm } = await loadForm()

    // Act
    const { container } = render(<CloseAcademicStructureRelationForm
      kind="unit"
      entries={units}
      relations={relations}
      client={client}
      authorization={{ ...authorization, canWrite: false }}
      onClosed={vi.fn()}
    />)

    // Assert
    expect(container).toBeEmptyDOMElement()
    expect(closeOrganizationRelation).not.toHaveBeenCalled()
  })

  it('explains when all known relations are already expired or cannot be shortened', async () => {
    // Arrange
    const closeOrganizationRelation = vi.fn()
    const client = { closeOrganizationRelation } as unknown as Pick<AcademicOperationsClient, 'closeOrganizationRelation'>
    const { CloseAcademicStructureRelationForm } = await loadForm()

    // Act
    render(<CloseAcademicStructureRelationForm
      kind="unit"
      entries={units}
      relations={[relations[1]!, relations[2]!]}
      client={client}
      authorization={authorization}
      onClosed={vi.fn()}
    />)

    // Assert
    expect(screen.getByText(/no hay relaciones actuales o futuras que puedan acortarse/i)).toBeInTheDocument()
    expect(screen.queryByLabelText('Relación de unidades')).not.toBeInTheDocument()
    expect(closeOrganizationRelation).not.toHaveBeenCalled()
  })
})
