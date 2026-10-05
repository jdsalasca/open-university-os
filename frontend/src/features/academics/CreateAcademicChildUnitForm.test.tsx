import type { ComponentType } from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AcademicOperationsClient, AcademicOrganizationUnit, AcademicStructureAuthorization } from './academicOperationsContracts'
import { AcademicOperationsApiError } from './academicOperationsClient'

type ChildUnitFormProps = {
  parents: Array<Pick<AcademicOrganizationUnit,
    'id' | 'code' | 'displayName' | 'status' | 'validFrom' | 'validThrough'>>
  client: Pick<AcademicOperationsClient, 'createChildUnit'>
  authorization: AcademicStructureAuthorization
  onCreated(unitId: string): Promise<void>
  onRefresh(): Promise<void>
  onAuthorizationRejected?: (accessToken: string) => Promise<void>
}

const formModules = import.meta.glob<{ CreateAcademicChildUnitForm: ComponentType<ChildUnitFormProps> }>(
  './CreateAcademicChildUnitForm.tsx',
)

async function loadForm() {
  const loader = formModules['./CreateAcademicChildUnitForm.tsx']
  expect(loader, 'the protected child-unit creation form is implemented').toBeTypeOf('function')
  return loader!()
}

afterEach(() => cleanup())

describe('CreateAcademicChildUnitForm', () => {
  const parentId = 'a4a06170-9acf-4718-854e-92e945a7db17'
  const parents = [{
    id: parentId,
    code: 'FAC-CIENCIAS',
    displayName: 'Facultad de Ciencias',
    status: 'ACTIVE' as const,
    validFrom: '2026-01-01',
    validThrough: null,
  }]
  const authorization = { accessToken: 'institutional-access-token', canRead: true, canWrite: true }

  it('creates one child with the selected parent, ordering and validity, then refreshes the tree', async () => {
    // Arrange
    const user = userEvent.setup()
    const childId = '94a06170-9acf-4718-854e-92e945a7db17'
    const createChildUnit = vi.fn().mockResolvedValue(childId)
    const onCreated = vi.fn().mockResolvedValue(undefined)
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const client = { createChildUnit } as unknown as Pick<AcademicOperationsClient, 'createChildUnit'>
    const { CreateAcademicChildUnitForm } = await loadForm()
    render(<CreateAcademicChildUnitForm
      parents={parents}
      client={client}
      authorization={authorization}
      onCreated={onCreated}
      onRefresh={onRefresh}
    />)

    await user.selectOptions(screen.getByLabelText('Unidad superior'), parentId)
    await user.type(screen.getByLabelText('Código institucional'), 'school-ciencias')
    await user.selectOptions(screen.getByLabelText('Tipo de unidad'), 'SCHOOL')
    await user.type(screen.getByLabelText('Nombre de la unidad'), 'Escuela de Ciencias')
    await user.clear(screen.getByLabelText('Orden dentro de la unidad superior'))
    await user.type(screen.getByLabelText('Orden dentro de la unidad superior'), '3')
    await user.clear(screen.getByLabelText('Vigente desde'))
    await user.type(screen.getByLabelText('Vigente desde'), '2026-10-01')
    await user.type(screen.getByLabelText('Vigente hasta (opcional)'), '2027-06-30')
    await user.type(screen.getByLabelText('Referencia institucional'), 'Acuerdo institucional de prueba')

    // Act
    await user.click(screen.getByRole('button', { name: 'Crear unidad hija' }))

    // Assert
    await waitFor(() => expect(createChildUnit).toHaveBeenCalledWith(parentId, {
      code: 'school-ciencias',
      type: 'SCHOOL',
      displayName: 'Escuela de Ciencias',
      displayOrder: 3,
      validFrom: '2026-10-01',
      validThrough: '2027-06-30',
      sourceReference: 'Acuerdo institucional de prueba',
    }, 'institutional-access-token'))
    expect(onCreated).toHaveBeenCalledWith(childId)
    expect(onRefresh).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/unidad hija registrada/i))
  })

  it('refreshes current structure after a server conflict and does not repeat the write', async () => {
    // Arrange
    const user = userEvent.setup()
    const createChildUnit = vi.fn().mockRejectedValue(new AcademicOperationsApiError(409, 'Conflicto'))
    const onCreated = vi.fn()
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const client = { createChildUnit } as unknown as Pick<AcademicOperationsClient, 'createChildUnit'>
    const { CreateAcademicChildUnitForm } = await loadForm()
    render(<CreateAcademicChildUnitForm
      parents={parents}
      client={client}
      authorization={authorization}
      onCreated={onCreated}
      onRefresh={onRefresh}
    />)
    await user.selectOptions(screen.getByLabelText('Unidad superior'), parentId)
    await user.type(screen.getByLabelText('Código institucional'), 'school-conflict')
    await user.selectOptions(screen.getByLabelText('Tipo de unidad'), 'SCHOOL')
    await user.type(screen.getByLabelText('Nombre de la unidad'), 'Escuela en conflicto')
    await user.type(screen.getByLabelText('Referencia institucional'), 'Referencia de prueba')

    // Act
    await user.click(screen.getByRole('button', { name: 'Crear unidad hija' }))

    // Assert
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/conflicto/i))
    expect(onRefresh).toHaveBeenCalledTimes(1)
    expect(createChildUnit).toHaveBeenCalledTimes(1)
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('keeps creation disabled when there is no active parent to select', async () => {
    // Arrange
    const createChildUnit = vi.fn()
    const client = { createChildUnit } as unknown as Pick<AcademicOperationsClient, 'createChildUnit'>
    const { CreateAcademicChildUnitForm } = await loadForm()
    render(<CreateAcademicChildUnitForm
      parents={[]}
      client={client}
      authorization={authorization}
      onCreated={vi.fn()}
      onRefresh={vi.fn()}
    />)

    // Act + Assert
    expect(screen.getByRole('button', { name: 'Crear unidad hija' })).toBeDisabled()
    expect(screen.getByText(/se necesita una unidad superior activa/i)).toBeInTheDocument()
    expect(createChildUnit).not.toHaveBeenCalled()
  })
})
