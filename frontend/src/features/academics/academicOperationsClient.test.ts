import { describe, expect, it, vi } from 'vitest'
import type {
  AcademicOperationsClient,
  AcademicOrganizationUnitCreateCommand,
  AcademicProgramAffiliationReassignmentCommand,
  AcademicStructureRelationCloseCommand,
  AcademicSiteCreateCommand,
  AcademicStructureRelationCreateCommand,
} from './academicOperationsContracts'

const clientModules = import.meta.glob<typeof import('./academicOperationsClient')>('./academicOperationsClient.ts')

async function loadClient() {
  const loader = clientModules['./academicOperationsClient.ts']
  expect(loader, 'the typed academic operations client is implemented').toBeTypeOf('function')
  return loader!()
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const structure = {
  units: [{
    id: 'fae06170-9acf-4718-854e-92e945a7db17',
    code: 'FAC-CIENCIAS',
    type: 'FACULTY',
    displayName: 'Facultad de Ciencias',
    displayOrder: 1,
    status: 'ACTIVE',
    validFrom: '2026-01-01',
    validThrough: null,
  }, {
    id: '127d89c9-a72a-436a-9a90-26da60bc9570',
    code: 'ESC-SISTEMAS',
    type: 'SCHOOL',
    displayName: 'Escuela de Sistemas',
    displayOrder: 1,
    status: 'ACTIVE',
    validFrom: '2026-01-01',
    validThrough: null,
  }],
  organizationRelations: [{
    parentUnitId: 'fae06170-9acf-4718-854e-92e945a7db17',
    childUnitId: '127d89c9-a72a-436a-9a90-26da60bc9570',
    displayOrder: 3,
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
    organizationUnitId: 'fae06170-9acf-4718-854e-92e945a7db17',
    siteId: 'b16116a1-10ba-4d79-839b-4195e4851d73',
    displayOrder: 3,
    validFrom: '2026-01-01',
    validThrough: null,
    sourceReference: 'Acuerdo institucional validado',
  }],
}

const period = {
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
  approvalReference: 'Acuerdo de calendario institucional',
  officialReference: 'Calendario institucional 2026-2',
  createdAt: '2026-06-15T10:00:00Z',
}

describe('academic operations client', () => {
  it('queries the authorized academic structure audit page with filters and an abort signal', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const entityId = 'fae06170-9acf-4718-854e-92e945a7db17'
    const auditEvent = {
      entityId,
      actionKey: 'PROGRAM_AFFILIATED',
      actor: 'opaque-actor-7c58',
      occurredAt: '2026-09-30T15:30:00Z',
      reference: 'Acta de prueba',
      summary: 'Programa afiliado',
    }
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ events: [auditEvent], nextCursor: 'next-token' }))
    const client = createAcademicOperationsClient(fetcher)
    const auditClient = client as unknown as {
      getStructureAuditEvents?: (query: Record<string, unknown>, token: string, signal?: AbortSignal) => Promise<unknown>
    }
    const signal = new AbortController().signal

    // Act
    expect(auditClient.getStructureAuditEvents).toBeTypeOf('function')
    const page = await auditClient.getStructureAuditEvents!({
      limit: 25,
      before: 'opaque-cursor',
      entityId,
      actionKey: 'PROGRAM_AFFILIATED',
    }, 'synthetic-access-token', signal)

    // Assert
    expect(page).toEqual({ events: [auditEvent], nextCursor: 'next-token' })
    expect(fetcher).toHaveBeenCalledWith(
      '/api/v1/admin/academic-structure/audit-events?limit=25&entityId=' + entityId
        + '&actionKey=PROGRAM_AFFILIATED&before=opaque-cursor',
      {
        credentials: 'omit',
        headers: { Accept: 'application/json', Authorization: 'Bearer synthetic-access-token' },
        signal,
      },
    )
  })

  it('rejects invalid audit filters locally and rejects malformed audit pages', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const fetcher = vi.fn()
    const client = createAcademicOperationsClient(fetcher)
    const auditClient = client as unknown as {
      getStructureAuditEvents?: (query: Record<string, unknown>, token: string) => Promise<unknown>
    }

    // Act + Assert
    expect(auditClient.getStructureAuditEvents).toBeTypeOf('function')
    await expect(auditClient.getStructureAuditEvents!({ limit: 101 }, 'synthetic-access-token'))
      .rejects.toThrow(/audit|page|limit/i)
    await expect(auditClient.getStructureAuditEvents!({ entityId: 'not-a-uuid' }, 'synthetic-access-token'))
      .rejects.toThrow(/audit|entity|malformed/i)
    expect(fetcher).not.toHaveBeenCalled()

    fetcher.mockResolvedValue(jsonResponse({ events: [{ actionKey: 'UNKNOWN' }], nextCursor: null }))
    await expect(auditClient.getStructureAuditEvents!({}, 'synthetic-access-token')).rejects.toThrow(/malformed/i)
  })

  it('creates an authorized development site with normalized values and returns its identifier', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const siteId = '34a06170-9acf-4718-854e-92e945a7db17'
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ id: siteId }, 201))
    const client = createAcademicOperationsClient(fetcher)
    const command: AcademicSiteCreateCommand = {
      code: ' aguazul ',
      type: 'REGIONAL',
      displayName: ' Sede Regional de Aguazul ',
      displayOrder: 2,
      validFrom: '2026-09-30',
      validThrough: null,
      sourceReference: ' Resolución institucional 2026 ',
    }
    const signal = new AbortController().signal

    // Act
    const createdSiteId = await client.createSite(command, 'institutional-access-token', signal)

    // Assert
    expect(createdSiteId).toBe(siteId)
    expect(fetcher).toHaveBeenCalledWith('/api/v1/admin/academic-structure/sites', {
      credentials: 'omit',
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer institutional-access-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: 'AGUAZUL',
        type: 'REGIONAL',
        displayName: 'Sede Regional de Aguazul',
        displayOrder: 2,
        validFrom: '2026-09-30',
        validThrough: null,
        sourceReference: 'Resolución institucional 2026',
      }),
      signal,
    })
  })

  it('rejects an invalid site command before sending it to the server', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const fetcher = vi.fn()
    const client = createAcademicOperationsClient(fetcher)
    // Act
    const request = client.createSite({
      code: 'AGUA ZUL',
      type: 'REGIONAL',
      displayName: 'Sede Regional de Aguazul',
      displayOrder: -1,
      validFrom: '2026-09-30',
      validThrough: '2026-09-29',
      sourceReference: '',
    }, 'institutional-access-token')

    // Assert
    await expect(request).rejects.toThrow(/invalid|valid/i)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('preserves a server conflict when a site code already exists', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ code: 'academic_structure_conflict', message: 'Conflicto de estructura' }, 409))
    const client = createAcademicOperationsClient(fetcher)
    const command: AcademicSiteCreateCommand = {
      code: 'AGUAZUL',
      type: 'REGIONAL',
      displayName: 'Sede Regional de Aguazul',
      displayOrder: 2,
      validFrom: '2026-09-30',
      validThrough: null,
      sourceReference: 'Resolución institucional',
    }

    // Act
    const request = client.createSite(command, 'institutional-access-token')

    // Assert
    await expect(request).rejects.toMatchObject({ status: 409, message: 'Conflicto de estructura' })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['relateOrganizationUnits', 'fae06170-9acf-4718-854e-92e945a7db17', '127d89c9-a72a-436a-9a90-26da60bc9570',
      '/api/v1/admin/academic-structure/units/fae06170-9acf-4718-854e-92e945a7db17/children/127d89c9-a72a-436a-9a90-26da60bc9570'],
    ['relateSites', 'b16116a1-10ba-4d79-839b-4195e4851d73', '34a06170-9acf-4718-854e-92e945a7db17',
      '/api/v1/admin/academic-structure/sites/b16116a1-10ba-4d79-839b-4195e4851d73/children/34a06170-9acf-4718-854e-92e945a7db17'],
  ] as const)('creates an audited %s relation and accepts the server 201 response', async (method, parentId, childId, path) => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 201 }))
    const client = createAcademicOperationsClient(fetcher)
    const command: AcademicStructureRelationCreateCommand = {
      displayOrder: 2,
      validFrom: '2026-09-30',
      validThrough: null,
      sourceReference: ' Referencia institucional ',
    }

    // Act
    if (method === 'relateOrganizationUnits') {
      await client.relateOrganizationUnits(parentId, childId, command, 'institutional-access-token')
    } else {
      await client.relateSites(parentId, childId, command, 'institutional-access-token')
    }

    // Assert
    expect(fetcher).toHaveBeenCalledWith(path, {
      credentials: 'omit',
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer institutional-access-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        displayOrder: 2,
        validFrom: '2026-09-30',
        validThrough: null,
        sourceReference: 'Referencia institucional',
      }),
    })
  })

  it('rejects self-relations before making a request', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const fetcher = vi.fn()
    const client = createAcademicOperationsClient(fetcher)

    // Act
    const request = client.relateOrganizationUnits(structure.units[0]!.id, structure.units[0]!.id, {
      displayOrder: 1,
      validFrom: '2026-09-30',
      validThrough: null,
      sourceReference: 'Referencia institucional',
    }, 'institutional-access-token')

    // Assert
    await expect(request).rejects.toThrow(/invalid/i)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('rejects equivalent UUIDs when letter casing differs', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const fetcher = vi.fn()
    const client = createAcademicOperationsClient(fetcher)
    const upperCaseId = 'FAE06170-9ACF-4718-854E-92E945A7DB17'
    const lowerCaseId = upperCaseId.toLowerCase()

    // Act
    const request = client.relateOrganizationUnits(upperCaseId, lowerCaseId, {
      displayOrder: 1,
      validFrom: '2026-09-30',
      validThrough: null,
      sourceReference: 'Referencia institucional',
    }, 'institutional-access-token')

    // Assert
    await expect(request).rejects.toThrow(/identifiers are invalid/i)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('preserves a conflict when a relation would create an invalid hierarchy', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ code: 'academic_structure_conflict', message: 'Conflicto de estructura' }, 409))
    const client = createAcademicOperationsClient(fetcher)

    // Act
    const request = client.relateSites(structure.sites[0]!.id, '34a06170-9acf-4718-854e-92e945a7db17', {
      displayOrder: 1,
      validFrom: '2026-09-30',
      validThrough: null,
      sourceReference: 'Referencia institucional',
    }, 'institutional-access-token')

    // Assert
    await expect(request).rejects.toMatchObject({ status: 409, message: 'Conflicto de estructura' })
  })

  it('creates an audited program affiliation using explicit identities and validity', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const programId = 'FAE06170-9ACF-4718-854E-92E945A7DB17'
    const unitId = '127d89c9-a72a-436a-9a90-26da60bc9570'
    const siteId = '34a06170-9acf-4718-854e-92e945a7db17'
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ id: programId.toLowerCase() }, 201))
    const client = createAcademicOperationsClient(fetcher)
    const affiliateProgram = Reflect.get(client, 'affiliateProgram') as AcademicOperationsClient['affiliateProgram'] | undefined
    expect(affiliateProgram).toBeTypeOf('function')
    if (!affiliateProgram) return

    // Act
    await affiliateProgram.call(client, programId, {
      organizationUnitId: unitId,
      siteId,
      displayOrder: 4,
      validFrom: '2026-10-01',
      validThrough: null,
      sourceReference: ' Resolución institucional 2026 ',
    }, 'institutional-access-token')

    // Assert
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledWith(
      `/api/v1/admin/academic-structure/programs/${programId.toLowerCase()}/affiliations`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer institutional-access-token' }),
        body: JSON.stringify({
          organizationUnitId: unitId,
          siteId,
          displayOrder: 4,
          validFrom: '2026-10-01',
          validThrough: null,
          sourceReference: 'Resolución institucional 2026',
        }),
      }),
    )
  })

  it('rejects an invalid program affiliation before sending a request', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const fetcher = vi.fn()
    const client = createAcademicOperationsClient(fetcher)
    const affiliateProgram = Reflect.get(client, 'affiliateProgram') as AcademicOperationsClient['affiliateProgram'] | undefined
    expect(affiliateProgram).toBeTypeOf('function')
    if (!affiliateProgram) return

    // Act
    const request = affiliateProgram.call(client, 'invalid-program-id', {
      organizationUnitId: 'invalid-unit-id',
      siteId: 'invalid-site-id',
      displayOrder: -1,
      validFrom: '2026-10-01',
      validThrough: '2026-09-30',
      sourceReference: 'Referencia institucional',
    }, 'institutional-access-token')

    // Assert
    await expect(request).rejects.toThrow(/invalid|valid/i)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('rejects program affiliation order above the database limit before sending a request', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const fetcher = vi.fn()
    const client = createAcademicOperationsClient(fetcher)

    // Act
    const request = client.affiliateProgram('fae06170-9acf-4718-854e-92e945a7db17', {
      organizationUnitId: '127d89c9-a72a-436a-9a90-26da60bc9570',
      siteId: '34a06170-9acf-4718-854e-92e945a7db17',
      displayOrder: 100_001,
      validFrom: '2026-10-01',
      validThrough: null,
      sourceReference: 'Referencia institucional',
    }, 'institutional-access-token')

    // Assert
    await expect(request).rejects.toThrow(/display order/i)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('preserves program affiliation conflicts from the server', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const programId = 'fae06170-9acf-4718-854e-92e945a7db17'
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ code: 'academic_structure_conflict', message: 'Conflicto de estructura' }, 409))
    const client = createAcademicOperationsClient(fetcher)
    const affiliateProgram = Reflect.get(client, 'affiliateProgram') as AcademicOperationsClient['affiliateProgram'] | undefined
    expect(affiliateProgram).toBeTypeOf('function')
    if (!affiliateProgram) return

    // Act
    const request = affiliateProgram.call(client, programId, {
      organizationUnitId: '127d89c9-a72a-436a-9a90-26da60bc9570',
      siteId: '34a06170-9acf-4718-854e-92e945a7db17',
      displayOrder: 0,
      validFrom: '2026-10-01',
      validThrough: null,
      sourceReference: 'Referencia institucional',
    }, 'institutional-access-token')

    // Assert
    await expect(request).rejects.toMatchObject({ status: 409, message: 'Conflicto de estructura' })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('rejects a created program affiliation response for a different program', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const programId = 'fae06170-9acf-4718-854e-92e945a7db17'
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ id: '8a751e5d-65ad-4a33-b48c-d95ae7b07915' }, 201))
    const client = createAcademicOperationsClient(fetcher)

    // Act
    const request = client.affiliateProgram(programId, {
      organizationUnitId: '127d89c9-a72a-436a-9a90-26da60bc9570',
      siteId: '34a06170-9acf-4718-854e-92e945a7db17',
      displayOrder: 0,
      validFrom: '2026-10-01',
      validThrough: null,
      sourceReference: 'Referencia institucional',
    }, 'institutional-access-token')

    // Assert
    await expect(request).rejects.toThrow(/invalid|malformed/i)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('creates an authorized faculty with normalized values and returns its identifier', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const unitId = '34a06170-9acf-4718-854e-92e945a7db17'
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ id: unitId }, 201))
    const client = createAcademicOperationsClient(fetcher)
    const command: AcademicOrganizationUnitCreateCommand = {
      code: ' fac-ciencias ',
      type: 'FACULTY',
      displayName: ' Facultad de Ciencias ',
      displayOrder: 0,
      validFrom: '2026-09-30',
      validThrough: null,
      sourceReference: ' Acuerdo institucional 2026 ',
    }
    const createUnit = Reflect.get(client, 'createOrganizationUnit') as
      AcademicOperationsClient['createOrganizationUnit'] | undefined
    expect(createUnit).toBeTypeOf('function')
    if (!createUnit) return
    const signal = new AbortController().signal

    // Act
    const createdUnitId = await createUnit.call(client, command, 'institutional-access-token', signal)

    // Assert
    expect(createdUnitId).toBe(unitId)
    expect(fetcher).toHaveBeenCalledWith('/api/v1/admin/academic-structure/units', {
      credentials: 'omit',
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer institutional-access-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: 'FAC-CIENCIAS',
        type: 'FACULTY',
        displayName: 'Facultad de Ciencias',
        displayOrder: 0,
        validFrom: '2026-09-30',
        validThrough: null,
        sourceReference: 'Acuerdo institucional 2026',
      }),
      signal,
    })
  })

  it('creates an authorized child unit through the atomic parent-child endpoint', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const parentId = 'A4A06170-9ACF-4718-854E-92E945A7DB17'
    const childId = '94a06170-9acf-4718-854e-92e945a7db17'
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ id: childId }, 201))
    const client = createAcademicOperationsClient(fetcher)
    const command: AcademicOrganizationUnitCreateCommand = {
      code: ' school-ciencias ',
      type: 'SCHOOL',
      displayName: ' Escuela de Ciencias ',
      displayOrder: 3,
      validFrom: '2026-10-01',
      validThrough: null,
      sourceReference: ' Acuerdo institucional 2026 ',
    }
    const createChildUnit = Reflect.get(client, 'createChildUnit') as
      ((parentUnitId: string, childCommand: AcademicOrganizationUnitCreateCommand, accessToken: string,
        signal?: AbortSignal) => Promise<string>) | undefined
    expect(createChildUnit).toBeTypeOf('function')
    if (!createChildUnit) return
    const signal = new AbortController().signal

    // Act
    const createdId = await createChildUnit.call(client, parentId, command, 'institutional-access-token', signal)

    // Assert
    expect(createdId).toBe(childId)
    expect(fetcher).toHaveBeenCalledWith(
      '/api/v1/admin/academic-structure/units/a4a06170-9acf-4718-854e-92e945a7db17/children',
      {
        credentials: 'omit',
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer institutional-access-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: 'SCHOOL-CIENCIAS',
          type: 'SCHOOL',
          displayName: 'Escuela de Ciencias',
          displayOrder: 3,
          validFrom: '2026-10-01',
          validThrough: null,
          sourceReference: 'Acuerdo institucional 2026',
        }),
        signal,
      },
    )
  })

  it('closes a dated organization relation through an authorized patch without sending credentials', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const parentId = 'A4A06170-9ACF-4718-854E-92E945A7DB17'
    const childId = '94a06170-9acf-4718-854e-92e945a7db17'
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    const client = createAcademicOperationsClient(fetcher)
    const command: AcademicStructureRelationCloseCommand = {
      validFrom: '2024-08-01',
      effectiveThrough: '2026-06-30',
      sourceReference: '  Acta institucional 17 de 2026  ',
    }
    const closeRelation = Reflect.get(client, 'closeOrganizationRelation') as
      ((parent: string, child: string, value: AcademicStructureRelationCloseCommand, token: string,
        signal?: AbortSignal) => Promise<void>) | undefined
    expect(closeRelation).toBeTypeOf('function')
    if (!closeRelation) return
    const signal = new AbortController().signal

    // Act
    await closeRelation.call(client, parentId, childId, command, 'institutional-access-token', signal)

    // Assert
    expect(fetcher).toHaveBeenCalledWith(
      '/api/v1/admin/academic-structure/units/a4a06170-9acf-4718-854e-92e945a7db17/children/94a06170-9acf-4718-854e-92e945a7db17/close',
      {
        credentials: 'omit',
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer institutional-access-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          validFrom: '2024-08-01',
          effectiveThrough: '2026-06-30',
          sourceReference: 'Acta institucional 17 de 2026',
        }),
        signal,
      },
    )
  })

  it('closes a dated site relation through the shared authorized patch contract', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const parentId = 'B4A06170-9ACF-4718-854E-92E945A7DB17'
    const childId = '84a06170-9acf-4718-854e-92e945a7db17'
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    const client = createAcademicOperationsClient(fetcher)
    const command: AcademicStructureRelationCloseCommand = {
      validFrom: '2024-01-01',
      effectiveThrough: '2026-06-30',
      sourceReference: 'Acta de organización territorial',
    }

    // Act
    await client.closeSiteRelation(parentId, childId, command, 'institutional-access-token')

    // Assert
    expect(fetcher).toHaveBeenCalledWith(
      '/api/v1/admin/academic-structure/sites/b4a06170-9acf-4718-854e-92e945a7db17/children/84a06170-9acf-4718-854e-92e945a7db17/close',
      expect.objectContaining({
        credentials: 'omit',
        method: 'PATCH',
        body: JSON.stringify(command),
        headers: expect.objectContaining({
          Authorization: 'Bearer institutional-access-token',
          'Content-Type': 'application/json',
        }),
      }),
    )
  })

  it('closes a dated program affiliation through the same audited patch contract', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const programId = 'A4A06170-9ACF-4718-854E-92E945A7DB17'
    const affiliationId = '94a06170-9acf-4718-854e-92e945a7db17'
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    const client = createAcademicOperationsClient(fetcher)
    const command: AcademicStructureRelationCloseCommand = {
      validFrom: '2024-01-01',
      effectiveThrough: '2026-06-30',
      sourceReference: 'Acta de adscripción',
    }
    const closeAffiliation = Reflect.get(client, 'closeProgramAffiliation') as
      ((program: string, affiliation: string, value: AcademicStructureRelationCloseCommand,
        token: string) => Promise<void>) | undefined
    expect(closeAffiliation).toBeTypeOf('function')
    if (!closeAffiliation) return

    // Act
    await closeAffiliation.call(client, programId, affiliationId, command, 'institutional-access-token')

    // Assert
    expect(fetcher).toHaveBeenCalledWith(
      '/api/v1/admin/academic-structure/programs/a4a06170-9acf-4718-854e-92e945a7db17/affiliations/94a06170-9acf-4718-854e-92e945a7db17/close',
      expect.objectContaining({
        credentials: 'omit',
        method: 'PATCH',
        body: JSON.stringify(command),
        headers: expect.objectContaining({
          Authorization: 'Bearer institutional-access-token',
          'Content-Type': 'application/json',
        }),
      }),
    )
  })

  it('reassigns a program affiliation with the expected version and returns the successor identifier', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const programId = 'A4A06170-9ACF-4718-854E-92E945A7DB17'
    const affiliationId = '94a06170-9acf-4718-854e-92e945a7db17'
    const nextAffiliationId = '34a06170-9acf-4718-854e-92e945a7db17'
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ id: nextAffiliationId }, 201))
    const client = createAcademicOperationsClient(fetcher)
    const command = {
      expectedValidFrom: '2027-01-01',
      expectedValidThrough: null,
      effectiveFrom: '2027-06-01',
      organizationUnitId: 'FAE06170-9ACF-4718-854E-92E945A7DB17',
      siteId: 'B16116A1-10BA-4D79-839B-4195E4851D73',
      displayOrder: 4,
      sourceReference: ' Acta institucional de adscripción ',
    }
    const signal = new AbortController().signal
    const reassign = Reflect.get(client, 'reassignProgramAffiliation') as
      ((program: string, affiliation: string, value: typeof command, token: string,
        requestSignal?: AbortSignal) => Promise<string>) | undefined
    expect(reassign).toBeTypeOf('function')
    if (!reassign) return

    // Act
    const createdId = await reassign.call(client, programId, affiliationId, command,
      'institutional-access-token', signal)

    // Assert
    expect(createdId).toBe(nextAffiliationId)
    expect(fetcher).toHaveBeenCalledWith(
      '/api/v1/admin/academic-structure/programs/a4a06170-9acf-4718-854e-92e945a7db17/affiliations/94a06170-9acf-4718-854e-92e945a7db17/reassign',
      expect.objectContaining({
        credentials: 'omit',
        method: 'POST',
        body: JSON.stringify({ ...command, organizationUnitId: command.organizationUnitId.toLowerCase(),
          siteId: command.siteId.toLowerCase(), sourceReference: 'Acta institucional de adscripción' }),
        headers: expect.objectContaining({
          Authorization: 'Bearer institutional-access-token',
          'Content-Type': 'application/json',
        }),
        signal,
      }),
    )
  })

  it('rejects an invalid reassignment before sending it to the server', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const fetcher = vi.fn()
    const client = createAcademicOperationsClient(fetcher)
    const reassign = Reflect.get(client, 'reassignProgramAffiliation') as
      ((program: string, affiliation: string, command: AcademicProgramAffiliationReassignmentCommand,
        token: string) => Promise<string>) | undefined
    expect(reassign).toBeTypeOf('function')
    if (!reassign) return
    const command: AcademicProgramAffiliationReassignmentCommand = {
      expectedValidFrom: '2027-01-01',
      expectedValidThrough: null,
      effectiveFrom: '2027-01-01',
      organizationUnitId: 'fae06170-9acf-4718-854e-92e945a7db17',
      siteId: 'b16116a1-10ba-4d79-839b-4195e4851d73',
      displayOrder: -1,
      sourceReference: 'Referencia',
    }

    // Act + Assert
    await expect(reassign.call(client, 'a4a06170-9acf-4718-854e-92e945a7db17',
      '94a06170-9acf-4718-854e-92e945a7db17', command, 'institutional-access-token'))
      .rejects.toThrow(/invalid|valid/i)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('rejects a relation closure that ends before its selected start date without calling the API', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const fetcher = vi.fn()
    const client = createAcademicOperationsClient(fetcher)
    const command: AcademicStructureRelationCloseCommand = {
      validFrom: '2026-10-01',
      effectiveThrough: '2026-09-30',
      sourceReference: 'Resolución de prueba',
    }
    const closeRelation = Reflect.get(client, 'closeOrganizationRelation') as
      AcademicOperationsClient['closeOrganizationRelation'] | undefined
    expect(closeRelation).toBeTypeOf('function')
    if (!closeRelation) return

    // Act and Assert
    await expect(closeRelation.call(
      client,
      'a4a06170-9acf-4718-854e-92e945a7db17',
      '94a06170-9acf-4718-854e-92e945a7db17',
      command,
      'institutional-access-token',
    )).rejects.toThrow(/interval is invalid/i)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('rejects invalid faculty data before sending a request', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const fetcher = vi.fn()
    const client = createAcademicOperationsClient(fetcher)
    const createUnit = Reflect.get(client, 'createOrganizationUnit') as
      AcademicOperationsClient['createOrganizationUnit'] | undefined
    expect(createUnit).toBeTypeOf('function')
    if (!createUnit) return
    const invalidCommand = {
      code: 'FAC CIENCIAS',
      type: 'FACULTY',
      displayName: 'Facultad de Ciencias',
      displayOrder: -1,
      validFrom: '2026-09-30',
      validThrough: '2026-09-29',
      sourceReference: 'Resolución de prueba',
    }

    // Act
    const request = createUnit.call(client, invalidCommand as unknown as AcademicOrganizationUnitCreateCommand,
      'institutional-access-token')

    // Assert
    await expect(request).rejects.toThrow(/invalid|valid/i)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('preserves a server conflict when a faculty code already exists', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ code: 'academic_structure_conflict', message: 'Conflicto de estructura' }, 409))
    const client = createAcademicOperationsClient(fetcher)
    const createUnit = Reflect.get(client, 'createOrganizationUnit') as
      AcademicOperationsClient['createOrganizationUnit'] | undefined
    expect(createUnit).toBeTypeOf('function')
    if (!createUnit) return
    const command: AcademicOrganizationUnitCreateCommand = {
      code: 'FAC-CIENCIAS',
      type: 'FACULTY',
      displayName: 'Facultad de Ciencias',
      displayOrder: 0,
      validFrom: '2026-09-30',
      validThrough: null,
      sourceReference: 'Acuerdo institucional',
    }

    // Act
    const request = createUnit.call(client, command, 'institutional-access-token')

    // Assert
    await expect(request).rejects.toMatchObject({ status: 409, message: 'Conflicto de estructura' })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('loads structure and open periods from separate public contracts without credentials', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse(structure))
      .mockResolvedValueOnce(jsonResponse([period]))
    const client = createAcademicOperationsClient(fetcher)
    const signal = new AbortController().signal

    // Act
    const result = await Promise.all([client.getStructure(signal), client.getOpenPeriods(signal)])

    // Assert
    expect(result[0].programAffiliations[0]?.programId).toBe(structure.programAffiliations[0]?.programId)
    expect(result[0].organizationRelations[0]?.displayOrder).toBe(3)
    expect(result[1][0]).toMatchObject({ kind: 'REGULAR', status: 'OPEN', calendarRevisionNumber: 1 })
    expect(fetcher).toHaveBeenNthCalledWith(1, '/api/v1/academic-structure', {
      credentials: 'omit',
      headers: { Accept: 'application/json' },
      signal,
    })
    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/v1/academic-periods', {
      credentials: 'omit',
      headers: { Accept: 'application/json' },
      signal,
    })
  })

  it('loads the administrative structure snapshot with the read permission bearer token', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const futureStructure = {
      ...structure,
      programAffiliations: [{
        ...structure.programAffiliations[0]!,
        validFrom: '2027-01-01',
      }],
    }
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(futureStructure))
    const client = createAcademicOperationsClient(fetcher)
    const signal = new AbortController().signal

    // Act
    const result = await client.getAdminStructure('institutional-read-token', signal)

    // Assert
    expect(result.programAffiliations[0]?.validFrom).toBe('2027-01-01')
    expect(fetcher).toHaveBeenCalledWith('/api/v1/admin/academic-structure', {
      credentials: 'omit',
      headers: { Accept: 'application/json', Authorization: 'Bearer institutional-read-token' },
      signal,
    })
  })

  it('rejects malformed hierarchy references and periods that expose a non-open state', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const invalidStructure = {
      ...structure,
      organizationRelations: [{
        parentUnitId: structure.units[0]?.id,
        childUnitId: 'not-a-uuid',
        displayOrder: 0,
        validFrom: '2026-01-01',
        validThrough: null,
      }],
    }
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse(invalidStructure))
      .mockResolvedValueOnce(jsonResponse([{ ...period, status: 'DRAFT' }]))
    const client = createAcademicOperationsClient(fetcher)

    // Act + Assert
    await expect(client.getStructure()).rejects.toThrow(/malformed/i)
    await expect(client.getOpenPeriods()).rejects.toThrow(/malformed/i)
  })

  it('requires a nonnegative integer on every academic structure relationship', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const { displayOrder: _omitted, ...relationWithoutOrder } = structure.organizationRelations[0]!
    const invalidResponses = [
      {
        ...structure,
        organizationRelations: [relationWithoutOrder],
      },
      {
        ...structure,
        sites: [...structure.sites, {
          id: 'bb783bf7-0fbb-48d5-9c49-17240492ef6e',
          code: 'REGIONAL',
          type: 'REGIONAL',
          displayName: 'Sede regional',
          displayOrder: 1,
          status: 'ACTIVE',
          validFrom: '2026-01-01',
          validThrough: null,
        }],
        siteRelations: [{
          parentSiteId: structure.sites[0]!.id,
          childSiteId: 'bb783bf7-0fbb-48d5-9c49-17240492ef6e',
          displayOrder: -1,
          validFrom: '2026-01-01',
          validThrough: null,
        }],
      },
    ]
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse(invalidResponses[0]))
      .mockResolvedValueOnce(jsonResponse(invalidResponses[1]))
    const client = createAcademicOperationsClient(fetcher)

    // Act + Assert
    await expect(client.getStructure()).rejects.toThrow(/malformed/i)
    await expect(client.getStructure()).rejects.toThrow(/malformed/i)
  })

  it('reports a public API error as a retryable rejected request', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ error: 'unavailable' }, 503))
    const client = createAcademicOperationsClient(fetcher)

    // Act + Assert
    await expect(client.getStructure()).rejects.toThrow(/request failed/i)
  })

  it('loads every administrative period with the current bearer token and validates lifecycle states', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const draft = {
      ...period,
      id: 'f52a637b-4422-44d6-afda-9dd6b32f4e4f',
      code: '2027-1',
      status: 'DRAFT',
      calendarRevisionId: null,
      calendarRevisionNumber: null,
      approvalReference: null,
      officialReference: null,
    }
    const approved = { ...period, status: 'APPROVED' }
    const closed = { ...period, id: '92e76bd6-d8c9-4c28-a6c9-7e54f69668bb', code: '2026-INT-1', status: 'CLOSED' }
    const fetcher = vi.fn().mockResolvedValueOnce(jsonResponse([draft, approved, closed]))
    const client = createAcademicOperationsClient(fetcher)
    const signal = new AbortController().signal

    // Act
    const result = await client.getAdminPeriods('synthetic-access-token', signal)

    // Assert
    expect(result.map(({ status }) => status)).toEqual(['DRAFT', 'APPROVED', 'CLOSED'])
    expect(fetcher).toHaveBeenCalledWith('/api/v1/admin/academic-periods', {
      credentials: 'omit',
      headers: { Accept: 'application/json', Authorization: 'Bearer synthetic-access-token' },
      signal,
    })
  })

  it('opens and closes a period through explicit bearer-protected transitions', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const opened = { ...period, status: 'OPEN' }
    const closed = { ...period, status: 'CLOSED' }
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse(opened))
      .mockResolvedValueOnce(jsonResponse(closed))
    const client = createAcademicOperationsClient(fetcher)

    // Act
    const results = await Promise.all([
      client.openPeriod(period.id, 'synthetic-access-token'),
      client.closePeriod(period.id, 'synthetic-access-token'),
    ])

    // Assert
    expect(results.map(({ status }) => status)).toEqual(['OPEN', 'CLOSED'])
    expect(fetcher).toHaveBeenNthCalledWith(1, `/api/v1/admin/academic-periods/${period.id}/open`, {
      credentials: 'omit',
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: 'Bearer synthetic-access-token' },
    })
    expect(fetcher).toHaveBeenNthCalledWith(2, `/api/v1/admin/academic-periods/${period.id}/close`, {
      credentials: 'omit',
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: 'Bearer synthetic-access-token' },
    })
  })

  it('creates, publishes, and approves a versioned calendar with separate references', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const revisionId = 'c2d11854-487b-4d55-b825-0b321fb1f414'
    const draftPeriod = {
      ...period,
      code: '2027-1',
      academicYear: 2027,
      startsOn: '2027-01-15',
      endsOn: '2027-06-20',
      status: 'DRAFT',
      calendarRevisionId: null,
      calendarRevisionNumber: null,
      approvalReference: null,
      officialReference: null,
    }
    const activity = {
      key: 'REGISTRATION',
      label: 'Inscripción',
      startsAt: '2026-11-01T08:00',
      endsAt: '2026-11-10T16:00',
      organizationUnitId: null,
      siteId: null,
    }
    const revision = {
      id: revisionId,
      periodId: period.id,
      version: 1,
      officialReference: 'Resolución de calendario de prueba',
      status: 'DRAFT',
      activities: [activity],
    }
    const approved = {
      ...draftPeriod,
      calendarRevisionId: revisionId,
      calendarRevisionNumber: 1,
      approvalReference: 'Resolución aprobatoria de prueba',
      officialReference: 'Resolución de calendario de prueba',
      status: 'APPROVED',
    }
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse(draftPeriod, 201))
      .mockResolvedValueOnce(jsonResponse(revision, 201))
      .mockResolvedValueOnce(jsonResponse({ ...revision, status: 'PUBLISHED' }))
      .mockResolvedValueOnce(jsonResponse(approved))
    const client = createAcademicOperationsClient(fetcher)
    const signal = new AbortController().signal

    // Act
    const created = await client.createPeriod({
      code: ' 2027-1 ', kind: 'REGULAR', academicYear: 2027, sequenceNumber: 1,
      startsOn: '2027-01-15', endsOn: '2027-06-20',
    }, 'synthetic-access-token', signal)
    const calendar = await client.createCalendar(period.id, {
      officialReference: ' Resolución de calendario de prueba ', activities: [activity],
    }, 'synthetic-access-token', signal)
    const published = await client.publishCalendar(period.id, revisionId, 'synthetic-access-token', signal)
    const approvedResult = await client.approvePeriod(period.id, {
      calendarRevisionId: revisionId, approvalReference: ' Resolución aprobatoria de prueba ',
    }, 'synthetic-access-token', signal)

    // Assert
    expect(created.status).toBe('DRAFT')
    expect(calendar.activities).toEqual([activity])
    expect(published.status).toBe('PUBLISHED')
    expect(approvedResult.status).toBe('APPROVED')
    expect(fetcher).toHaveBeenNthCalledWith(1, '/api/v1/admin/academic-periods', {
      credentials: 'omit', method: 'POST',
      headers: { Accept: 'application/json', Authorization: 'Bearer synthetic-access-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '2027-1', kind: 'REGULAR', academicYear: 2027, sequenceNumber: 1,
        startsOn: '2027-01-15', endsOn: '2027-06-20' }), signal,
    })
    expect(fetcher).toHaveBeenNthCalledWith(2, `/api/v1/admin/academic-periods/${period.id}/calendars`, {
      credentials: 'omit', method: 'POST',
      headers: { Accept: 'application/json', Authorization: 'Bearer synthetic-access-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ officialReference: 'Resolución de calendario de prueba', activities: [activity] }), signal,
    })
    expect(fetcher).toHaveBeenNthCalledWith(3, `/api/v1/admin/academic-periods/${period.id}/calendars/${revisionId}/publish`, {
      credentials: 'omit', method: 'POST',
      headers: { Accept: 'application/json', Authorization: 'Bearer synthetic-access-token' }, signal,
    })
    expect(fetcher).toHaveBeenNthCalledWith(4, `/api/v1/admin/academic-periods/${period.id}/approve`, {
      credentials: 'omit', method: 'POST',
      headers: { Accept: 'application/json', Authorization: 'Bearer synthetic-access-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ calendarRevisionId: revisionId, approvalReference: 'Resolución aprobatoria de prueba' }), signal,
    })
  })

  it('rejects an invalid period range and activity before sending administrative writes', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const fetcher = vi.fn()
    const client = createAcademicOperationsClient(fetcher)

    // Act + Assert
    await expect(client.createPeriod({
      code: '2027-1', kind: 'REGULAR', academicYear: 2027, sequenceNumber: 3,
      startsOn: '2027-06-20', endsOn: '2027-01-15',
    }, 'synthetic-access-token')).rejects.toThrow(/period/i)
    await expect(client.createCalendar(period.id, {
      officialReference: 'Resolución de calendario de prueba',
      activities: [{
        key: 'REGISTRATION', label: 'Inscripción', startsAt: '2026-11-10T16:00', endsAt: '2026-11-01T08:00',
        organizationUnitId: null, siteId: null,
      }],
    }, 'synthetic-access-token')).rejects.toThrow(/calendar/i)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('rejects an intersemester sequence above the API limit before sending the period request', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const fetcher = vi.fn()
    const client = createAcademicOperationsClient(fetcher)

    // Act
    const result = client.createPeriod({
      code: '2027-int-100', kind: 'INTERSEMESTRAL', academicYear: 2027, sequenceNumber: 100,
      startsOn: '2027-06-01', endsOn: '2027-06-30',
    }, 'synthetic-access-token')

    // Assert
    await expect(result).rejects.toThrow(/period/i)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('loads an administrative period history with the read bearer token and validates the response', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const revisionId = 'c2d11854-487b-4d55-b825-0b321fb1f414'
    const history = {
      period,
      calendarRevisions: [{
        id: revisionId,
        periodId: period.id,
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
    }
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(history))
    const client = createAcademicOperationsClient(fetcher)
    const signal = new AbortController().signal
    const getPeriodHistory = (client as unknown as {
      getPeriodHistory: (periodId: string, accessToken: string, signal?: AbortSignal) => Promise<typeof history>
    }).getPeriodHistory

    // Act
    const result = await getPeriodHistory.call(client, period.id, 'synthetic-read-token', signal)

    // Assert
    expect(result.calendarRevisions[0]?.activities[0]?.label).toBe('Inscripción')
    expect(result.auditEvents[0]?.actionKey).toBe('PERIOD_OPENED')
    expect(fetcher).toHaveBeenCalledWith(`/api/v1/admin/academic-periods/${period.id}/history`, {
      credentials: 'omit',
      headers: { Accept: 'application/json', Authorization: 'Bearer synthetic-read-token' },
      signal,
    })
  })

  it('rejects mismatched period histories and audit actions outside the known lifecycle', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const history = {
      period,
      calendarRevisions: [],
      auditEvents: [{
        id: 1,
        actionKey: 'PERIOD_OPENED',
        actorSub: 'synthetic-period-operator',
        occurredAt: '2026-08-10T13:00:00Z',
        reference: null,
        summary: 'Academic period state changed to OPEN.',
      }],
    }
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ ...history, period: { ...period, id: '0326036b-58de-4897-bc5b-1e54d498ec4d' } }))
      .mockResolvedValueOnce(jsonResponse({
        ...history,
        auditEvents: [{ ...history.auditEvents[0], actionKey: 'UNRECOGNIZED_ACTION' }],
      }))
    const client = createAcademicOperationsClient(fetcher)

    // Act + Assert
    await expect(client.getPeriodHistory(period.id, 'synthetic-read-token')).rejects.toThrow(/malformed/i)
    await expect(client.getPeriodHistory(period.id, 'synthetic-read-token')).rejects.toThrow(/malformed/i)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('rejects duplicate activity keys inside one calendar revision', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const revisionId = 'c2d11854-487b-4d55-b825-0b321fb1f414'
    const activity = {
      key: 'REGISTRATION',
      label: 'Inscripción',
      startsAt: '2026-06-22T08:00:00',
      endsAt: '2026-06-28T16:00:00',
      organizationUnitId: null,
      siteId: null,
    }
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({
      period,
      calendarRevisions: [{
        id: revisionId,
        periodId: period.id,
        version: 1,
        officialReference: 'Calendario institucional de prueba',
        status: 'PUBLISHED',
        activities: [activity, { ...activity, label: 'Inscripción duplicada' }],
      }],
      auditEvents: [],
    }))
    const client = createAcademicOperationsClient(fetcher)

    // Act + Assert
    await expect(client.getPeriodHistory(period.id, 'synthetic-read-token')).rejects.toThrow(/malformed/i)
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('changes all five structure order targets through audited conditional PATCH requests', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const unitId = structure.units[0]!.id
    const childUnitId = structure.units[1]!.id
    const siteId = structure.sites[0]!.id
    const programId = structure.programAffiliations[0]!.programId
    const affiliationId = structure.programAffiliations[0]!.id
    const command = { expectedDisplayOrder: 3, displayOrder: 9, sourceReference: 'Resolución institucional 123' }
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    const client = createAcademicOperationsClient(fetcher)
    const signal = new AbortController().signal

    // Act
    await client.changeOrganizationUnitOrder(unitId, command, 'synthetic-access-token', signal)
    await client.changeSiteOrder(siteId, command, 'synthetic-access-token', signal)
    await client.changeOrganizationRelationOrder(unitId, childUnitId, command, 'synthetic-access-token', signal)
    await client.changeSiteRelationOrder(siteId, 'bb783bf7-0fbb-48d5-9c49-17240492ef6e', command,
      'synthetic-access-token', signal)
    await client.changeProgramAffiliationOrder(programId, affiliationId, command, 'synthetic-access-token', signal)

    // Assert
    const expectedPaths = [
      `/api/v1/admin/academic-structure/units/${unitId}/order`,
      `/api/v1/admin/academic-structure/sites/${siteId}/order`,
      `/api/v1/admin/academic-structure/units/${unitId}/children/${childUnitId}/order`,
      `/api/v1/admin/academic-structure/sites/${siteId}/children/bb783bf7-0fbb-48d5-9c49-17240492ef6e/order`,
      `/api/v1/admin/academic-structure/programs/${programId}/affiliations/${affiliationId}/order`,
    ]
    expect(fetcher).toHaveBeenCalledTimes(expectedPaths.length)
    expectedPaths.forEach((path, index) => {
      expect(fetcher).toHaveBeenNthCalledWith(index + 1, path, {
        credentials: 'omit',
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer synthetic-access-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
        signal,
      })
    })
  })

  it('rejects invalid order commands locally and exposes a concurrent edit as a conflict', async () => {
    // Arrange
    const { AcademicOperationsApiError, createAcademicOperationsClient } = await loadClient()
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ message: 'Order changed since it was read.' }, 409))
    const client = createAcademicOperationsClient(fetcher)
    const validCommand = { expectedDisplayOrder: 3, displayOrder: 9, sourceReference: 'Acto institucional 123' }

    // Act + Assert: invalid paths, values and references fail before a request is sent.
    await expect(client.changeSiteOrder('invalid-id', validCommand, 'synthetic-access-token')).rejects.toThrow(/malformed/i)
    await expect(client.changeSiteOrder(structure.sites[0]!.id, { ...validCommand, displayOrder: 100_001 },
      'synthetic-access-token')).rejects.toThrow(/order/i)
    await expect(client.changeSiteOrder(structure.sites[0]!.id, { ...validCommand, sourceReference: '  ' },
      'synthetic-access-token')).rejects.toThrow(/reference/i)
    expect(fetcher).not.toHaveBeenCalled()

    // Act: a stale expected value is rejected by the server.
    const action = client.changeSiteOrder(structure.sites[0]!.id, validCommand, 'synthetic-access-token')

    // Assert
    await expect(action).rejects.toBeInstanceOf(AcademicOperationsApiError)
    await expect(action).rejects.toMatchObject({ status: 409 })
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('rejects blank credentials and a transition response with the wrong status', async () => {
    // Arrange
    const { createAcademicOperationsClient } = await loadClient()
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ ...period, status: 'CLOSED' }))
    const client = createAcademicOperationsClient(fetcher)

    // Act + Assert
    await expect(client.getAdminPeriods('   ')).rejects.toThrow(/token/i)
    await expect(client.openPeriod(period.id, 'synthetic-access-token')).rejects.toThrow(/malformed/i)
  })
})
