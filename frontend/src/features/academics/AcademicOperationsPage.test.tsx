import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AcademicProgram } from './contracts'
import type { AcademicOperationsClient, AcademicPeriod, AcademicStructureSnapshot } from './academicOperationsContracts'
import { AcademicOperationsApiError } from './academicOperationsClient'

const pageModules = import.meta.glob<typeof import('./AcademicOperationsPage')>('./AcademicOperationsPage.tsx')

async function loadPage() {
  const loader = pageModules['./AcademicOperationsPage.tsx']
  expect(loader, 'the academic operations page is implemented').toBeTypeOf('function')
  return loader!()
}

afterEach(() => cleanup())

const structure: AcademicStructureSnapshot = {
  units: [
    {
      id: 'fae06170-9acf-4718-854e-92e945a7db17',
      code: 'FAC-CIENCIAS',
      type: 'FACULTY',
      displayName: 'Facultad de Ciencias',
      displayOrder: 2,
      status: 'ACTIVE',
      validFrom: '2026-01-01',
      validThrough: null,
    },
    {
      id: '127d89c9-a72a-436a-9a90-26da60bc9570',
      code: 'ESC-SISTEMAS',
      type: 'SCHOOL',
      displayName: 'Escuela de Sistemas',
      displayOrder: 1,
      status: 'ACTIVE',
      validFrom: '2026-01-01',
      validThrough: null,
    },
  ],
  organizationRelations: [{
    parentUnitId: 'fae06170-9acf-4718-854e-92e945a7db17',
    childUnitId: '127d89c9-a72a-436a-9a90-26da60bc9570',
    displayOrder: 1,
    validFrom: '2026-01-01',
    validThrough: null,
  }],
  sites: [{
    id: 'b16116a1-10ba-4d79-839b-4195e4851d73',
    code: 'TUNJA',
    type: 'CENTRAL',
    displayName: 'Sede Central Tunja',
    displayOrder: 1,
    status: 'ACTIVE',
    validFrom: '2026-01-01',
    validThrough: null,
  }],
  siteRelations: [],
  programAffiliations: [{
    id: '8ab62b62-b65b-4b70-9bf0-df868abfe7eb',
    programId: 'b31e24c4-4b0e-4b79-8480-ae5f26105646',
    organizationUnitId: '127d89c9-a72a-436a-9a90-26da60bc9570',
    siteId: 'b16116a1-10ba-4d79-839b-4195e4851d73',
    displayOrder: 1,
    validFrom: '2026-01-01',
    validThrough: null,
    sourceReference: 'Resolución de prueba',
  }],
}

const regularPeriod: AcademicPeriod = {
  id: 'fb750786-79cc-49cf-9814-0f1047c76ba4',
  code: '2026-2',
  kind: 'REGULAR',
  academicYear: 2026,
  sequenceNumber: 2,
  startsOn: '2026-07-15',
  endsOn: '2026-12-18',
  status: 'OPEN',
  calendarRevisionId: '7ecfa4a1-52f6-4b56-9b3c-8fc0cebdc98f',
  calendarRevisionNumber: 1,
  approvalReference: 'Acuerdo de calendario institucional de prueba',
  officialReference: 'Calendario institucional de prueba',
  createdAt: '2026-06-15T10:00:00Z',
}

const intersemester: AcademicPeriod = {
  ...regularPeriod,
  id: '92e76bd6-d8c9-4c28-a6c9-7e54f69668bb',
  code: '2026-INT-1',
  kind: 'INTERSEMESTRAL',
  sequenceNumber: 1,
  startsOn: '2026-06-01',
  endsOn: '2026-06-30',
}

const programs: AcademicProgram[] = [{
  id: 'b31e24c4-4b0e-4b79-8480-ae5f26105646',
  programCode: 'ING-SIS',
  academicLevel: 'PREGRADO',
  studyModality: 'PRESENCIAL',
  campusCode: 'LEGACY-DUITAMA',
  programName: 'Ingeniería de Sistemas',
  faculty: 'Texto legado que no se usa como relación',
  campusName: 'Texto legado que no se usa como relación',
}, {
  id: '8a751e5d-65ad-4a33-b48c-d95ae7b07915',
  programCode: 'AAA-PROG',
  academicLevel: 'PREGRADO',
  studyModality: 'PRESENCIAL',
  campusCode: 'LEGACY-BOGOTA',
  programName: 'Programa ordenado después',
  faculty: 'Texto legado que no se usa como relación',
  campusName: 'Texto legado que no se usa como relación',
}]

const structureWithOrderedPrograms: AcademicStructureSnapshot = {
  ...structure,
  programAffiliations: [
    ...structure.programAffiliations,
    {
      ...structure.programAffiliations[0]!,
      id: 'c4011f06-4a61-42f2-8e28-24b71ff8ee12',
      programId: '8a751e5d-65ad-4a33-b48c-d95ae7b07915',
      displayOrder: 9,
    },
  ],
}

const structureWithAllOrderTargets: AcademicStructureSnapshot = {
  ...structure,
  sites: [
    ...structure.sites,
    {
      id: 'bb783bf7-0fbb-48d5-9c49-17240492ef6e',
      code: 'SECCIONAL-CHIQUINQUIRA',
      type: 'SECCIONAL',
      displayName: 'Seccional Chiquinquirá',
      displayOrder: 4,
      status: 'ACTIVE',
      validFrom: '2026-01-01',
      validThrough: null,
    },
  ],
  siteRelations: [{
    parentSiteId: 'b16116a1-10ba-4d79-839b-4195e4851d73',
    childSiteId: 'bb783bf7-0fbb-48d5-9c49-17240492ef6e',
    displayOrder: 4,
    validFrom: '2026-01-01',
    validThrough: null,
  }],
}

