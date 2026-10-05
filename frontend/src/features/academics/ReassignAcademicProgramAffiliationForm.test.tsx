import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AcademicProgram } from './contracts'
import type {
  AcademicOperationsClient,
  AcademicOrganizationUnit,
  AcademicProgramAffiliation,
  AcademicSite,
  AcademicStructureAuthorization,
} from './academicOperationsContracts'
import { AcademicOperationsApiError } from './academicOperationsClient'

const formModules = import.meta.glob<typeof import('./ReassignAcademicProgramAffiliationForm')>(
  './ReassignAcademicProgramAffiliationForm.tsx',
)

async function loadForm() {
  const loader = formModules['./ReassignAcademicProgramAffiliationForm.tsx']
  expect(loader, 'the reassignment confirmation form is implemented').toBeTypeOf('function')
  return loader!()
}

afterEach(() => cleanup())

const program: AcademicProgram = {
  id: 'b31e24c4-4b0e-4b79-8480-ae5f26105646',
  programCode: 'ING-SIS',
  academicLevel: 'PREGRADO',
  studyModality: 'PRESENCIAL',
  campusCode: 'TUNJA',
  programName: 'Ingeniería de Sistemas',
  faculty: 'Texto legado ignorado',
  campusName: 'Texto legado ignorado',
}

const affiliation: AcademicProgramAffiliation = {
  id: '8ab62b62-b65b-4b70-9bf0-df868abfe7eb',
  programId: program.id,
  organizationUnitId: '127d89c9-a72a-436a-9a90-26da60bc9570',
  siteId: 'b16116a1-10ba-4d79-839b-4195e4851d73',
  displayOrder: 1,
  validFrom: '2027-01-01',
  validThrough: null,
  sourceReference: 'Adscripción de origen',
}

const units: AcademicOrganizationUnit[] = [
  {
    id: affiliation.organizationUnitId,
    code: 'FAC-ORIGEN',
    type: 'FACULTY',
    displayName: 'Facultad de origen',
    displayOrder: 1,
    status: 'ACTIVE',
    validFrom: '2026-01-01',
    validThrough: null,
  },
  {
    id: 'fae06170-9acf-4718-854e-92e945a7db17',
    code: 'FAC-DESTINO',
    type: 'FACULTY',
    displayName: 'Facultad de destino',
    displayOrder: 2,
    status: 'ACTIVE',
    validFrom: '2026-01-01',
    validThrough: null,
  },
]

const sites: AcademicSite[] = [
  {
    id: affiliation.siteId,
    code: 'TUNJA',
    type: 'CENTRAL',
    displayName: 'Sede origen',
    displayOrder: 1,
    status: 'ACTIVE',
    validFrom: '2026-01-01',
    validThrough: null,
  },
  {
    id: 'bb783bf7-0fbb-48d5-9c49-17240492ef6e',
    code: 'CHIQUINQUIRA',
    type: 'SECCIONAL',
    displayName: 'Seccional destino',
    displayOrder: 2,
    status: 'ACTIVE',
    validFrom: '2026-01-01',
    validThrough: null,
  },
]

const authorization: AcademicStructureAuthorization = {
  accessToken: 'synthetic-structure-token',
  canRead: true,
  canWrite: true,
}

function createClient(reassignProgramAffiliation = vi.fn().mockResolvedValue('34a06170-9acf-4718-854e-92e945a7db17')) {
  return { reassignProgramAffiliation } as unknown as Pick<AcademicOperationsClient, 'reassignProgramAffiliation'>
}

async function enterReassignmentDraft(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText('Adscripción de origen'), affiliation.id)
  await user.selectOptions(screen.getByLabelText('Nueva unidad responsable'), units[1]!.id)
  await user.selectOptions(screen.getByLabelText('Nueva sede de desarrollo'), sites[0]!.id)
  await user.type(screen.getByLabelText('Fecha efectiva de reasignación'), '2027-06-01')
  await user.clear(screen.getByLabelText('Orden del programa en la unidad'))
  await user.type(screen.getByLabelText('Orden del programa en la unidad'), '4')
  await user.type(screen.getByLabelText('Referencia institucional'), 'Acta aprobada de reasignación')
}

