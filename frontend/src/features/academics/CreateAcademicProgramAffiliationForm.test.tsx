import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AcademicProgram } from './contracts'
import type {
  AcademicOperationsClient,
  AcademicOrganizationUnit,
  AcademicSite,
} from './academicOperationsContracts'
import { AcademicOperationsApiError } from './academicOperationsClient'

const formModules = import.meta.glob<typeof import('./CreateAcademicProgramAffiliationForm')>(
  './CreateAcademicProgramAffiliationForm.tsx',
)

async function loadForm() {
  const loader = formModules['./CreateAcademicProgramAffiliationForm.tsx']
  expect(loader, 'the protected program affiliation form is implemented').toBeTypeOf('function')
  return loader!()
}

afterEach(() => cleanup())

const programs: AcademicProgram[] = [{
  id: 'fae06170-9acf-4718-854e-92e945a7db17',
  programCode: 'IS-2026',
  academicLevel: 'PREGRADO',
  studyModality: 'PRESENCIAL',
  campusCode: 'LEGACY-CAMPUS',
  programName: 'Ingeniería de Sistemas',
  faculty: 'Texto legado',
  campusName: 'Texto legado',
}]

const units: AcademicOrganizationUnit[] = [{
  id: '127d89c9-a72a-436a-9a90-26da60bc9570',
  code: 'FAC-TEST',
  type: 'FACULTY',
  displayName: 'Facultad de prueba',
  displayOrder: 1,
  status: 'ACTIVE',
  validFrom: '2026-01-01',
  validThrough: null,
}]

const sites: AcademicSite[] = [{
  id: '34a06170-9acf-4718-854e-92e945a7db17',
  code: 'SITE-TEST',
  type: 'CAMPUS',
  displayName: 'Campus de prueba',
  displayOrder: 1,
  status: 'ACTIVE',
  validFrom: '2026-01-01',
  validThrough: null,
}]

