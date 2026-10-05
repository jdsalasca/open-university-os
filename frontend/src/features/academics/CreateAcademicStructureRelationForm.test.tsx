import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AcademicOperationsClient, AcademicOrganizationUnit, AcademicSite } from './academicOperationsContracts'
import { AcademicOperationsApiError } from './academicOperationsClient'

const formModules = import.meta.glob<typeof import('./CreateAcademicStructureRelationForm')>(
  './CreateAcademicStructureRelationForm.tsx',
)

async function loadForm() {
  const loader = formModules['./CreateAcademicStructureRelationForm.tsx']
  expect(loader, 'the protected structure relation form is implemented').toBeTypeOf('function')
  return loader!()
}

afterEach(() => cleanup())

const sites: AcademicSite[] = [
  {
    id: 'b16116a1-10ba-4d79-839b-4195e4851d73',
    code: 'SITE-CENTRAL-TEST',
    type: 'CENTRAL',
    displayName: 'Sede central de prueba',
    displayOrder: 1,
    status: 'ACTIVE',
    validFrom: '2026-01-01',
    validThrough: null,
  },
  {
    id: '34a06170-9acf-4718-854e-92e945a7db17',
    code: 'SITE-CAMPUS-TEST',
    type: 'CAMPUS',
    displayName: 'Campus de prueba',
    displayOrder: 2,
    status: 'ACTIVE',
    validFrom: '2026-01-01',
    validThrough: null,
  },
]

const units: AcademicOrganizationUnit[] = [
  {
    id: 'fae06170-9acf-4718-854e-92e945a7db17',
    code: 'FACULTY-TEST',
    type: 'FACULTY',
    displayName: 'Facultad de prueba',
    displayOrder: 1,
    status: 'ACTIVE',
    validFrom: '2026-01-01',
    validThrough: null,
  },
  {
    id: '127d89c9-a72a-436a-9a90-26da60bc9570',
    code: 'SCHOOL-TEST',
    type: 'SCHOOL',
    displayName: 'Escuela de prueba',
    displayOrder: 2,
    status: 'ACTIVE',
    validFrom: '2026-01-01',
    validThrough: null,
  },
]

describe('CreateAcademicStructureRelationForm', () => {
  it('creates an audited organization hierarchy relation', async () => {
    // Arrange
    const user = userEvent.setup()
    const relateOrganizationUnits = vi.fn().mockResolvedValue(undefined)
    const onCreated = vi.fn().mockResolvedValue(undefined)
    const client = { relateOrganizationUnits } as unknown as Pick<AcademicOperationsClient, 'relateOrganizationUnits'>
    const { CreateAcademicStructureRelationForm } = await loadForm()
    render(
      <CreateAcademicStructureRelationForm
        kind="unit"
        entries={units}
        client={client}
        authorization={{ accessToken: 'institutional-access-token', canRead: true, canWrite: true }}
        onCreated={onCreated}
      />,
    )

    await user.selectOptions(screen.getByLabelText('Unidad superior'), units[0]!.id)
    await user.selectOptions(screen.getByLabelText('Unidad subordinada'), units[1]!.id)
    await user.type(screen.getByLabelText('Referencia institucional'), 'Acuerdo de adscripción de prueba')

    // Act
    await user.click(screen.getByRole('button', { name: 'Vincular unidades' }))

    // Assert
    await waitFor(() => expect(relateOrganizationUnits).toHaveBeenCalledWith(
      units[0]!.id,
      units[1]!.id,
      {
        displayOrder: 0,
        validFrom: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        validThrough: null,
        sourceReference: 'Acuerdo de adscripción de prueba',
      },
      'institutional-access-token',
    ))
    expect(onCreated).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/relación de unidades registrada/i))
  })

  it('creates an audited site hierarchy relation with explicit endpoints and validity', async () => {
    // Arrange
    const user = userEvent.setup()
    const relateSites = vi.fn().mockResolvedValue(undefined)
    const onCreated = vi.fn().mockResolvedValue(undefined)
    const client = { relateSites } as unknown as Pick<AcademicOperationsClient, 'relateSites'>
    const { CreateAcademicStructureRelationForm } = await loadForm()
    render(
      <CreateAcademicStructureRelationForm
        kind="site"
        entries={sites}
        client={client}
        authorization={{ accessToken: 'institutional-access-token', canRead: true, canWrite: true }}
        onCreated={onCreated}
      />,
    )

    await user.selectOptions(screen.getByLabelText('Lugar superior'), sites[0]!.id)
    await user.selectOptions(screen.getByLabelText('Lugar subordinado'), sites[1]!.id)
    await user.clear(screen.getByLabelText('Orden dentro del lugar superior'))
    await user.type(screen.getByLabelText('Orden dentro del lugar superior'), '2')
    await user.type(screen.getByLabelText('Referencia institucional'), 'Resolución de ubicación de prueba')

    // Act
    await user.click(screen.getByRole('button', { name: 'Vincular lugares' }))

    // Assert
    await waitFor(() => expect(relateSites).toHaveBeenCalledWith(
      sites[0]!.id,
      sites[1]!.id,
      {
        displayOrder: 2,
        validFrom: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        validThrough: null,
        sourceReference: 'Resolución de ubicación de prueba',
      },
      'institutional-access-token',
    ))
    expect(onCreated).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/relación de lugares registrada/i))
  })

  it('rejects selecting the same place as parent and child without calling the server', async () => {
    // Arrange
    const user = userEvent.setup()
    const relateSites = vi.fn()
    const client = { relateSites } as unknown as Pick<AcademicOperationsClient, 'relateSites'>
    const { CreateAcademicStructureRelationForm } = await loadForm()
    render(
      <CreateAcademicStructureRelationForm
        kind="site"
        entries={sites}
        client={client}
        authorization={{ accessToken: 'institutional-access-token', canRead: true, canWrite: true }}
        onCreated={vi.fn()}
      />,
    )
    await user.selectOptions(screen.getByLabelText('Lugar superior'), sites[0]!.id)
    await user.selectOptions(screen.getByLabelText('Lugar subordinado'), sites[0]!.id)
    await user.type(screen.getByLabelText('Referencia institucional'), 'Resolución de ubicación de prueba')

    // Act
    await user.click(screen.getByRole('button', { name: 'Vincular lugares' }))

    // Assert
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/deben ser diferentes/i))
    expect(relateSites).not.toHaveBeenCalled()
  })

  it('keeps a cycle conflict visible and reloads the hierarchy before another attempt', async () => {
    // Arrange
    const user = userEvent.setup()
    const relateSites = vi.fn().mockRejectedValue(
      new AcademicOperationsApiError(409, 'Conflicto de estructura'),
    )
    const onCreated = vi.fn()
    const client = { relateSites } as unknown as Pick<AcademicOperationsClient, 'relateSites'>
    const { CreateAcademicStructureRelationForm } = await loadForm()
    render(
      <CreateAcademicStructureRelationForm
        kind="site"
        entries={sites}
        client={client}
        authorization={{ accessToken: 'institutional-access-token', canRead: true, canWrite: true }}
        onCreated={onCreated}
      />,
    )
    await user.selectOptions(screen.getByLabelText('Lugar superior'), sites[0]!.id)
    await user.selectOptions(screen.getByLabelText('Lugar subordinado'), sites[1]!.id)
    await user.type(screen.getByLabelText('Referencia institucional'), 'Referencia para ciclo de prueba')

    // Act
    await user.click(screen.getByRole('button', { name: 'Vincular lugares' }))

    // Assert
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/conflicto.*actualicé la estructura/i))
    expect(onCreated).toHaveBeenCalledTimes(1)
  })
})