describe('ReassignAcademicProgramAffiliationForm', () => {
  it('previews the inclusive cutover and refreshes after one confirmed reassignment', async () => {
    // Arrange
    const user = userEvent.setup()
    const { ReassignAcademicProgramAffiliationForm } = await loadForm()
    const reassignProgramAffiliation = vi.fn().mockResolvedValue('34a06170-9acf-4718-854e-92e945a7db17')
    const onReassigned = vi.fn().mockResolvedValue(undefined)
    render(<ReassignAcademicProgramAffiliationForm
      programs={[program]}
      affiliations={[affiliation]}
      units={units}
      sites={sites}
      client={createClient(reassignProgramAffiliation)}
      authorization={authorization}
      onReassigned={onReassigned}
    />)
    await enterReassignmentDraft(user)

    // Act
    await user.click(screen.getByRole('button', { name: 'Revisar reasignación' }))

    // Assert the review requires a second, explicit confirmation and previews both sides.
    const confirmation = await screen.findByRole('group', { name: 'Confirmar reasignación' })
    expect(confirmation.textContent).toContain('finalizará el 2027-05-31')
    expect(confirmation.textContent).toContain('iniciará el 2027-06-01')
    expect(reassignProgramAffiliation).not.toHaveBeenCalled()

    // Act
    await user.click(within(confirmation).getByRole('button', { name: 'Confirmar reasignación' }))

    // Assert
    await waitFor(() => expect(reassignProgramAffiliation).toHaveBeenCalledOnce())
    expect(reassignProgramAffiliation).toHaveBeenCalledWith(program.id, affiliation.id, {
      expectedValidFrom: '2027-01-01',
      expectedValidThrough: null,
      effectiveFrom: '2027-06-01',
      organizationUnitId: units[1]!.id,
      siteId: sites[0]!.id,
      displayOrder: 4,
      sourceReference: 'Acta aprobada de reasignación',
    }, authorization.accessToken)
    expect(onReassigned).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/reasignada y estructura actualizada/i))
  })

  it('refreshes after a conflict but never retries the write', async () => {
    // Arrange
    const user = userEvent.setup()
    const { ReassignAcademicProgramAffiliationForm } = await loadForm()
    const reassignProgramAffiliation = vi.fn().mockRejectedValue(new AcademicOperationsApiError(409, 'Conflict'))
    const onReassigned = vi.fn().mockResolvedValue(undefined)
    render(<ReassignAcademicProgramAffiliationForm
      programs={[program]}
      affiliations={[affiliation]}
      units={units}
      sites={sites}
      client={createClient(reassignProgramAffiliation)}
      authorization={authorization}
      onReassigned={onReassigned}
    />)
    await enterReassignmentDraft(user)
    await user.click(screen.getByRole('button', { name: 'Revisar reasignación' }))
    const confirmation = await screen.findByRole('group', { name: 'Confirmar reasignación' })

    // Act
    await user.click(within(confirmation).getByRole('button', { name: 'Confirmar reasignación' }))

    // Assert
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/conflicto.*actualicé la estructura/i))
    expect(reassignProgramAffiliation).toHaveBeenCalledOnce()
    expect(onReassigned).toHaveBeenCalledOnce()
  })

  it('rejects an order-only change before preview and does not call the server', async () => {
    // Arrange
    const user = userEvent.setup()
    const { ReassignAcademicProgramAffiliationForm } = await loadForm()
    const reassignProgramAffiliation = vi.fn()
    render(<ReassignAcademicProgramAffiliationForm
      programs={[program]}
      affiliations={[affiliation]}
      units={units}
      sites={sites}
      client={createClient(reassignProgramAffiliation)}
      authorization={authorization}
      onReassigned={vi.fn().mockResolvedValue(undefined)}
    />)
    await user.selectOptions(screen.getByLabelText('Adscripción de origen'), affiliation.id)
    await user.selectOptions(screen.getByLabelText('Nueva unidad responsable'), affiliation.organizationUnitId)
    await user.selectOptions(screen.getByLabelText('Nueva sede de desarrollo'), affiliation.siteId)
    await user.type(screen.getByLabelText('Fecha efectiva de reasignación'), '2027-06-01')
    await user.type(screen.getByLabelText('Orden del programa en la unidad'), '4')
    await user.type(screen.getByLabelText('Referencia institucional'), 'Solo cambio de orden')
    await user.click(screen.getByRole('button', { name: 'Revisar reasignación' }))

    // Assert
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/cambia la unidad o la sede/i))
    expect(screen.queryByRole('group', { name: 'Confirmar reasignación' })).not.toBeInTheDocument()
    expect(reassignProgramAffiliation).not.toHaveBeenCalled()
  })

  it('revalidates authorization after a server denial without refreshing or retrying', async () => {
    // Arrange
    const user = userEvent.setup()
    const { ReassignAcademicProgramAffiliationForm } = await loadForm()
    const reassignProgramAffiliation = vi.fn().mockRejectedValue(new AcademicOperationsApiError(403, 'Forbidden'))
    const onReassigned = vi.fn().mockResolvedValue(undefined)
    const onAuthorizationRejected = vi.fn().mockResolvedValue(undefined)
    render(<ReassignAcademicProgramAffiliationForm
      programs={[program]}
      affiliations={[affiliation]}
      units={units}
      sites={sites}
      client={createClient(reassignProgramAffiliation)}
      authorization={authorization}
      onReassigned={onReassigned}
      onAuthorizationRejected={onAuthorizationRejected}
    />)
    await enterReassignmentDraft(user)
    await user.click(screen.getByRole('button', { name: 'Revisar reasignación' }))
    const confirmation = await screen.findByRole('group', { name: 'Confirmar reasignación' })

    // Act
    await user.click(within(confirmation).getByRole('button', { name: 'Confirmar reasignación' }))

    // Assert
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/servidor negó el permiso/i))
    expect(onAuthorizationRejected).toHaveBeenCalledOnce()
    expect(onAuthorizationRejected).toHaveBeenCalledWith(authorization.accessToken)
    expect(onReassigned).not.toHaveBeenCalled()
    expect(reassignProgramAffiliation).toHaveBeenCalledOnce()
  })
})