function createClient(overrides: Partial<AcademicOperationsClient> = {}): AcademicOperationsClient {
  return {
    getStructure: vi.fn().mockResolvedValue(structure),
    getAdminStructure: vi.fn().mockResolvedValue(structure),
    getOpenPeriods: vi.fn().mockResolvedValue([regularPeriod, intersemester]),
    getAdminPeriods: vi.fn().mockResolvedValue([regularPeriod, intersemester]),
    getPeriodHistory: vi.fn().mockResolvedValue({ period: regularPeriod, calendarRevisions: [], auditEvents: [] }),
    getStructureAuditEvents: vi.fn().mockResolvedValue({ events: [], nextCursor: null }),
    createPeriod: vi.fn().mockResolvedValue(regularPeriod),
    createCalendar: vi.fn().mockResolvedValue({}),
    publishCalendar: vi.fn().mockResolvedValue({}),
    approvePeriod: vi.fn().mockResolvedValue(regularPeriod),
    createOrganizationUnit: vi.fn().mockResolvedValue('34a06170-9acf-4718-854e-92e945a7db17'),
    createChildUnit: vi.fn().mockResolvedValue('94a06170-9acf-4718-854e-92e945a7db17'),
    closeOrganizationRelation: vi.fn().mockResolvedValue(undefined),
    createSite: vi.fn().mockResolvedValue('94a06170-9acf-4718-854e-92e945a7db17'),
    closeSiteRelation: vi.fn().mockResolvedValue(undefined),
    relateOrganizationUnits: vi.fn().mockResolvedValue(undefined),
    relateSites: vi.fn().mockResolvedValue(undefined),
    affiliateProgram: vi.fn().mockResolvedValue(undefined),
    reassignProgramAffiliation: vi.fn().mockResolvedValue('34a06170-9acf-4718-854e-92e945a7db17'),
    closeProgramAffiliation: vi.fn().mockResolvedValue(undefined),
    openPeriod: vi.fn().mockImplementation(async (_periodId: string, _accessToken: string) => ({
      ...regularPeriod,
      status: 'OPEN',
    })),
    closePeriod: vi.fn().mockImplementation(async (_periodId: string, _accessToken: string) => ({
      ...regularPeriod,
      status: 'CLOSED',
    })),
    changeOrganizationUnitOrder: vi.fn().mockResolvedValue(undefined),
    changeSiteOrder: vi.fn().mockResolvedValue(undefined),
    changeOrganizationRelationOrder: vi.fn().mockResolvedValue(undefined),
    changeSiteRelationOrder: vi.fn().mockResolvedValue(undefined),
    changeProgramAffiliationOrder: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('AcademicOperationsPage', () => {
  it('loads and displays the structure audit panel only for readers with administrative structure access', async () => {
    // Arrange
    const { AcademicOperationsPage } = await loadPage()
    const client = createClient()
    const { rerender } = render(<AcademicOperationsPage client={client} loadPrograms={async () => programs} />)
    await screen.findByRole('heading', { name: /estructura y periodos académicos/i })

    // Act + Assert: public visitors cannot query or view the administrative log.
    expect(screen.queryByRole('heading', { name: /bitácora de estructura académica/i })).not.toBeInTheDocument()
    expect(client.getStructureAuditEvents).not.toHaveBeenCalled()

    rerender(<AcademicOperationsPage client={client} loadPrograms={async () => programs}
      structureAuthorization={{ accessToken: 'synthetic-structure-token', canRead: true, canWrite: false }} />)

    // Assert
    expect(await screen.findByRole('heading', { name: /bitácora de estructura académica/i })).toBeInTheDocument()
    await waitFor(() => expect(client.getStructureAuditEvents).toHaveBeenCalledOnce())
    expect(client.getStructureAuditEvents).toHaveBeenCalledWith(
      { limit: 50 }, 'synthetic-structure-token', expect.any(AbortSignal))

    // Act: revoking the server-confirmed read permission hides and clears the log.
    rerender(<AcademicOperationsPage client={client} loadPrograms={async () => programs}
      structureAuthorization={{ accessToken: 'synthetic-structure-token', canRead: false, canWrite: false }} />)

    // Assert
    expect(screen.queryByRole('heading', { name: /bitácora de estructura académica/i })).not.toBeInTheDocument()
  })

  it('shows reassignment only when administrative read and write permissions are both present', async () => {
    // Arrange
    const { AcademicOperationsPage } = await loadPage()
    const client = createClient()
    const { rerender } = render(<AcademicOperationsPage client={client} loadPrograms={async () => programs} />)

    // Assert public view does not expose the administrative form.
    await screen.findByRole('heading', { name: /estructura y periodos académicos/i })
    expect(screen.queryByRole('heading', { name: /reasignar programa entre unidades y sedes/i }))
      .not.toBeInTheDocument()

    // Act read-only
    rerender(<AcademicOperationsPage client={client} loadPrograms={async () => programs}
      structureAuthorization={{ accessToken: 'synthetic-structure-token', canRead: true, canWrite: false }} />)

    // Assert
    await screen.findByRole('heading', { name: 'Programas, unidades y lugares' })
    expect(screen.queryByRole('heading', { name: /reasignar programa entre unidades y sedes/i }))
      .not.toBeInTheDocument()

    // Act read + write
    rerender(<AcademicOperationsPage client={client} loadPrograms={async () => programs}
      structureAuthorization={{ accessToken: 'synthetic-structure-token', canRead: true, canWrite: true }} />)

    // Assert
    expect(await screen.findByRole('heading', { name: /reasignar programa entre unidades y sedes/i }))
      .toBeVisible()
  })

  it('submits one reviewed reassignment and reloads public and administrative structure', async () => {
    // Arrange
    const user = userEvent.setup()
    const { AcademicOperationsPage } = await loadPage()
    const updatedAdminStructure: AcademicStructureSnapshot = {
      ...structure,
      programAffiliations: [
        { ...structure.programAffiliations[0]!, validThrough: '2027-05-31' },
        {
          ...structure.programAffiliations[0]!,
          id: '34a06170-9acf-4718-854e-92e945a7db17',
          organizationUnitId: structure.units[0]!.id,
          validFrom: '2027-06-01',
          displayOrder: 4,
          sourceReference: 'Acta de reasignación confirmada',
        },
      ],
    }
    const getStructure = vi.fn().mockResolvedValue(structure)
    const getAdminStructure = vi.fn().mockResolvedValueOnce(structure).mockResolvedValueOnce(updatedAdminStructure)
    const reassignProgramAffiliation = vi.fn().mockResolvedValue('34a06170-9acf-4718-854e-92e945a7db17')
    const client = createClient({ getStructure, getAdminStructure, reassignProgramAffiliation })
    render(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      structureAuthorization={{ accessToken: 'synthetic-structure-token', canRead: true, canWrite: true }}
    />)
    const form = within(await screen.findByRole('region', { name: /reasignar programa entre unidades y sedes/i }))

    // Act
    await user.selectOptions(form.getByLabelText('Adscripción de origen'), structure.programAffiliations[0]!.id)
    await user.selectOptions(form.getByLabelText('Nueva unidad responsable'), structure.units[0]!.id)
    await user.selectOptions(form.getByLabelText('Nueva sede de desarrollo'), structure.sites[0]!.id)
    await user.type(form.getByLabelText('Fecha efectiva de reasignación'), '2027-06-01')
    await user.type(form.getByLabelText('Orden del programa en la unidad'), '4')
    await user.type(form.getByLabelText('Referencia institucional'), 'Acta de reasignación confirmada')
    await user.click(form.getByRole('button', { name: 'Revisar reasignación' }))
    const confirmation = await screen.findByRole('group', { name: 'Confirmar reasignación' })
    await user.click(within(confirmation).getByRole('button', { name: 'Confirmar reasignación' }))

    // Assert
    await waitFor(() => expect(reassignProgramAffiliation).toHaveBeenCalledOnce())
    await screen.findByText(/Prioridad 4 · Acta de reasignación confirmada/)
    expect(getStructure).toHaveBeenCalledTimes(2)
    expect(getAdminStructure).toHaveBeenCalledTimes(2)
    expect(reassignProgramAffiliation).toHaveBeenCalledWith(programs[0]!.id, structure.programAffiliations[0]!.id, {
      expectedValidFrom: '2026-01-01',
      expectedValidThrough: null,
      effectiveFrom: '2027-06-01',
      organizationUnitId: structure.units[0]!.id,
      siteId: structure.sites[0]!.id,
      displayOrder: 4,
      sourceReference: 'Acta de reasignación confirmada',
    }, 'synthetic-structure-token')
  })

  it('reloads both structure snapshots after a reassignment conflict without retrying', async () => {
    // Arrange
    const user = userEvent.setup()
    const { AcademicOperationsPage } = await loadPage()
    const getStructure = vi.fn().mockResolvedValue(structure)
    const getAdminStructure = vi.fn().mockResolvedValue(structure)
    const reassignProgramAffiliation = vi.fn().mockRejectedValue(new AcademicOperationsApiError(409, 'Conflict'))
    const client = createClient({ getStructure, getAdminStructure, reassignProgramAffiliation })
    render(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      structureAuthorization={{ accessToken: 'synthetic-structure-token', canRead: true, canWrite: true }}
    />)
    const form = within(await screen.findByRole('region', { name: /reasignar programa entre unidades y sedes/i }))

    // Act
    await user.selectOptions(form.getByLabelText('Adscripción de origen'), structure.programAffiliations[0]!.id)
    await user.selectOptions(form.getByLabelText('Nueva unidad responsable'), structure.units[0]!.id)
    await user.selectOptions(form.getByLabelText('Nueva sede de desarrollo'), structure.sites[0]!.id)
    await user.type(form.getByLabelText('Fecha efectiva de reasignación'), '2027-06-01')
    await user.type(form.getByLabelText('Orden del programa en la unidad'), '4')
    await user.type(form.getByLabelText('Referencia institucional'), 'Referencia de conflicto')
    await user.click(form.getByRole('button', { name: 'Revisar reasignación' }))
    const confirmation = await screen.findByRole('group', { name: 'Confirmar reasignación' })
    await user.click(within(confirmation).getByRole('button', { name: 'Confirmar reasignación' }))

    // Assert
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/conflicto.*actualicé la estructura/i))
    expect(reassignProgramAffiliation).toHaveBeenCalledOnce()
    expect(getStructure).toHaveBeenCalledTimes(2)
    expect(getAdminStructure).toHaveBeenCalledTimes(2)
  })

  it('shows the dated relation closure control only inside the authorized structure console', async () => {
    // Arrange
    const { AcademicOperationsPage } = await loadPage()
    const client = createClient()
    render(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      structureAuthorization={{ accessToken: 'synthetic-structure-token', canRead: true, canWrite: true }}
    />)

    // Act
    const relationSelector = await screen.findByLabelText('Relación de unidades')

    // Assert
    expect(relationSelector).toBeVisible()
    expect(within(relationSelector).getByRole('option', {
      name: /Facultad de Ciencias → Escuela de Sistemas.*Desde 2026-01-01.*Sin cierre/i,
    })).toBeInTheDocument()
    expect(client.closeOrganizationRelation).not.toHaveBeenCalled()
    const affiliationSelector = await screen.findByLabelText('Adscripción de programa')
    expect(affiliationSelector).toBeVisible()
    expect(within(affiliationSelector).getByRole('option', {
      name: /Ingeniería de Sistemas → Escuela de Sistemas · Sede Central Tunja.*Desde 2026-01-01.*Sin cierre/i,
    })).toBeInTheDocument()
  })

  it('shows the dated site-relation closure control in the authorized site panel', async () => {
    // Arrange
    const { AcademicOperationsPage } = await loadPage()
    const regionalSite = {
      ...structure.sites[0]!,
      id: 'bb783bf7-0fbb-48d5-9c49-17240492ef6e',
      code: 'CHIQUINQUIRA',
      type: 'SECCIONAL' as const,
      displayName: 'Seccional Chiquinquirá',
    }
    const siteStructure: AcademicStructureSnapshot = {
      ...structure,
      sites: [...structure.sites, regionalSite],
      siteRelations: [{
        parentSiteId: structure.sites[0]!.id,
        childSiteId: regionalSite.id,
        displayOrder: 1,
        validFrom: '2026-01-01',
        validThrough: null,
      }],
    }
    const client = createClient({
      getStructure: vi.fn().mockResolvedValue(siteStructure),
      getAdminStructure: vi.fn().mockResolvedValue(siteStructure),
    })
    render(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      structureAuthorization={{ accessToken: 'synthetic-structure-token', canRead: true, canWrite: true }}
    />)

    // Act
    const relationSelector = await screen.findByLabelText('Relación de sedes')

    // Assert
    expect(relationSelector).toBeVisible()
    expect(within(relationSelector).getByRole('option', {
      name: /Sede Central Tunja → Seccional Chiquinquirá.*Desde 2026-01-01.*Sin cierre/i,
    })).toBeInTheDocument()
    expect(client.closeSiteRelation).not.toHaveBeenCalled()
  })

  it('orders sibling units and sites by relationship order while preserving root order', async () => {
    // Arrange
    const { AcademicOperationsPage } = await loadPage()
    const facultyRootFirst = {
      ...structure.units[0]!,
      id: '3378ef0f-1091-4e8b-a7d2-b8c05b7b9b17',
      code: 'FAC-ROOT-FIRST',
      displayName: 'Facultad raíz primero',
      displayOrder: 1,
    }
    const schoolNodeFirst = {
      ...structure.units[1]!,
      id: 'a99f11b6-5fce-40d0-bc57-63da94397e89',
      code: 'ESC-NODE-FIRST',
      displayName: 'Escuela primero por nodo',
      displayOrder: 1,
    }
    const schoolRelationFirst = {
      ...structure.units[1]!,
      id: 'b7ac56e5-210f-4f0a-a4b4-6dbf8f4d5192',
      code: 'ESC-RELATION-FIRST',
      displayName: 'Escuela primero por relación',
      displayOrder: 2,
    }
    const schoolTieZulu = {
      ...structure.units[1]!,
      id: 'c72e5da1-7d8e-463e-8916-d13126c55fb9',
      code: 'ESC-TIE-Z',
      displayName: 'Escuela empate Z',
      displayOrder: 3,
    }
    const schoolTieAlpha = {
      ...structure.units[1]!,
      id: 'b9f98965-b868-4eb6-8e20-02bd74dfef97',
      code: 'ESC-TIE-A',
      displayName: 'Escuela empate A',
      displayOrder: 3,
    }
    const siteRootFirst = {
      ...structure.sites[0]!,
      id: 'f1df48de-5279-4a62-a067-4c0ed5724ebc',
      code: 'SITE-ROOT-FIRST',
      displayName: 'Sede raíz primero',
      displayOrder: 0,
    }
    const siteNodeFirst = {
      ...structure.sites[0]!,
      id: '342f4fd1-353b-4f78-a6d5-695915956efc',
      code: 'SITE-NODE-FIRST',
      type: 'REGIONAL' as const,
      displayName: 'Sede primero por nodo',
      displayOrder: 1,
    }
    const siteRelationFirst = {
      ...structure.sites[0]!,
      id: '9cb298c8-a70a-48dc-a870-24da32191f4d',
      code: 'SITE-RELATION-FIRST',
      type: 'REGIONAL' as const,
      displayName: 'Sede primero por relación',
      displayOrder: 2,
    }
    const siteTieZulu = {
      ...structure.sites[0]!,
      id: '372aab0b-520a-4bf1-9ad9-ed2021483cee',
      code: 'SITE-TIE-Z',
      type: 'REGIONAL' as const,
      displayName: 'Sede empate Z',
      displayOrder: 3,
    }
    const siteTieAlpha = {
      ...structure.sites[0]!,
      id: '8349a8c1-3dcb-4bec-8a1d-4105dbdc8450',
      code: 'SITE-TIE-A',
      type: 'REGIONAL' as const,
      displayName: 'Sede empate A',
      displayOrder: 3,
    }
    const orderedStructure: AcademicStructureSnapshot = {
      ...structure,
      units: [...structure.units, facultyRootFirst, schoolNodeFirst, schoolRelationFirst, schoolTieZulu, schoolTieAlpha],
      organizationRelations: [
        { ...structure.organizationRelations[0]!, displayOrder: 12 },
        {
          parentUnitId: structure.units[0]!.id,
          childUnitId: schoolNodeFirst.id,
          displayOrder: 8,
          validFrom: '2026-01-01',
          validThrough: null,
        },
        {
          parentUnitId: structure.units[0]!.id,
          childUnitId: schoolRelationFirst.id,
          displayOrder: 2,
          validFrom: '2026-01-01',
          validThrough: null,
        },
        {
          parentUnitId: structure.units[0]!.id,
          childUnitId: schoolTieZulu.id,
          displayOrder: 5,
          validFrom: '2026-01-01',
          validThrough: null,
        },
        {
          parentUnitId: structure.units[0]!.id,
          childUnitId: schoolTieAlpha.id,
          displayOrder: 5,
          validFrom: '2026-01-01',
          validThrough: null,
        },
      ],
      sites: [...structure.sites, siteRootFirst, siteNodeFirst, siteRelationFirst, siteTieZulu, siteTieAlpha],
      siteRelations: [
        {
          parentSiteId: structure.sites[0]!.id,
          childSiteId: siteNodeFirst.id,
          displayOrder: 8,
          validFrom: '2026-01-01',
          validThrough: null,
        },
        {
          parentSiteId: structure.sites[0]!.id,
          childSiteId: siteRelationFirst.id,
          displayOrder: 2,
          validFrom: '2026-01-01',
          validThrough: null,
        },
        {
          parentSiteId: structure.sites[0]!.id,
          childSiteId: siteTieZulu.id,
          displayOrder: 5,
          validFrom: '2026-01-01',
          validThrough: null,
        },
        {
          parentSiteId: structure.sites[0]!.id,
          childSiteId: siteTieAlpha.id,
          displayOrder: 5,
          validFrom: '2026-01-01',
          validThrough: null,
        },
      ],
    }
    const client = createClient({ getStructure: vi.fn().mockResolvedValue(orderedStructure) })
    render(<AcademicOperationsPage client={client} loadPrograms={async () => programs} />)

    // Act
    await screen.findByRole('heading', { name: /estructura y periodos académicos/i })

    // Assert
    const organizationRoots = screen.getByRole('list', { name: 'Jerarquía académica' })
    expect(organizationRoots.children[0]).toHaveTextContent('Facultad raíz primero')
    expect(organizationRoots.children[0]?.querySelector('.academic-sort-order')).toHaveTextContent('01')
    const faculty = screen.getByText('Facultad de Ciencias').closest('li')!
    const unitChildren = faculty.querySelector(':scope > ul')!
    expect(unitChildren.children[0]).toHaveTextContent('Escuela primero por relación')
    expect(unitChildren.children[1]).toHaveTextContent('Escuela empate A')
    expect(unitChildren.children[2]).toHaveTextContent('Escuela empate Z')
    expect(unitChildren.children[3]).toHaveTextContent('Escuela primero por nodo')
    expect(unitChildren.children[0]?.querySelector('.academic-sort-order')).toHaveTextContent('02')
    expect(unitChildren.children[1]?.querySelector('.academic-sort-order')).toHaveTextContent('05')
    expect(unitChildren.children[2]?.querySelector('.academic-sort-order')).toHaveTextContent('05')
    expect(unitChildren.children[3]?.querySelector('.academic-sort-order')).toHaveTextContent('08')

    const siteRoots = screen.getByRole('list', { name: 'Jerarquía de sedes' })
    expect(siteRoots.children[0]).toHaveTextContent('Sede raíz primero')
    expect(siteRoots.children[0]?.querySelector('.academic-sort-order')).toHaveTextContent('00')
    const centralSite = screen.getByText('Sede Central Tunja').closest('li')!
    const siteChildren = centralSite.querySelector(':scope > ul')!
    expect(siteChildren.children[0]).toHaveTextContent('Sede primero por relación')
    expect(siteChildren.children[1]).toHaveTextContent('Sede empate A')
    expect(siteChildren.children[2]).toHaveTextContent('Sede empate Z')
    expect(siteChildren.children[3]).toHaveTextContent('Sede primero por nodo')
    expect(siteChildren.children[0]?.querySelector('.academic-sort-order')).toHaveTextContent('02')
    expect(siteChildren.children[1]?.querySelector('.academic-sort-order')).toHaveTextContent('05')
    expect(siteChildren.children[2]?.querySelector('.academic-sort-order')).toHaveTextContent('05')
    expect(siteChildren.children[3]?.querySelector('.academic-sort-order')).toHaveTextContent('08')
  })

  it('shows audited order controls only when administrative read and write permissions are present', async () => {
    // Arrange
    const { AcademicOperationsPage } = await loadPage()
    const client = createClient({
      getStructure: vi.fn().mockResolvedValue(structureWithAllOrderTargets),
      getAdminStructure: vi.fn().mockResolvedValue(structureWithAllOrderTargets),
    })
    const { rerender } = render(<AcademicOperationsPage client={client} loadPrograms={async () => programs} />)

    // Act + Assert: public readers continue to see persisted order without write controls.
    expect(await screen.findByText('Seccional Chiquinquirá')).toBeVisible()
    expect(screen.queryByRole('button', { name: /cambiar orden de/i })).not.toBeInTheDocument()

    // Act: write permission without administrative read cannot expose structure controls.
    rerender(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      structureAuthorization={{ accessToken: 'synthetic-structure-token', canRead: false, canWrite: true }}
    />)
    expect(screen.queryByRole('button', { name: /cambiar orden de/i })).not.toBeInTheDocument()

    // Act: read and write permissions select the complete administrative structure.
    rerender(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      structureAuthorization={{ accessToken: 'synthetic-structure-token', canRead: true, canWrite: true }}
    />)

    // Assert
    for (const name of [
      'Facultad de Ciencias',
      'Escuela de Sistemas',
      'Sede Central Tunja',
      'Seccional Chiquinquirá',
      'Ingeniería de Sistemas',
    ]) {
      expect(await screen.findByRole('button', { name: `Cambiar orden de ${name}` })).toBeVisible()
    }
  })

  it('saves a unit priority with its expected value and source reference, then refreshes from the server', async () => {
    // Arrange
    const user = userEvent.setup()
    const { AcademicOperationsPage } = await loadPage()
    const updatedStructure: AcademicStructureSnapshot = {
      ...structureWithAllOrderTargets,
      units: structureWithAllOrderTargets.units.map((unit) => unit.id === structure.units[0]!.id
        ? { ...unit, displayOrder: 7 }
        : unit),
    }
    const getStructure = vi.fn()
      .mockResolvedValueOnce(structureWithAllOrderTargets)
      .mockResolvedValueOnce(updatedStructure)
    const getAdminStructure = vi.fn()
      .mockResolvedValueOnce(structureWithAllOrderTargets)
      .mockResolvedValueOnce(updatedStructure)
    const changeOrganizationUnitOrder = vi.fn().mockResolvedValue(undefined)
    const client = createClient({ getStructure, getAdminStructure, changeOrganizationUnitOrder })
    render(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      structureAuthorization={{ accessToken: 'synthetic-structure-token', canRead: true, canWrite: true }}
    />)

    // Act
    await user.click(await screen.findByRole('button', { name: 'Cambiar orden de Facultad de Ciencias' }))
    await user.clear(screen.getByLabelText('Nuevo orden de Facultad de Ciencias'))
    await user.type(screen.getByLabelText('Nuevo orden de Facultad de Ciencias'), '7')
    await user.type(screen.getByLabelText('Referencia institucional de Facultad de Ciencias'), 'Resolución 123 de 2026')
    await user.click(screen.getByRole('button', { name: 'Guardar orden de Facultad de Ciencias' }))

    // Assert
    expect(changeOrganizationUnitOrder).toHaveBeenCalledWith(
      structure.units[0]!.id,
      { expectedDisplayOrder: 2, displayOrder: 7, sourceReference: 'Resolución 123 de 2026' },
      'synthetic-structure-token',
    )
    expect(getAdminStructure).toHaveBeenCalledTimes(2)
    expect(await screen.findByText('07')).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent(/prioridad actualizada/i)
  })

  it('refreshes the displayed structure and reports a concurrent order conflict', async () => {
    // Arrange
    const user = userEvent.setup()
    const { AcademicOperationsPage } = await loadPage()
    const concurrentStructure: AcademicStructureSnapshot = {
      ...structureWithAllOrderTargets,
      sites: structureWithAllOrderTargets.sites.map((site) => site.id === structure.sites[0]!.id
        ? { ...site, displayOrder: 8 }
        : site),
    }
    const getStructure = vi.fn()
      .mockResolvedValueOnce(structureWithAllOrderTargets)
      .mockResolvedValueOnce(concurrentStructure)
    const getAdminStructure = vi.fn()
      .mockResolvedValueOnce(structureWithAllOrderTargets)
      .mockResolvedValueOnce(concurrentStructure)
    const changeSiteOrder = vi.fn().mockRejectedValue(new AcademicOperationsApiError(409, 'Conflict'))
    const client = createClient({ getStructure, getAdminStructure, changeSiteOrder })
    render(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      structureAuthorization={{ accessToken: 'synthetic-structure-token', canRead: true, canWrite: true }}
    />)

    // Act
    await user.click(await screen.findByRole('button', { name: 'Cambiar orden de Sede Central Tunja' }))
    await user.clear(screen.getByLabelText('Nuevo orden de Sede Central Tunja'))
    await user.type(screen.getByLabelText('Nuevo orden de Sede Central Tunja'), '5')
    await user.type(screen.getByLabelText('Referencia institucional de Sede Central Tunja'), 'Acta de organización 8')
    await user.click(screen.getByRole('button', { name: 'Guardar orden de Sede Central Tunja' }))

    // Assert
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/estructura cambió|prioridad cambió/i))
    expect(getAdminStructure).toHaveBeenCalledTimes(2)
    expect(await screen.findByText('08')).toBeVisible()
    expect(changeSiteOrder).toHaveBeenCalledOnce()
  })

  it('rejects a negative order before sending a structure mutation', async () => {
    // Arrange
    const user = userEvent.setup()
    const { AcademicOperationsPage } = await loadPage()
    const changeOrganizationUnitOrder = vi.fn().mockResolvedValue(undefined)
    const client = createClient({ changeOrganizationUnitOrder })
    render(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      structureAuthorization={{ accessToken: 'synthetic-structure-token', canRead: true, canWrite: true }}
    />)

    // Act
    await user.click(await screen.findByRole('button', { name: 'Cambiar orden de Facultad de Ciencias' }))
    await user.clear(screen.getByLabelText('Nuevo orden de Facultad de Ciencias'))
    await user.type(screen.getByLabelText('Nuevo orden de Facultad de Ciencias'), '-1')
    fireEvent.submit(screen.getByRole('form', { name: 'Editar orden de Facultad de Ciencias' }))

    // Assert
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/entero entre 0 y 100000/i))
    expect(changeOrganizationUnitOrder).not.toHaveBeenCalled()
  })

  it('orders the hierarchy and uses normalized affiliations while distinguishing regular and intersemester periods', async () => {
    // Arrange
    const { AcademicOperationsPage } = await loadPage()
    const client = createClient({ getStructure: vi.fn().mockResolvedValue(structureWithOrderedPrograms) })
    render(<AcademicOperationsPage client={client} loadPrograms={async () => programs} />)

    // Act
    const title = await screen.findByRole('heading', { name: /estructura y periodos académicos/i })

    // Assert
    expect(title).toBeVisible()
    expect(screen.getByText('Facultad de Ciencias')).toBeVisible()
    expect(screen.getByText('Escuela de Sistemas')).toBeVisible()
    expect(screen.getByText('Ingeniería de Sistemas')).toBeVisible()
    expect(screen.getByText('ING-SIS')).toBeVisible()
    expect(screen.getByText('Sede Central Tunja')).toBeVisible()
    expect(screen.getAllByText('Sede Central Tunja · TUNJA')).toHaveLength(2)
    expect(screen.queryByText('LEGACY-DUITAMA')).not.toBeInTheDocument()
    expect(screen.queryByText('LEGACY-BOGOTA')).not.toBeInTheDocument()
    expect(screen.getByText('ING-SIS').closest('li')?.nextElementSibling).toHaveTextContent('AAA-PROG')
    expect(screen.getByText('Período regular')).toBeVisible()
    expect(screen.getByText('Intersemestral')).toBeVisible()
    expect(screen.getByText(/el semestre de una malla curricular es distinto del periodo académico/i)).toBeVisible()
    expect(screen.getByText(/requieren permiso institucional de escritura/i)).toBeVisible()
    expect(client.getStructure).toHaveBeenCalledOnce()
    expect(client.getOpenPeriods).toHaveBeenCalledOnce()
    expect(client.getAdminPeriods).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /abrir periodo|cerrar periodo/i })).not.toBeInTheDocument()
  })

  it('shows the audited calendar history on demand to period readers without granting write actions', async () => {
    // Arrange
    const user = userEvent.setup()
    const { AcademicOperationsPage } = await loadPage()
    const getPeriodHistory = vi.fn().mockResolvedValue({
      period: regularPeriod,
      calendarRevisions: [{
        id: 'c2d11854-487b-4d55-b825-0b321fb1f414',
        periodId: regularPeriod.id,
        version: 1,
        officialReference: 'Calendario institucional de prueba',
        status: 'PUBLISHED',
        activities: [{
          key: 'REGISTRATION',
          label: 'Inscripción',
          startsAt: '2026-06-22T08:00:00',
          endsAt: '2026-06-28T16:00:00',
          organizationUnitId: null,
          siteId: null,
        }],
      }],
      auditEvents: [{
        id: 1,
        actionKey: 'PERIOD_OPENED',
        actorSub: 'synthetic-period-operator',
        occurredAt: '2026-08-10T13:00:00Z',
        reference: 'Resolución institucional de prueba',
        summary: 'Academic period state changed to OPEN.',
      }],
    })
    const client = { ...createClient(), getPeriodHistory } as unknown as AcademicOperationsClient
    render(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      authorization={{ accessToken: 'synthetic-read-token', canRead: true, canWrite: false }}
    />)

    // Act
    await user.click(await screen.findByRole('button', { name: 'Ver historial de 2026-2' }))

    // Assert
    expect(await screen.findByText('Periodo abierto')).toBeVisible()
    expect(screen.getByText('Calendario institucional de prueba')).toBeVisible()
    expect(screen.getByText('Inscripción')).toBeVisible()
    expect(screen.getByText(/Actor: synthetic-period-operator/)).toBeVisible()
    expect(screen.queryByRole('button', { name: /abrir periodo|cerrar periodo/i })).not.toBeInTheDocument()
    expect(getPeriodHistory).toHaveBeenCalledWith(regularPeriod.id, 'synthetic-read-token', expect.any(AbortSignal))
  })

  it('creates a period draft in the administrative view and adds it to the current list', async () => {
    // Arrange
    const user = userEvent.setup()
    const { AcademicOperationsPage } = await loadPage()
    const draft: AcademicPeriod = {
      ...regularPeriod,
      code: '2027-1',
      academicYear: 2027,
      sequenceNumber: 1,
      startsOn: '2027-01-15',
      endsOn: '2027-06-20',
      status: 'DRAFT',
      calendarRevisionId: null,
      calendarRevisionNumber: null,
      approvalReference: null,
      officialReference: null,
    }
    const createPeriod = vi.fn().mockResolvedValue(draft)
    const client = createClient({ getAdminPeriods: vi.fn().mockResolvedValue([]), createPeriod })
    render(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      authorization={{ accessToken: 'synthetic-write-token', canRead: true, canWrite: true }}
    />)

    // Act
    const form = within(await screen.findByRole('region', { name: 'Crear periodo académico' }))
    await user.type(form.getByLabelText('Código del periodo'), '2027-1')
    await user.type(form.getByLabelText('Año académico'), '2027')
    await user.type(form.getByLabelText('Número del periodo'), '1')
    await user.type(form.getByLabelText('Inicio de instrucción'), '2027-01-15')
    await user.type(form.getByLabelText('Fin de instrucción'), '2027-06-20')
    await user.click(form.getByRole('button', { name: 'Crear borrador de periodo' }))

    // Assert
    expect(await screen.findByText('2027-1')).toBeVisible()
    expect(createPeriod).toHaveBeenCalledWith({
      code: '2027-1', kind: 'REGULAR', academicYear: 2027, sequenceNumber: 1,
      startsOn: '2027-01-15', endsOn: '2027-06-20',
    }, 'synthetic-write-token')
  })

  it('does not expose administrative period history to a write-only user', async () => {
    // Arrange
    const { AcademicOperationsPage } = await loadPage()
    const getPeriodHistory = vi.fn()
    const client = { ...createClient(), getPeriodHistory } as unknown as AcademicOperationsClient
    render(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      authorization={{ accessToken: 'synthetic-write-token', canRead: false, canWrite: true }}
    />)

    // Act
    await screen.findByRole('button', { name: 'Cerrar periodo 2026-2' })

    // Assert
    expect(screen.queryByRole('button', { name: /ver historial/i })).not.toBeInTheDocument()
    expect(getPeriodHistory).not.toHaveBeenCalled()
  })

  it('aborts a pending period history request when the reader closes its panel', async () => {
    // Arrange
    const user = userEvent.setup()
    const { AcademicOperationsPage } = await loadPage()
    let requestSignal: AbortSignal | undefined
    const getPeriodHistory = vi.fn().mockImplementation((_periodId: string, _token: string, signal: AbortSignal) => {
      requestSignal = signal
      return new Promise(() => {})
    })
    const client = { ...createClient(), getPeriodHistory } as unknown as AcademicOperationsClient
    render(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      authorization={{ accessToken: 'synthetic-read-token', canRead: true, canWrite: false }}
    />)

    // Act
    await user.click(await screen.findByRole('button', { name: 'Ver historial de 2026-2' }))
    await waitFor(() => expect(getPeriodHistory).toHaveBeenCalledOnce())
    await user.click(screen.getByRole('button', { name: 'Ocultar historial' }))

    // Assert
    expect(requestSignal?.aborted).toBe(true)
    expect(screen.queryByRole('region', { name: 'Historial de 2026-2' })).not.toBeInTheDocument()
  })

  it.each([401, 403])('revalidates the session when an administrative period history read returns %i', async (status) => {
    // Arrange
    const user = userEvent.setup()
    const { AcademicOperationsPage } = await loadPage()
    const accessToken = 'synthetic-expired-read-token'
    const onAuthorizationRejected = vi.fn().mockResolvedValue(undefined)
    const getPeriodHistory = vi.fn().mockRejectedValue(new AcademicOperationsApiError(status, 'Rejected'))
    const client = { ...createClient(), getPeriodHistory } as unknown as AcademicOperationsClient
    render(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      authorization={{ accessToken, canRead: true, canWrite: false }}
      onPeriodAuthorizationRejected={onAuthorizationRejected}
    />)

    // Act
    await user.click(await screen.findByRole('button', { name: 'Ver historial de 2026-2' }))

    // Assert
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/no fue posible consultar el historial/i))
    await waitFor(() => expect(onAuthorizationRejected).toHaveBeenCalledWith(accessToken))
  })

  it('requires an explicit confirmation and period write permission to open a period', async () => {
    // Arrange
    const user = userEvent.setup()
    const { AcademicOperationsPage } = await loadPage()
    const approved = { ...regularPeriod, status: 'APPROVED' as const }
    const openPeriod = vi.fn().mockResolvedValue({ ...approved, status: 'OPEN' as const })
    const client = createClient({
      getAdminPeriods: vi.fn().mockResolvedValue([approved]),
      openPeriod,
    })
    render(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      authorization={{ accessToken: 'synthetic-access-token', canRead: true, canWrite: true }}
    />)

    // Act
    await user.click(await screen.findByRole('button', { name: 'Abrir periodo 2026-2' }))

    // Assert: require explicit confirmation and explain the limited effect.
    expect(screen.getByText(/solo cambiará el estado del periodo; no publicará oferta ni abrirá matrículas/i)).toBeVisible()
    expect(openPeriod).not.toHaveBeenCalled()

    // Act
    await user.click(screen.getByRole('button', { name: 'Confirmar apertura' }))

    // Assert
    expect(openPeriod).toHaveBeenCalledWith(approved.id, 'synthetic-access-token')
    expect(await screen.findByText('Abierto')).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent(/el periodo 2026-2 quedó abierto/i)
  })

  it('refreshes the active calendar and requires a new confirmation after a stale close conflict', async () => {
    // Arrange
    const user = userEvent.setup()
    const { AcademicOperationsPage } = await loadPage()
    const amendedPeriod = {
      ...regularPeriod,
      calendarRevisionId: 'ac83a27f-3753-4a2d-8e1d-a8ee160555e7',
      calendarRevisionNumber: 2,
      officialReference: 'Resolución modificatoria de calendario',
    }
    const getAdminPeriods = vi.fn()
      .mockResolvedValueOnce([regularPeriod])
      .mockResolvedValueOnce([amendedPeriod])
    const closePeriod = vi.fn().mockRejectedValue(new AcademicOperationsApiError(409, 'Conflict'))
    const client = createClient({ getAdminPeriods, closePeriod })
    render(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      authorization={{ accessToken: 'synthetic-access-token', canRead: true, canWrite: true }}
    />)

    // Act
    await user.click(await screen.findByRole('button', { name: 'Cerrar periodo 2026-2' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar cierre' }))

    // Assert
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/otro cambio modificó el periodo/i))
    expect(getAdminPeriods).toHaveBeenCalledTimes(2)
    expect(screen.getByText(/Calendario rev\. 2/)).toBeVisible()
    expect(screen.queryByText(/Calendario rev\. 1/)).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Confirmar cierre de 2026-2' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar periodo 2026-2' })).toBeEnabled()
  })

  it.each([401, 403])('revalidates institutional authorization after a period transition returns %i', async (status) => {
    // Arrange
    const user = userEvent.setup()
    const { AcademicOperationsPage } = await loadPage()
    const accessToken = 'synthetic-access-token'
    const closePeriod = vi.fn().mockRejectedValue(new AcademicOperationsApiError(status, 'Denied'))
    const onAuthorizationRejected = vi.fn().mockResolvedValue(undefined)
    const client = createClient({ closePeriod })
    render(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      authorization={{ accessToken, canRead: true, canWrite: true }}
      onPeriodAuthorizationRejected={onAuthorizationRejected}
    />)

    // Act
    await user.click(await screen.findByRole('button', { name: 'Cerrar periodo 2026-2' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar cierre' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(status === 401
      ? /el servidor rechazó la sesión/i
      : /el servidor negó el permiso/i)
    expect(onAuthorizationRejected).toHaveBeenCalledWith(accessToken)
  })

  it('shows approved and open periods for readers but hides transitions without write permission', async () => {
    // Arrange
    const { AcademicOperationsPage } = await loadPage()
    const approved = {
      ...regularPeriod,
      id: '0326036b-58de-4897-bc5b-1e54d498ec4d',
      code: '2026-3',
      status: 'APPROVED' as const,
    }
    const client = createClient({ getAdminPeriods: vi.fn().mockResolvedValue([approved, regularPeriod]) })
    render(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      authorization={{ accessToken: 'synthetic-read-token', canRead: true, canWrite: false }}
    />)

    // Act + Assert
    expect(await screen.findByText('Aprobado')).toBeVisible()
    expect(screen.getByText('Abierto')).toBeVisible()
    expect(client.getAdminPeriods).toHaveBeenCalledWith('synthetic-read-token', expect.any(AbortSignal))
    expect(screen.queryByRole('button', { name: /abrir periodo|cerrar periodo/i })).not.toBeInTheDocument()
  })

  it('hides previously loaded administrative periods immediately when read permission is lost', async () => {
    // Arrange
    const { AcademicOperationsPage } = await loadPage()
    const approved = { ...regularPeriod, status: 'APPROVED' as const }
    const client = createClient({
      getAdminPeriods: vi.fn().mockResolvedValue([approved]),
      getOpenPeriods: vi.fn(() => new Promise<AcademicPeriod[]>(() => {})),
    })
    const { rerender } = render(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      authorization={{ accessToken: 'synthetic-read-token', canRead: true, canWrite: false }}
    />)
    expect(await screen.findByText('Aprobado')).toBeVisible()

    // Act: session expiry/logout removes authorization while the public reload is still pending.
    rerender(<AcademicOperationsPage client={client} loadPrograms={async () => programs} authorization={null} />)

    // Assert: stale administrative data is hidden in the same render, before the request resolves.
    expect(screen.queryByText('Aprobado')).not.toBeInTheDocument()
    expect(screen.queryByText('2026-2')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/consultando estructura/i)
  })

  it('hides the full administrative structure immediately when its read permission is lost', async () => {
    // Arrange
    const { AcademicOperationsPage } = await loadPage()
    const getStructure = vi.fn()
      .mockResolvedValueOnce(structure)
      .mockReturnValueOnce(new Promise<AcademicStructureSnapshot>(() => {}))
    const getAdminStructure = vi.fn().mockResolvedValue(structureWithOrderedPrograms)
    const client = createClient({ getStructure, getAdminStructure })
    const { rerender } = render(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      structureAuthorization={{ accessToken: 'synthetic-read-token', canRead: true, canWrite: false }}
    />)
    const affiliationTimeline = within(await screen.findByRole('list', { name: 'Vigencias de adscripción' }))
    expect(affiliationTimeline.getByText('Programa ordenado después')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Crear afiliación' })).not.toBeInTheDocument()

    // Act: the remaining public request has not resolved yet, so administrative data must expire immediately.
    rerender(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      structureAuthorization={{ accessToken: 'synthetic-write-token', canRead: false, canWrite: true }}
    />)

    // Assert
    expect(screen.queryByRole('button', { name: /cambiar orden de/i })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/consultando estructura/i)
    expect(getStructure).toHaveBeenCalled()
  })

  it('revalidates identity when the administrative structure read is rejected', async () => {
    // Arrange
    const { AcademicOperationsPage } = await loadPage()
    const accessToken = 'synthetic-rejected-read-token'
    const onAuthorizationRejected = vi.fn().mockResolvedValue(undefined)
    const getAdminStructure = vi.fn().mockRejectedValue(new AcademicOperationsApiError(403, 'Forbidden'))
    let resolvePublicStructure!: (snapshot: AcademicStructureSnapshot) => void
    const getStructure = vi.fn().mockReturnValue(new Promise<AcademicStructureSnapshot>((resolve) => {
      resolvePublicStructure = resolve
    }))
    const client = createClient({ getStructure, getAdminStructure })
    render(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      structureAuthorization={{ accessToken, canRead: true, canWrite: true }}
      onStructureAuthorizationRejected={onAuthorizationRejected}
    />)

    // Act: keep the public tree pending while authorization is revalidated.
    await waitFor(() => expect(onAuthorizationRejected).toHaveBeenCalledWith(accessToken))

    // Assert: no stale administration or misleading failure is shown during fallback.
    expect(screen.getByRole('status')).toHaveTextContent(/consultando estructura/i)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Vigencias de adscripción' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /crear afiliación/i })).not.toBeInTheDocument()

    // The public tree completes without restoring rejected administrative controls.
    resolvePublicStructure(structure)
    expect(await screen.findByText('Facultad de Ciencias')).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(client.getStructure).toHaveBeenCalled()
  })

  it('does not revalidate identity when a canceled administrative read later returns 403', async () => {
    // Arrange
    const { AcademicOperationsPage } = await loadPage()
    const onAuthorizationRejected = vi.fn().mockResolvedValue(undefined)
    let rejectAdminStructure!: (reason: unknown) => void
    let requestSignal: AbortSignal | undefined
    const getAdminStructure = vi.fn().mockImplementation((_accessToken: string, signal: AbortSignal) => {
      requestSignal = signal
      return new Promise<AcademicStructureSnapshot>((_resolve, reject) => {
        rejectAdminStructure = reject
      })
    })
    const client = createClient({ getAdminStructure })
    const { unmount } = render(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      structureAuthorization={{ accessToken: 'synthetic-obsolete-token', canRead: true, canWrite: true }}
      onStructureAuthorizationRejected={onAuthorizationRejected}
    />)
    await waitFor(() => expect(getAdminStructure).toHaveBeenCalledOnce())

    // Act: the view is canceled before the server's forbidden response arrives.
    unmount()
    expect(requestSignal?.aborted).toBe(true)
    await act(async () => {
      rejectAdminStructure(new AcademicOperationsApiError(403, 'Forbidden'))
      await Promise.resolve()
      await Promise.resolve()
    })

    // Assert
    expect(onAuthorizationRejected).not.toHaveBeenCalled()
  })

  it('cancels an administrative refresh started after a creation when the view unmounts', async () => {
    // Arrange
    const user = userEvent.setup()
    const { AcademicOperationsPage } = await loadPage()
    let rejectAdminStructure!: (reason: unknown) => void
    let refreshSignal: AbortSignal | undefined
    const getAdminStructure = vi.fn()
      .mockResolvedValueOnce(structure)
      .mockImplementationOnce((_accessToken: string, signal?: AbortSignal) => {
        refreshSignal = signal
        return new Promise<AcademicStructureSnapshot>((_resolve, reject) => {
          rejectAdminStructure = reject
        })
      })
    const onAuthorizationRejected = vi.fn().mockResolvedValue(undefined)
    const client = createClient({
      getAdminStructure,
      createOrganizationUnit: vi.fn().mockResolvedValue('34a06170-9acf-4718-854e-92e945a7db17'),
    })
    const { unmount } = render(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      structureAuthorization={{ accessToken: 'synthetic-refresh-token', canRead: true, canWrite: true }}
      onStructureAuthorizationRejected={onAuthorizationRejected}
    />)
    const facultyForm = within(await screen.findByRole('region', { name: 'Registrar facultad raíz' }))
    await user.type(facultyForm.getByLabelText('Código institucional'), 'fac-prueba')
    await user.type(facultyForm.getByLabelText('Nombre de la facultad'), 'Facultad de prueba')
    await user.type(facultyForm.getByLabelText('Referencia institucional'), 'Acta institucional de prueba')

    // Act: create succeeds and starts a follow-up admin read; then leave the view.
    await user.click(screen.getByRole('button', { name: 'Crear facultad' }))
    await waitFor(() => expect(getAdminStructure).toHaveBeenCalledTimes(2))
    unmount()
    expect(refreshSignal?.aborted).toBe(true)
    await act(async () => {
      rejectAdminStructure(new AcademicOperationsApiError(403, 'Forbidden'))
      await Promise.resolve()
      await Promise.resolve()
    })

    // Assert
    expect(onAuthorizationRejected).not.toHaveBeenCalled()
  })

  it('allows a write-only operator to close a public open period but not open a hidden approved period', async () => {
    // Arrange
    const user = userEvent.setup()
    const { AcademicOperationsPage } = await loadPage()
    const closePeriod = vi.fn().mockResolvedValue({ ...regularPeriod, status: 'CLOSED' as const })
    const client = createClient({ closePeriod })
    render(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      authorization={{ accessToken: 'synthetic-write-token', canRead: false, canWrite: true }}
    />)

    // Act
    await user.click(await screen.findByRole('button', { name: 'Cerrar periodo 2026-2' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar cierre' }))

    // Assert
    expect(client.getOpenPeriods).toHaveBeenCalledOnce()
    expect(client.getAdminPeriods).not.toHaveBeenCalled()
    expect(closePeriod).toHaveBeenCalledWith(regularPeriod.id, 'synthetic-write-token')
    expect(screen.queryByText('2026-2')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /abrir periodo/i })).not.toBeInTheDocument()
  })

  it('shows explicit empty states instead of sample programs or periods', async () => {
    // Arrange
    const { AcademicOperationsPage } = await loadPage()
    const client = createClient({
      getStructure: vi.fn().mockResolvedValue({
        units: [], organizationRelations: [], sites: [], siteRelations: [], programAffiliations: [],
      }),
      getOpenPeriods: vi.fn().mockResolvedValue([]),
    })
    render(<AcademicOperationsPage client={client} loadPrograms={async () => []} />)

    // Act + Assert
    expect(await screen.findByText(/no hay unidades cargadas/i)).toBeVisible()
    expect(screen.getByText(/no hay periodos académicos abiertos/i)).toBeVisible()
    expect(screen.queryByText(/Ingeniería de Sistemas/)).not.toBeInTheDocument()
  })

  it('shows root-faculty creation only to an authorized structure writer', async () => {
    // Arrange
    const { AcademicOperationsPage } = await loadPage()
    const client = createClient()
    const { rerender } = render(
      <AcademicOperationsPage client={client} loadPrograms={async () => programs} />,
    )
    expect(await screen.findByText('Facultad de Ciencias')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Crear facultad' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Crear lugar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Crear afiliación' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Vincular unidades' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Vincular lugares' })).not.toBeInTheDocument()

    // Act
    rerender(
      <AcademicOperationsPage
        client={client}
        loadPrograms={async () => programs}
        structureAuthorization={{ accessToken: 'synthetic-structure-token', canRead: false, canWrite: true }}
      />,
    )

    // Assert: write permission alone cannot expose a view that cannot refresh the authoritative timeline.
    expect(screen.queryByRole('button', { name: 'Crear facultad' })).not.toBeInTheDocument()

    rerender(
      <AcademicOperationsPage
        client={client}
        loadPrograms={async () => programs}
        structureAuthorization={{ accessToken: 'synthetic-structure-token', canRead: true, canWrite: true }}
      />,
    )

    // Assert
    expect(await screen.findByRole('button', { name: 'Crear facultad' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Crear lugar' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Crear afiliación' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Vincular unidades' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Vincular lugares' })).toBeDisabled()
  })

  it('creates a root site only for an authorized structure writer and reloads the server structure', async () => {
    // Arrange
    const user = userEvent.setup()
    const { AcademicOperationsPage } = await loadPage()
    const siteId = '94a06170-9acf-4718-854e-92e945a7db17'
    const createdSite = {
      id: siteId,
      code: 'LUGAR-REGIONAL-PRUEBA',
      type: 'REGIONAL' as const,
      displayName: 'Lugar regional de prueba',
      displayOrder: 2,
      status: 'ACTIVE' as const,
      validFrom: '2026-09-30',
      validThrough: null,
    }
    const updatedStructure: AcademicStructureSnapshot = {
      ...structure,
      sites: [...structure.sites, createdSite],
    }
    const getStructure = vi.fn()
      .mockResolvedValueOnce(structure)
      .mockResolvedValueOnce(updatedStructure)
    const getAdminStructure = vi.fn()
      .mockResolvedValueOnce(structure)
      .mockResolvedValueOnce(updatedStructure)
    const createSite = vi.fn().mockResolvedValue(siteId)
    const client = createClient({ getStructure, getAdminStructure, createSite })
    render(
      <AcademicOperationsPage
        client={client}
        loadPrograms={async () => programs}
        structureAuthorization={{ accessToken: 'synthetic-structure-token', canRead: true, canWrite: true }}
      />,
    )
    await screen.findByText('Sede Central Tunja')
    const siteForm = within(screen.getByRole('region', { name: 'Registrar lugar académico' }))
    await user.type(siteForm.getByLabelText('Código del lugar'), 'lugar-regional-prueba')
    await user.selectOptions(siteForm.getByLabelText('Tipo de lugar'), 'REGIONAL')
    await user.type(siteForm.getByLabelText('Nombre del lugar'), 'Lugar regional de prueba')
    await user.clear(siteForm.getByLabelText('Prioridad del lugar'))
    await user.type(siteForm.getByLabelText('Prioridad del lugar'), '2')
    await user.type(siteForm.getByLabelText('Referencia institucional'), 'Acto institucional de prueba')

    // Act
    await user.click(screen.getByRole('button', { name: 'Crear lugar' }))

    // Assert
    expect(createSite).toHaveBeenCalledWith({
      code: 'lugar-regional-prueba',
      type: 'REGIONAL',
      displayName: 'Lugar regional de prueba',
      displayOrder: 2,
      validFrom: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      validThrough: null,
      sourceReference: 'Acto institucional de prueba',
    }, 'synthetic-structure-token')
    expect(await screen.findByText('Lugar regional de prueba')).toBeVisible()
    expect(getAdminStructure).toHaveBeenCalledTimes(2)
  })

  it('creates a dated site hierarchy relation and refreshes the authoritative tree', async () => {
    // Arrange
    const user = userEvent.setup()
    const { AcademicOperationsPage } = await loadPage()
    const secondSite = {
      ...structure.sites[0]!,
      id: '34a06170-9acf-4718-854e-92e945a7db17',
      code: 'SITE-CAMPUS-PRUEBA',
      type: 'CAMPUS' as const,
      displayName: 'Campus de prueba',
      displayOrder: 2,
    }
    const initialStructure: AcademicStructureSnapshot = {
      ...structure,
      sites: [...structure.sites, secondSite],
      siteRelations: [],
    }
    const relatedStructure: AcademicStructureSnapshot = {
      ...initialStructure,
      siteRelations: [{
        parentSiteId: structure.sites[0]!.id,
        childSiteId: secondSite.id,
        displayOrder: 2,
        validFrom: '2026-09-30',
        validThrough: null,
      }],
    }
    const getStructure = vi.fn()
      .mockResolvedValueOnce(initialStructure)
      .mockResolvedValueOnce(relatedStructure)
    const getAdminStructure = vi.fn()
      .mockResolvedValueOnce(initialStructure)
      .mockResolvedValueOnce(relatedStructure)
    const relateSites = vi.fn().mockResolvedValue(undefined)
    const client = createClient({ getStructure, getAdminStructure, relateSites })
    render(
      <AcademicOperationsPage
        client={client}
        loadPrograms={async () => programs}
        structureAuthorization={{ accessToken: 'synthetic-structure-token', canRead: true, canWrite: true }}
      />,
    )
    await screen.findByText('Campus de prueba')
    const relationForm = within(screen.getByRole('region', { name: 'Definir jerarquía de lugares' }))
    await user.selectOptions(relationForm.getByLabelText('Lugar superior'), structure.sites[0]!.id)
    await user.selectOptions(relationForm.getByLabelText('Lugar subordinado'), secondSite.id)
    await user.clear(relationForm.getByLabelText('Orden dentro del lugar superior'))
    await user.type(relationForm.getByLabelText('Orden dentro del lugar superior'), '2')
    await user.type(relationForm.getByLabelText('Referencia institucional'), 'Resolución de ubicación de prueba')

    // Act
    await user.click(relationForm.getByRole('button', { name: 'Vincular lugares' }))

    // Assert
    expect(relateSites).toHaveBeenCalledWith(
      structure.sites[0]!.id,
      secondSite.id,
      {
        displayOrder: 2,
        validFrom: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        validThrough: null,
        sourceReference: 'Resolución de ubicación de prueba',
      },
      'synthetic-structure-token',
    )
    expect(await relationForm.findByRole('status')).toHaveTextContent(/relación de lugares registrada/i)
    expect(getAdminStructure).toHaveBeenCalledTimes(2)
  })

  it('creates a faculty through the protected client and reloads the authoritative structure', async () => {
    // Arrange
    const user = userEvent.setup()
    const { AcademicOperationsPage } = await loadPage()
    const facultyId = '34a06170-9acf-4718-854e-92e945a7db17'
    const createdFaculty = {
      id: facultyId,
      code: 'FAC-APLICADAS',
      type: 'FACULTY' as const,
      displayName: 'Facultad de Ciencias Aplicadas',
      displayOrder: 3,
      status: 'ACTIVE' as const,
      validFrom: '2026-09-30',
      validThrough: null,
    }
    const updatedStructure: AcademicStructureSnapshot = {
      ...structure,
      units: [...structure.units, createdFaculty],
    }
    const getStructure = vi.fn()
      .mockResolvedValueOnce(structure)
      .mockResolvedValueOnce(updatedStructure)
    const getAdminStructure = vi.fn()
      .mockResolvedValueOnce(structure)
      .mockResolvedValueOnce(updatedStructure)
    const createOrganizationUnit = vi.fn().mockResolvedValue(facultyId)
    const client = createClient({ getStructure, getAdminStructure, createOrganizationUnit })
    render(
      <AcademicOperationsPage
        client={client}
        loadPrograms={async () => programs}
        structureAuthorization={{ accessToken: 'synthetic-structure-token', canRead: true, canWrite: true }}
      />,
    )
    await screen.findByText('Facultad de Ciencias')
    const facultyForm = within(screen.getByRole('region', { name: 'Registrar facultad raíz' }))
    await user.type(facultyForm.getByLabelText('Código institucional'), 'fac-aplicadas')
    await user.type(facultyForm.getByLabelText('Nombre de la facultad'), 'Facultad de Ciencias Aplicadas')
    await user.clear(facultyForm.getByLabelText('Prioridad de visualización'))
    await user.type(facultyForm.getByLabelText('Prioridad de visualización'), '3')
    await user.clear(facultyForm.getByLabelText('Vigente desde'))
    await user.type(facultyForm.getByLabelText('Vigente desde'), '2026-09-30')
    await user.type(facultyForm.getByLabelText('Referencia institucional'), 'Acuerdo institucional de prueba')

    // Act
    await user.click(screen.getByRole('button', { name: 'Crear facultad' }))

    // Assert
    expect(createOrganizationUnit).toHaveBeenCalledWith({
      code: 'fac-aplicadas',
      type: 'FACULTY',
      displayName: 'Facultad de Ciencias Aplicadas',
      displayOrder: 3,
      validFrom: '2026-09-30',
      validThrough: null,
      sourceReference: 'Acuerdo institucional de prueba',
    }, 'synthetic-structure-token')
    expect(await screen.findByText('Facultad de Ciencias Aplicadas')).toBeVisible()
    expect(getAdminStructure).toHaveBeenCalledTimes(2)
  })

  it('creates a program affiliation through the protected client and reloads its academic hierarchy', async () => {
    // Arrange
    const user = userEvent.setup()
    const { AcademicOperationsPage } = await loadPage()
    const updatedStructure: AcademicStructureSnapshot = {
      ...structure,
      programAffiliations: [
        ...structure.programAffiliations,
        {
          id: '8a751e5d-65ad-4a33-b48c-d95ae7b07915',
          programId: programs[1]!.id,
          organizationUnitId: structure.units[0]!.id,
          siteId: structure.sites[0]!.id,
          displayOrder: 3,
          validFrom: '2027-01-01',
          validThrough: null,
          sourceReference: 'Resolución institucional de prueba',
        },
      ],
    }
    const getAdminStructure = vi.fn()
      .mockResolvedValueOnce(structure)
      .mockResolvedValueOnce(updatedStructure)
    const affiliateProgram = vi.fn().mockResolvedValue(undefined)
    const client = createClient({ getAdminStructure, affiliateProgram })
    render(
      <AcademicOperationsPage
        client={client}
        loadPrograms={async () => programs}
        structureAuthorization={{ accessToken: 'synthetic-structure-token', canRead: true, canWrite: true }}
      />,
    )
    const affiliationForm = within(await screen.findByRole('region', { name: 'Adscribir programa publicado' }))
    await user.selectOptions(affiliationForm.getByLabelText('Programa publicado'), programs[1]!.id)
    await user.selectOptions(affiliationForm.getByLabelText('Unidad responsable'), structure.units[0]!.id)
    await user.selectOptions(affiliationForm.getByLabelText('Lugar de desarrollo'), structure.sites[0]!.id)
    await user.clear(affiliationForm.getByLabelText('Orden del programa en la unidad'))
    await user.type(affiliationForm.getByLabelText('Orden del programa en la unidad'), '3')
    await user.clear(affiliationForm.getByLabelText('Vigente desde'))
    await user.type(affiliationForm.getByLabelText('Vigente desde'), '2027-01-01')
    await user.type(affiliationForm.getByLabelText('Referencia institucional'), 'Resolución institucional de prueba')

    // Act
    await user.click(affiliationForm.getByRole('button', { name: 'Crear afiliación' }))

    // Assert
    expect(affiliateProgram).toHaveBeenCalledWith(programs[1]!.id, {
      organizationUnitId: structure.units[0]!.id,
      siteId: structure.sites[0]!.id,
      displayOrder: 3,
      validFrom: '2027-01-01',
      validThrough: null,
      sourceReference: 'Resolución institucional de prueba',
    }, 'synthetic-structure-token')
    const affiliationTimeline = within(await screen.findByRole('list', { name: 'Vigencias de adscripción' }))
    expect(affiliationTimeline.getByText('Programa ordenado después')).toBeVisible()
    expect(affiliationTimeline.getByText(/2027-01-01/)).toBeVisible()
    expect(affiliationTimeline.getByText(/Fuera de vigencia en la consulta pública/)).toBeVisible()
    expect(within(screen.getByRole('list', { name: 'Jerarquía académica' }))
      .queryByText('Programa ordenado después')).not.toBeInTheDocument()
    expect(getAdminStructure).toHaveBeenCalledTimes(2)
  })

  it('refreshes the administrative affiliation timeline after a concurrent future affiliation conflict', async () => {
    // Arrange
    const user = userEvent.setup()
    const { AcademicOperationsPage } = await loadPage()
    const concurrentAffiliation = {
      ...structure.programAffiliations[0]!,
      id: 'c4011f06-4a61-42f2-8e28-24b71ff8ee12',
      programId: programs[1]!.id,
      validFrom: '2027-02-01',
      sourceReference: 'Resolución concurrente',
    }
    const concurrentStructure = {
      ...structure,
      programAffiliations: [...structure.programAffiliations, concurrentAffiliation],
    }
    const getAdminStructure = vi.fn()
      .mockResolvedValueOnce(structure)
      .mockResolvedValueOnce(concurrentStructure)
    const affiliateProgram = vi.fn().mockRejectedValue(new AcademicOperationsApiError(409, 'Conflict'))
    const client = createClient({ getAdminStructure, affiliateProgram })
    render(<AcademicOperationsPage
      client={client}
      loadPrograms={async () => programs}
      structureAuthorization={{ accessToken: 'synthetic-structure-token', canRead: true, canWrite: true }}
    />)
    const form = within(await screen.findByRole('region', { name: 'Adscribir programa publicado' }))
    await user.selectOptions(form.getByLabelText('Programa publicado'), programs[1]!.id)
    await user.selectOptions(form.getByLabelText('Unidad responsable'), structure.units[0]!.id)
    await user.selectOptions(form.getByLabelText('Lugar de desarrollo'), structure.sites[0]!.id)
    await user.type(form.getByLabelText('Referencia institucional'), 'Referencia de conflicto')

    // Act
    await user.click(form.getByRole('button', { name: 'Crear afiliación' }))

    // Assert
    expect(await form.findByRole('alert')).toHaveTextContent(/conflicto.*actualicé la estructura/i)
    const timeline = within(await screen.findByRole('list', { name: 'Vigencias de adscripción' }))
    expect(timeline.getByText('Programa ordenado después')).toBeVisible()
    expect(timeline.getByText(/2027-02-01/)).toBeVisible()
    expect(affiliateProgram).toHaveBeenCalledOnce()
    expect(getAdminStructure).toHaveBeenCalledTimes(2)
  })

  it('lets the user retry a failed public request', async () => {
    // Arrange
    const user = userEvent.setup()
    const { AcademicOperationsPage } = await loadPage()
    const getStructure = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(structure)
    const client = createClient({ getStructure })
    render(<AcademicOperationsPage client={client} loadPrograms={async () => programs} />)

    // Act
    await user.click(await screen.findByRole('button', { name: /intentar de nuevo/i }))

    // Assert
    expect(await screen.findByText('Ingeniería de Sistemas')).toBeVisible()
    expect(getStructure).toHaveBeenCalledTimes(2)
  })
})