describe('CreateAcademicProgramAffiliationForm', () => {
  it('creates an audited program affiliation from explicit catalog identities', async () => {
    // Arrange
    const user = userEvent.setup()
    const affiliateProgram = vi.fn().mockResolvedValue(undefined)
    const onCreated = vi.fn().mockResolvedValue(undefined)
    const client = { affiliateProgram } as unknown as Pick<AcademicOperationsClient, 'affiliateProgram'>
    const { CreateAcademicProgramAffiliationForm } = await loadForm()
    render(
      <CreateAcademicProgramAffiliationForm
        programs={programs}
        units={units}
        sites={sites}
        client={client}
        authorization={{ accessToken: 'institutional-access-token', canRead: true, canWrite: true }}
        onCreated={onCreated}
      />,
    )

    await user.selectOptions(screen.getByLabelText('Programa publicado'), programs[0]!.id)
    await user.selectOptions(screen.getByLabelText('Unidad responsable'), units[0]!.id)
    await user.selectOptions(screen.getByLabelText('Lugar de desarrollo'), sites[0]!.id)
    await user.clear(screen.getByLabelText('Orden del programa en la unidad'))
    await user.type(screen.getByLabelText('Orden del programa en la unidad'), '4')
    await user.clear(screen.getByLabelText('Vigente desde'))
    await user.type(screen.getByLabelText('Vigente desde'), '2026-10-01')
    await user.type(screen.getByLabelText('Referencia institucional'), 'Resolución de adscripción de prueba')

    // Act
    await user.click(screen.getByRole('button', { name: 'Crear afiliación' }))

    // Assert
    await waitFor(() => expect(affiliateProgram).toHaveBeenCalledWith(
      programs[0]!.id,
      {
        organizationUnitId: units[0]!.id,
        siteId: sites[0]!.id,
        displayOrder: 4,
        validFrom: '2026-10-01',
        validThrough: null,
        sourceReference: 'Resolución de adscripción de prueba',
      },
      'institutional-access-token',
    ))
    expect(onCreated).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/afiliación.*registrada/i))
  })

  it('refreshes after a program affiliation conflict without retrying the write', async () => {
    // Arrange
    const user = userEvent.setup()
    const affiliateProgram = vi.fn().mockRejectedValue(new AcademicOperationsApiError(409, 'Conflicto'))
    const onCreated = vi.fn().mockResolvedValue(undefined)
    const client = { affiliateProgram } as unknown as Pick<AcademicOperationsClient, 'affiliateProgram'>
    const { CreateAcademicProgramAffiliationForm } = await loadForm()
    render(
      <CreateAcademicProgramAffiliationForm
        programs={programs}
        units={units}
        sites={sites}
        client={client}
        authorization={{ accessToken: 'institutional-access-token', canRead: true, canWrite: true }}
        onCreated={onCreated}
      />,
    )
    await user.selectOptions(screen.getByLabelText('Programa publicado'), programs[0]!.id)
    await user.selectOptions(screen.getByLabelText('Unidad responsable'), units[0]!.id)
    await user.selectOptions(screen.getByLabelText('Lugar de desarrollo'), sites[0]!.id)
    await user.type(screen.getByLabelText('Referencia institucional'), 'Referencia de conflicto')

    // Act
    await user.click(screen.getByRole('button', { name: 'Crear afiliación' }))

    // Assert
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/conflicto.*actualicé la estructura/i))
    expect(affiliateProgram).toHaveBeenCalledTimes(1)
    expect(onCreated).toHaveBeenCalledTimes(1)
  })

  it('revalidates authorization when the server rejects an affiliation write', async () => {
    // Arrange
    const user = userEvent.setup()
    const affiliateProgram = vi.fn().mockRejectedValue(new AcademicOperationsApiError(403, 'Forbidden'))
    const onAuthorizationRejected = vi.fn().mockResolvedValue(undefined)
    const client = { affiliateProgram } as unknown as Pick<AcademicOperationsClient, 'affiliateProgram'>
    const { CreateAcademicProgramAffiliationForm } = await loadForm()
    render(
      <CreateAcademicProgramAffiliationForm
        programs={programs}
        units={units}
        sites={sites}
        client={client}
        authorization={{ accessToken: 'institutional-access-token', canRead: true, canWrite: true }}
        onCreated={vi.fn()}
        onAuthorizationRejected={onAuthorizationRejected}
      />,
    )
    await user.selectOptions(screen.getByLabelText('Programa publicado'), programs[0]!.id)
    await user.selectOptions(screen.getByLabelText('Unidad responsable'), units[0]!.id)
    await user.selectOptions(screen.getByLabelText('Lugar de desarrollo'), sites[0]!.id)
    await user.type(screen.getByLabelText('Referencia institucional'), 'Referencia de permisos')

    // Act
    await user.click(screen.getByRole('button', { name: 'Crear afiliación' }))

    // Assert
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/negó el permiso.*volviendo a comprobar/i))
    expect(onAuthorizationRejected).toHaveBeenCalledWith('institutional-access-token')
  })

  it('keeps the submit action disabled until a program, unit and site are available', async () => {
    // Arrange
    const affiliateProgram = vi.fn()
    const client = { affiliateProgram } as unknown as Pick<AcademicOperationsClient, 'affiliateProgram'>
    const { CreateAcademicProgramAffiliationForm } = await loadForm()
    render(
      <CreateAcademicProgramAffiliationForm
        programs={[]}
        units={[]}
        sites={[]}
        client={client}
        authorization={{ accessToken: 'institutional-access-token', canRead: true, canWrite: true }}
        onCreated={vi.fn()}
      />,
    )

    // Act
    const submit = screen.getByRole('button', { name: 'Crear afiliación' })

    // Assert
    expect(submit).toBeDisabled()
    expect(screen.getByText(/requiere un programa publicado, una unidad y un lugar/i)).toBeVisible()
    expect(affiliateProgram).not.toHaveBeenCalled()
  })
})
