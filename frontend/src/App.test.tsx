import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import publicUndergraduateSnapshot from './features/academics/publicCatalog/uptcUndergraduateCatalog.snapshot.json'
import { AcademicOperationsApiError } from './features/academics/academicOperationsClient'
import { BrandingProvider } from './features/branding/BrandingProvider'
import { DEFAULT_BRANDING } from './features/branding/contracts'
import type { AcademicCatalogClient } from './features/academics/contracts'
import type { AcademicOperationsClient, AcademicOrganizationUnitCreateCommand, AcademicPeriod } from './features/academics/academicOperationsContracts'
import type { SpaceGuideClient } from './features/spaces/spaceGuideClient'
import { APPLICATION_PERMISSIONS } from './features/identity/identityContracts'
import type { CurrentIdentity, IdentityClient } from './features/identity/identityContracts'
import { IdentityApiError } from './features/identity/identityClient'
import type { IdentitySessionManager } from './features/identity/IdentityProvider'
import type { OidcConfigurationResult } from './features/identity/oidcConfiguration'
import type { RoleAccessClient, RoleProfile } from './features/access/roleAccessContracts'

const oidcConfiguration: OidcConfigurationResult = {
  status: 'configured',
  settings: {
    authority: 'https://identity.example.edu.co',
    clientId: 'universiry-web',
    redirectUri: 'https://universiry.example.edu.co/auth/callback',
    postLogoutRedirectUri: 'https://universiry.example.edu.co/',
    scope: 'openid university-api',
  },
}

function authenticatedSessionManager(): IdentitySessionManager {
  return {
    getUser: async () => ({
      access_token: 'synthetic-access-token',
      expires_at: Math.floor(Date.now() / 1000) + 300,
    }),
    signinRedirect: async () => {},
    signinCallback: async () => undefined,
    signoutRedirect: async () => {},
    removeUser: async () => {},
  }
}

function identityClientWithPermissions(permissions: CurrentIdentity['permissions']): IdentityClient {
  return { current: async () => ({
    userId: '7b717347-ae70-4a76-9a1d-01b9f178c0d2', subject: 'synthetic-subject', permissions,
  }) }
}

function readOnlyRoleAccessClient(): RoleAccessClient {
  const profiles: RoleProfile[] = [
    { key: 'APPLICANT', displayName: 'Aspirante', manuallyAssignable: false, allowedScopeKinds: [], permissions: [] },
    { key: 'ADMITTED', displayName: 'Admitido', manuallyAssignable: false, allowedScopeKinds: [], permissions: [] },
    { key: 'STUDENT', displayName: 'Estudiante', manuallyAssignable: false, allowedScopeKinds: [], permissions: [] },
    { key: 'TEACHER', displayName: 'Docente', manuallyAssignable: true, allowedScopeKinds: ['UNIVERSITY', 'SITE', 'FACULTY', 'PROGRAM', 'JOB_APPOINTMENT'], permissions: [] },
    { key: 'ADMINISTRATIVE', displayName: 'Administrativo', manuallyAssignable: true, allowedScopeKinds: ['UNIVERSITY', 'SITE', 'FACULTY', 'PROGRAM', 'JOB_APPOINTMENT'], permissions: [] },
    { key: 'ADMISSIONS', displayName: 'Admisiones', manuallyAssignable: true, allowedScopeKinds: ['UNIVERSITY', 'SITE', 'FACULTY', 'PROGRAM', 'JOB_APPOINTMENT'], permissions: [] },
    { key: 'DIRECTIVE', displayName: 'Directivo', manuallyAssignable: true, allowedScopeKinds: ['UNIVERSITY', 'SITE', 'FACULTY', 'PROGRAM', 'JOB_APPOINTMENT'], permissions: [] },
    { key: 'ADMINISTRATOR', displayName: 'Administrador', manuallyAssignable: true, allowedScopeKinds: ['UNIVERSITY'], permissions: ['identity:roles:read', 'identity:roles:write'] },
  ]
  return {
    roleProfiles: vi.fn().mockResolvedValue(profiles),
    searchIdentities: async () => [],
    assignments: async () => [],
    assign: async () => { throw new Error('Unexpected role assignment') },
    revoke: async () => { throw new Error('Unexpected role revocation') },
  }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '#inicio')
})

function stubPublicUndergraduateSnapshot() {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => publicUndergraduateSnapshot,
  }) as Response))
}

function emptyAcademicCatalogClient(): AcademicCatalogClient {
  return {
    listPrograms: async () => [],
    listCurricula: async () => [],
    getPublishedCurriculum: async () => { throw new Error('Unexpected public curriculum detail') },
    listPublishedCurriculumEntries: async () => { throw new Error('Unexpected public curriculum page') },
    listDrafts: async () => ({ pageSize: 25, totalItems: 0, nextCursor: null, drafts: [] }),
    getCurriculum: async () => { throw new Error('Unexpected curriculum review') },
    previewCsv: async () => { throw new Error('Unexpected curriculum preview') },
    importCsv: async () => { throw new Error('Unexpected curriculum import') },
    publishCurriculum: async () => { throw new Error('Unexpected curriculum publication') },
  }
}

function emptyAcademicOperationsClient(): AcademicOperationsClient {
  return {
    getStructure: async () => ({
      units: [], organizationRelations: [], sites: [], siteRelations: [], programAffiliations: [],
    }),
    getAdminStructure: async () => ({
      units: [], organizationRelations: [], sites: [], siteRelations: [], programAffiliations: [],
    }),
    createOrganizationUnit: async (_command: AcademicOrganizationUnitCreateCommand) => {
      throw new Error('Unexpected organization unit creation')
    },
    createChildUnit: async () => { throw new Error('Unexpected child organization unit creation') },
    closeOrganizationRelation: async () => { throw new Error('Unexpected organization relation closure') },
    createSite: async () => { throw new Error('Unexpected site creation') },
    closeSiteRelation: async () => { throw new Error('Unexpected site relation closure') },
    relateOrganizationUnits: async () => { throw new Error('Unexpected organization relation creation') },
    relateSites: async () => { throw new Error('Unexpected site relation creation') },
    affiliateProgram: async () => { throw new Error('Unexpected program affiliation creation') },
    reassignProgramAffiliation: async () => { throw new Error('Unexpected program affiliation reassignment') },
    closeProgramAffiliation: async () => { throw new Error('Unexpected program affiliation closure') },
    getOpenPeriods: async () => [],
    getAdminPeriods: async () => [],
    getPeriodHistory: async () => { throw new Error('Unexpected period history read') },
    getStructureAuditEvents: async () => { throw new Error('Unexpected structure audit read') },
    createPeriod: async () => { throw new Error('Unexpected period creation') },
    createCalendar: async () => { throw new Error('Unexpected calendar revision creation') },
    publishCalendar: async () => { throw new Error('Unexpected calendar publication') },
    approvePeriod: async () => { throw new Error('Unexpected period approval') },
    openPeriod: async () => { throw new Error('Unexpected period opening') },
    closePeriod: async () => { throw new Error('Unexpected period closing') },
    changeOrganizationUnitOrder: async () => { throw new Error('Unexpected unit order change') },
    changeSiteOrder: async () => { throw new Error('Unexpected site order change') },
    changeOrganizationRelationOrder: async () => { throw new Error('Unexpected organization relation order change') },
    changeSiteRelationOrder: async () => { throw new Error('Unexpected site relation order change') },
    changeProgramAffiliationOrder: async () => { throw new Error('Unexpected program affiliation order change') },
  }
}

function publicSpaceGuideClient(): SpaceGuideClient {
  return {
    listSpaces: async () => ({
      officialOfficeDirectoryUrl: 'https://www.uptc.edu.co/sitio/portal/sitios/directorio/',
      requestPathways: [{
        id: 'library-rooms',
        kind: 'LIBRARY_ROOM',
        title: 'Salas y espacios de biblioteca',
        audience: 'Comunidad UPTC',
        summary: 'Consulta condiciones y disponibilidad con la biblioteca.',
        availabilityNote: 'La guía no confirma reservas.',
        sources: [{
          label: 'Servicios de Biblioteca UPTC',
          url: 'https://www.uptc.edu.co/sitio/portal/sitios/universidad/vic_aca/bibl/4_bpd/blbl_pres.html',
          checkedAt: '2026-10-01',
          sourceUpdatedAt: null,
        }],
      }],
      locations: [{
        id: 'site-central-tunja',
        kind: 'CAMPUS',
        name: 'Sede Central Tunja',
        municipality: 'Tunja',
        department: 'Boyacá',
        address: 'Avenida Central del Norte 39-115',
        locationDetail: null,
        mapQuery: 'Avenida Central del Norte 39-115, Tunja, Boyacá',
        source: {
          label: 'Localización y sedes UPTC',
          url: 'https://uptc.edu.co/sitio/portal/sitios/localizacion/',
          checkedAt: '2026-10-01',
          sourceUpdatedAt: '2026-07-03',
        },
        announcement: null,
      }],
    }),
  }
}

describe('App', () => {
  it('lets keyboard users skip the application shell and focus the main region', async () => {
    // Arrange
    const user = userEvent.setup()
    window.history.replaceState(null, '', '#resumen')
    render(
      <BrandingProvider loader={async () => DEFAULT_BRANDING}>
        <App
          oidcConfiguration={{ status: 'unconfigured' }}
          currentIdentityClient={identityClientWithPermissions([])}
          localPreviewSessionClient={null}
        />
      </BrandingProvider>,
    )

    const skipLink = screen.getByRole('link', { name: 'Saltar al contenido principal' })

    // Act
    await user.tab()

    // Assert
    expect(skipLink).toHaveFocus()

    // Act
    await user.keyboard('{Enter}')
    const mainContent = screen.getByRole('main')

    // Assert
    expect(mainContent).toHaveAttribute('tabindex', '-1')
    expect(mainContent).toHaveFocus()
  })

  it('opens student services from the portal home and keeps the identity center on its own route', async () => {
    // Arrange
    const user = userEvent.setup()
    window.history.replaceState(null, '', '#resumen')
    render(
      <BrandingProvider loader={async () => DEFAULT_BRANDING}>
        <App
          oidcConfiguration={{ status: 'unconfigured' }}
          currentIdentityClient={identityClientWithPermissions([])}
          localPreviewSessionClient={null}
        />
      </BrandingProvider>,
    )

    // Act
    await screen.findByRole('heading', { name: /tu universidad, en un mismo lugar/i }, { timeout: 10_000 })
    await user.click(await screen.findByRole('link', { name: /servicios académicos/i }, { timeout: 10_000 }))

    // Assert
    expect(await screen.findByRole('heading', { name: 'Servicios para acompañar tu vida universitaria' })).toBeVisible()
    expect(window.location.hash).toBe('#estudiantes')
    expect(within(screen.getByRole('navigation', { name: 'Principal' }))
      .getByRole('link', { name: 'Servicios estudiantiles' })).toHaveAttribute('aria-current', 'page')
  })

  it('opens the portal summary by default and preserves the visual identity center route', async () => {
    // Arrange
    const user = userEvent.setup()
    window.history.replaceState(null, '', '/')
    render(
      <BrandingProvider loader={async () => DEFAULT_BRANDING}>
        <App
          catalogClient={emptyAcademicCatalogClient()}
        />
      </BrandingProvider>,
    )

    // Act
    const summaryLink = within(screen.getByRole('navigation', { name: 'Principal' }))
      .getByRole('link', { name: 'Resumen' })

    // Assert
    expect(await screen.findByRole('heading', { name: /tu universidad, en un mismo lugar/i })).toBeVisible()
    expect(summaryLink).toHaveAttribute('href', '#resumen')
    expect(summaryLink).toHaveAttribute('aria-current', 'page')
    const identityLink = within(screen.getByRole('navigation', { name: 'Principal' }))
      .getByRole('link', { name: 'Identidad visual' })
    expect(identityLink).toHaveAttribute('href', '#inicio')

    // Act
    await user.click(identityLink)

    // Assert
    expect(await screen.findByRole('heading', { name: /centro de identidad visual/i })).toBeVisible()
    expect(window.location.hash).toBe('#inicio')
  })

  it('shows administrative home links only for effective permissions', async () => {
    // Arrange
    window.history.replaceState(null, '', '#resumen')
    render(
      <BrandingProvider loader={async () => DEFAULT_BRANDING}>
        <App
          oidcConfiguration={oidcConfiguration}
          identityManager={authenticatedSessionManager()}
          currentIdentityClient={identityClientWithPermissions(['academic:period:read'])}
          localPreviewSessionClient={null}
        />
      </BrandingProvider>,
    )

    // Act
    await screen.findByText('Sesión institucional activa')
    const administration = await screen.findByRole('region', { name: /herramientas administrativas/i })

    // Assert
    expect(within(administration).getByRole('link', { name: /estructura, periodos y oferta/i }))
      .toHaveAttribute('href', '#academia')
    expect(within(administration).queryByRole('link', { name: /accesos y perfiles/i }))
      .not.toBeInTheDocument()
  })

  it('does not expose synthetic student, grade, or classroom demos through product navigation', async () => {
    // Arrange
    window.history.replaceState(null, '', '#inicio')
    render(
      <BrandingProvider loader={async () => DEFAULT_BRANDING}>
        <App
          oidcConfiguration={{ status: 'unconfigured' }}
          currentIdentityClient={identityClientWithPermissions([])}
          localPreviewSessionClient={null}
        />
      </BrandingProvider>,
    )

    // Act
    await screen.findByRole('heading', { name: /centro de identidad visual/i })

    // Assert
    expect(screen.queryAllByRole('link', { name: /demo|vida académica|registro de calificaciones|asignación de aulas/i }))
      .toHaveLength(0)
  })

  it('hides unavailable university modules and keeps implemented routes visible', async () => {
    // Arrange
    window.history.replaceState(null, '', '#inicio')
    render(
      <BrandingProvider loader={async () => DEFAULT_BRANDING}>
        <App
          oidcConfiguration={{ status: 'unconfigured' }}
          currentIdentityClient={identityClientWithPermissions([])}
          localPreviewSessionClient={null}
        />
      </BrandingProvider>,
    )

    // Act
    const primaryNavigation = await screen.findByRole('navigation', { name: 'Principal' })

    // Assert
    expect(within(primaryNavigation).getByRole('link', { name: 'Programas' })).toHaveAttribute('href', '#programas')
    expect(within(primaryNavigation).getByRole('link', { name: 'Estructura y periodos' })).toHaveAttribute('href', '#academia')
    expect(screen.queryByRole('navigation', { name: 'Módulos universitarios' })).not.toBeInTheDocument()
  })

  it('labels local developer access and opens only modules returned by the current-identity API', async () => {
    // Arrange
    const user = userEvent.setup()
    const localPreviewSessionClient = {
      create: vi.fn().mockResolvedValue({
        accessToken: 'synthetic-local-preview-token',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      }),
      revoke: vi.fn().mockResolvedValue(undefined),
    }
    const getStructureAuditEvents = vi.fn().mockResolvedValue({ events: [], nextCursor: null })
    const academicOperationsClient: AcademicOperationsClient = {
      ...emptyAcademicOperationsClient(),
      getStructureAuditEvents,
    }
    window.history.replaceState(null, '', '#academia')
    render(
      <BrandingProvider loader={async () => DEFAULT_BRANDING}>
        <App
          oidcConfiguration={{ status: 'unconfigured' }}
          localPreviewSessionClient={localPreviewSessionClient}
          currentIdentityClient={identityClientWithPermissions([...APPLICATION_PERMISSIONS])}
          academicOperationsClient={academicOperationsClient}
          catalogClient={emptyAcademicCatalogClient()}
        />
      </BrandingProvider>,
    )

    // Act
    await user.click(await screen.findByRole('button', { name: 'Entrar al preview local' }))

    // Assert
    expect(await screen.findByText('Desarrollador local · modo preview')).toBeVisible()
    expect(screen.getByText(/Esta sesión no es institucional/i)).toBeVisible()
    expect(await screen.findByRole('heading', { name: /bitácora de estructura académica/i })).toBeVisible()
    expect(getStructureAuditEvents).toHaveBeenCalledWith(
      { limit: 50 }, 'synthetic-local-preview-token', expect.any(AbortSignal),
    )
    expect(localPreviewSessionClient.create).toHaveBeenCalledOnce()
  })

  it('keeps the access route closed when the current identity has no read permission', async () => {
    // Arrange
    const roleAccessClient: RoleAccessClient = {
      ...readOnlyRoleAccessClient(),
      roleProfiles: vi.fn().mockResolvedValue([]),
    }
    window.history.replaceState(null, '', '#accesos')
    render(
      <BrandingProvider loader={async () => DEFAULT_BRANDING}>
        <App
          oidcConfiguration={oidcConfiguration}
          identityManager={authenticatedSessionManager()}
          currentIdentityClient={identityClientWithPermissions([])}
          roleAccessClient={roleAccessClient}
        />
      </BrandingProvider>,
    )

    // Act
    const lockedState = await screen.findByText(/requiere el permiso identity:roles:read/i)

    // Assert
    expect(lockedState).toBeVisible()
    expect(screen.queryByRole('link', { name: /accesos y perfiles/i })).not.toBeInTheDocument()
    expect(roleAccessClient.roleProfiles).not.toHaveBeenCalled()
  })

  it('shows role profiles in the protected read-only route without exposing assignment controls', async () => {
    // Arrange
    const roleAccessClient = readOnlyRoleAccessClient()
    window.history.replaceState(null, '', '#inicio')
    render(
      <BrandingProvider loader={async () => DEFAULT_BRANDING}>
        <App
          oidcConfiguration={oidcConfiguration}
          identityManager={authenticatedSessionManager()}
          currentIdentityClient={identityClientWithPermissions(['identity:roles:read'])}
          roleAccessClient={roleAccessClient}
        />
      </BrandingProvider>,
    )

    // Act
    const accessLink = await screen.findByRole('link', { name: /accesos y perfiles/i })
    await userEvent.setup().click(accessLink)

    // Assert
    expect(await screen.findByRole('heading', { name: 'Accesos y perfiles' })).toBeVisible()
    expect(roleAccessClient.roleProfiles).toHaveBeenCalledOnce()
    expect(roleAccessClient.roleProfiles).toHaveBeenCalledWith('synthetic-access-token', expect.any(AbortSignal))
    expect(screen.queryByRole('button', { name: 'Asignar perfil' })).not.toBeInTheDocument()
    expect(accessLink).toHaveAttribute('aria-current', 'page')
  })

  it('applies institution name, published logo, and module label to the application shell', async () => {
    // Arrange
    const branding = {
      ...DEFAULT_BRANDING,
      institutionName: 'Universidad de prueba institucional',
      assets: { ...DEFAULT_BRANDING.assets, logoDark: 'a7e7f06b-09a7-43db-a468-4c7b8ee3d301' },
      modules: DEFAULT_BRANDING.modules.map((module) => module.key === 'visual-identity'
        ? { ...module, label: 'Marca institucional' }
        : module),
    }
    render(
      <BrandingProvider loader={async () => branding}>
        <App />
      </BrandingProvider>,
    )

    // Act
    const lockup = await screen.findByRole('link', { name: 'Universidad de prueba institucional, inicio' })

    // Assert
    expect(lockup.querySelector('img')).toHaveAttribute('src', '/assets/a7e7f06b-09a7-43db-a468-4c7b8ee3d301')
    expect(screen.getByRole('link', { name: 'Marca institucional' })).toBeVisible()
    expect(screen.getByText('Marca institucional', { selector: '.breadcrumbs strong' })).toBeVisible()
    expect(screen.getByRole('group', { name: 'Tema visual' })).toBeVisible()
    expect(screen.getByRole('radio', { name: 'Automático' })).toBeChecked()
  })

  it('opens the visual identity control center and keeps publication closed without institutional access', async () => {
    // Arrange
    const branding = {
      ...DEFAULT_BRANDING,
      institutionName: 'Universidad Pedagógica y Tecnológica de Colombia',
    }
    render(
      <BrandingProvider loader={async () => branding}>
        <App />
      </BrandingProvider>,
    )

    // Act
    const centerHeading = await screen.findByRole('heading', { name: 'Centro de identidad visual' })

    // Assert
    expect(centerHeading).toBeVisible()
    expect(screen.getByRole('button', { name: 'Publicar cambios' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('La publicación requiere acceso institucional')
    expect(screen.getByRole('link', { name: 'Identidad visual' })).toBeVisible()
  })

  it('announces the selected academic module while its route chunk loads', () => {
    // Arrange
    window.history.replaceState(null, '', '#programas')
    const catalogClient = emptyAcademicCatalogClient()

    // Act
    render(
      <BrandingProvider loader={async () => DEFAULT_BRANDING}>
        <App catalogClient={catalogClient} />
      </BrandingProvider>,
    )

    // Assert
    expect(screen.getByText('Cargando módulo académico…')).toBeVisible()
  })

  it('reserves the catalog height while the programs route chunk loads', () => {
    // Arrange
    window.history.replaceState(null, '', '#programas')
    const catalogClient = emptyAcademicCatalogClient()

    // Act
    render(
      <BrandingProvider loader={async () => DEFAULT_BRANDING}>
        <App catalogClient={catalogClient} />
      </BrandingProvider>,
    )

    // Assert: el footer no debe bajar miles de pixeles al montar la pagina.
    expect(screen.getByRole('status')).toHaveClass('module-loading-tall')
  })

  it('updates the skip link target when the active route changes', async () => {
    // Arrange
    const user = userEvent.setup()
    window.history.replaceState(null, '', '#resumen')
    render(
      <BrandingProvider loader={async () => DEFAULT_BRANDING}>
        <App
          oidcConfiguration={{ status: 'unconfigured' }}
          currentIdentityClient={identityClientWithPermissions([])}
          localPreviewSessionClient={null}
        />
      </BrandingProvider>,
    )

    const skipLink = screen.getByRole('link', { name: 'Saltar al contenido principal' })
    const programsLink = within(screen.getByRole('navigation', { name: 'Principal' }))
      .getByRole('link', { name: 'Programas' })

    // Act
    await user.click(programsLink)
    const mainContent = await screen.findByRole('main')

    // Assert
    await waitFor(() => expect(skipLink).toHaveAttribute('href', '#programas'))
    expect(mainContent).toHaveAttribute('id', 'programas')
  })

  it('opens the public undergraduate directory by keyboard while curriculum controls stay unavailable', async () => {
    // Arrange
    const user = userEvent.setup()
    stubPublicUndergraduateSnapshot()
    render(
      <BrandingProvider loader={async () => DEFAULT_BRANDING}>
        <App catalogClient={emptyAcademicCatalogClient()} />
      </BrandingProvider>,
    )

    // Act
    const programsLink = within(screen.getByRole('navigation', { name: 'Principal' }))
      .getByRole('link', { name: 'Programas' })
    for (let tabs = 0; tabs < 12 && !programsLink.matches(':focus'); tabs += 1) await user.tab()
    expect(programsLink).toHaveFocus()
    await user.keyboard('{Enter}')

    // Assert
    expect(await screen.findByRole('heading', { name: 'Programas de pregrado UPTC' })).toBeVisible()
    expect(programsLink).toHaveAttribute('aria-current', 'page')
    expect(DEFAULT_BRANDING.modules.find((module) => module.key === 'programs')?.available).toBe(false)
    expect(screen.getByRole('link', { name: /catálogo público UPTC/i })).toHaveAttribute('href', 'https://www.uptc.edu.co/sitio/portal/sitios/programas_ofer/pregrado.html')
  })

  it('opens academic structure and periods from the application navigation', async () => {
    // Arrange
    const user = userEvent.setup()
    render(
      <BrandingProvider loader={async () => DEFAULT_BRANDING}>
        <App
          catalogClient={emptyAcademicCatalogClient()}
          academicOperationsClient={emptyAcademicOperationsClient()}
        />
      </BrandingProvider>,
    )

    // Act
    const link = await screen.findByRole('link', { name: /estructura y periodos/i })
    await user.click(link)

    // Assert
    expect(await screen.findByRole('heading', { name: /estructura y periodos académicos/i })).toBeVisible()
    expect(link).toHaveAttribute('aria-current', 'page')
  })

  it('opens the public undergraduate admissions calendar from the application navigation', async () => {
    // Arrange
    const user = userEvent.setup()
    render(
      <BrandingProvider loader={async () => DEFAULT_BRANDING}>
        <App />
      </BrandingProvider>,
    )

    // Act
    const link = await screen.findByRole('link', { name: /admisiones/i })
    expect(link).toHaveAccessibleName(/admisiones.*información pública/i)
    await user.click(link)

    // Assert
    expect(await screen.findByRole('heading', { name: /pregrado presencial.*2027-i/i })).toBeVisible()
    expect(screen.queryByRole('tab', { name: /demo/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/programa ficticio|datos sintéticos/i)).not.toBeInTheDocument()
    expect(link).toHaveAttribute('href', '#admisiones')
    expect(link).toHaveAttribute('aria-current', 'page')
  })

  it('hides admissions from navigation when branding disables visibility but keeps its public route accessible', async () => {
    // Arrange
    const branding = {
      ...DEFAULT_BRANDING,
      modules: DEFAULT_BRANDING.modules.map((module) => module.key === 'admissions'
        ? { ...module, visible: false }
        : module),
    }
    window.history.replaceState(null, '', '#admisiones')
    render(
      <BrandingProvider loader={async () => branding}>
        <App />
      </BrandingProvider>,
    )

    // Act
    const pageHeading = await screen.findByRole('heading', { name: /pregrado presencial.*2027-i/i })

    // Assert
    expect(screen.queryByRole('link', { name: /admisiones.*información pública/i })).not.toBeInTheDocument()
    expect(pageHeading).toBeVisible()
  })

  it('opens the public space guide from navigation and applies the configured module label', async () => {
    // Arrange
    const user = userEvent.setup()
    const branding = {
      ...DEFAULT_BRANDING,
      modules: DEFAULT_BRANDING.modules.map((module) => module.key === 'spaces'
        ? { ...module, label: 'Sedes y lugares' }
        : module),
    }
    window.history.replaceState(null, '', '#inicio')
    render(
      <BrandingProvider loader={async () => branding}>
        <App spaceGuideClient={publicSpaceGuideClient()} />
      </BrandingProvider>,
    )

    // Act
    const spacesLink = await screen.findByRole('link', { name: /sedes y lugares/i })
    await user.click(spacesLink)

    // Assert
    expect(await screen.findByRole('heading', { name: 'Guía de espacios' })).toBeVisible()
    expect(await screen.findByRole('article', { name: 'Sede Central Tunja' })).toBeVisible()
    expect(spacesLink).toHaveAttribute('href', '#espacios')
    expect(spacesLink).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('Sedes y lugares', { selector: '.breadcrumbs strong' })).toBeVisible()
  })

  it('hides the space navigation link when branding disables visibility but keeps the direct public route', async () => {
    // Arrange
    const branding = {
      ...DEFAULT_BRANDING,
      modules: DEFAULT_BRANDING.modules.map((module) => module.key === 'spaces'
        ? { ...module, visible: false }
        : module),
    }
    window.history.replaceState(null, '', '#espacios')
    render(
      <BrandingProvider loader={async () => branding}>
        <App spaceGuideClient={publicSpaceGuideClient()} />
      </BrandingProvider>,
    )

    // Act
    const pageHeading = await screen.findByRole('heading', { name: 'Guía de espacios' })

    // Assert
    expect(screen.queryByRole('link', { name: /guía de espacios/i })).not.toBeInTheDocument()
    expect(pageHeading).toBeVisible()
  })

  it('uses backend branding permission without granting academic catalog controls', async () => {
    // Arrange
    const user = userEvent.setup()
    stubPublicUndergraduateSnapshot()
    const catalogClient = {
      ...emptyAcademicCatalogClient(),
      listDrafts: vi.fn().mockResolvedValue({ pageSize: 25, totalItems: 0, nextCursor: null, drafts: [] }),
    }
    window.history.replaceState(null, '', '#inicio')
    render(
      <BrandingProvider loader={async () => DEFAULT_BRANDING}>
        <App
          catalogClient={catalogClient}
          oidcConfiguration={oidcConfiguration}
          identityManager={authenticatedSessionManager()}
          currentIdentityClient={identityClientWithPermissions(['branding:write'])}
        />
      </BrandingProvider>,
    )

    // Act
    expect(await screen.findByText('Sesión institucional activa')).toBeVisible()
    await user.click(within(screen.getByRole('navigation', { name: 'Principal' }))
      .getByRole('link', { name: 'Programas' }))
    expect(await screen.findByRole('heading', { name: 'Programas de pregrado UPTC' })).toBeVisible()

    // Assert
    expect(catalogClient.listDrafts).not.toHaveBeenCalled()
    expect(screen.queryByLabelText(/archivo CSV/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible()

    // Act: the same permission remains scoped to the visual identity module.
    await user.click(screen.getByRole('link', { name: 'Identidad visual' }))
    const primaryColor = await screen.findByLabelText('Color HEX: Primario')
    await user.clear(primaryColor)
    await user.type(primaryColor, '#E0C037')

    // Assert
    expect(screen.getByRole('button', { name: 'Publicar cambios' })).toBeEnabled()
  })

  it('keeps sign-out available when the permission lookup fails', async () => {
    // Arrange
    const user = userEvent.setup()
    const manager = authenticatedSessionManager()
    manager.getUser = vi.fn().mockResolvedValue({
      access_token: 'synthetic-access-token',
      expires_at: Math.floor(Date.now() / 1000) + 300,
    })
    manager.signoutRedirect = vi.fn().mockResolvedValue(undefined)
    render(
      <BrandingProvider loader={async () => DEFAULT_BRANDING}>
        <App
          oidcConfiguration={oidcConfiguration}
          identityManager={manager}
          currentIdentityClient={{ current: vi.fn().mockRejectedValue(new Error('service unavailable')) }}
        />
      </BrandingProvider>,
    )

    // Act + Assert: verification errors keep permissions closed and preserve a way to end the local session.
    expect(await screen.findByText(/no fue posible verificar los permisos/i)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(manager.signoutRedirect).toHaveBeenCalledOnce()
    expect(await screen.findByText('Sin sesión institucional')).toBeVisible()
  })

  it('does not let an academic catalog permission publish visual identity changes', async () => {
    // Arrange
    const user = userEvent.setup()
    window.history.replaceState(null, '', '#inicio')
    render(
      <BrandingProvider loader={async () => DEFAULT_BRANDING}>
        <App
          oidcConfiguration={oidcConfiguration}
          identityManager={authenticatedSessionManager()}
          currentIdentityClient={identityClientWithPermissions(['academic:catalog:write'])}
        />
      </BrandingProvider>,
    )
    expect(await screen.findByText('Sesión institucional activa')).toBeVisible()

    // Act
    const primaryColor = screen.getByLabelText('Color HEX: Primario')
    await user.clear(primaryColor)
    await user.type(primaryColor, '#E0C037')

    // Assert
    expect(screen.getByRole('button', { name: 'Publicar cambios' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent(/permiso de escritura/i)
  })

  it('passes only backend period permissions to explicit open and close controls', async () => {
    // Arrange
    const user = userEvent.setup()
    const period: AcademicPeriod = {
      id: 'fb750786-79cc-49cf-9814-0f1047c76ba4',
      code: '2026-2',
      kind: 'REGULAR',
      academicYear: 2026,
      sequenceNumber: 2,
      startsOn: '2026-07-15',
      endsOn: '2026-12-18',
      status: 'APPROVED',
      calendarRevisionId: '7ecfa4a1-52f6-4b56-9b3c-8fc0cebdc98f',
      calendarRevisionNumber: 1,
      approvalReference: 'Synthetic approved calendar',
      officialReference: 'Synthetic academic period',
      createdAt: '2026-06-15T10:00:00Z',
    }
    const operations = emptyAcademicOperationsClient()
    const getAdminPeriods = vi.fn().mockResolvedValue([period])
    const openPeriod = vi.fn().mockResolvedValue({ ...period, status: 'OPEN' })
    operations.getAdminPeriods = getAdminPeriods
    operations.openPeriod = openPeriod
    window.history.replaceState(null, '', '#academia')
    render(
      <BrandingProvider loader={async () => DEFAULT_BRANDING}>
        <App
          catalogClient={emptyAcademicCatalogClient()}
          academicOperationsClient={operations}
          oidcConfiguration={oidcConfiguration}
          identityManager={authenticatedSessionManager()}
          currentIdentityClient={identityClientWithPermissions(['academic:period:read', 'academic:period:write'])}
        />
      </BrandingProvider>,
    )

    // Act
    await user.click(await screen.findByRole('button', { name: 'Abrir periodo 2026-2' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar apertura' }))

    // Assert
    expect(getAdminPeriods).toHaveBeenCalledWith('synthetic-access-token', expect.any(AbortSignal))
    expect(openPeriod).toHaveBeenCalledWith(period.id, 'synthetic-access-token')
  })

  it('keeps period controls suspended when a write gets 403 and /me still returns the same permission', async () => {
    // Arrange
    const user = userEvent.setup()
    const period: AcademicPeriod = {
      id: 'fb750786-79cc-49cf-9814-0f1047c76ba4',
      code: '2026-2',
      kind: 'REGULAR',
      academicYear: 2026,
      sequenceNumber: 2,
      startsOn: '2026-07-15',
      endsOn: '2026-12-18',
      status: 'APPROVED',
      calendarRevisionId: '7ecfa4a1-52f6-4b56-9b3c-8fc0cebdc98f',
      calendarRevisionNumber: 1,
      approvalReference: 'Synthetic approved calendar',
      officialReference: 'Synthetic academic period',
      createdAt: '2026-06-15T10:00:00Z',
    }
    const permissions: CurrentIdentity['permissions'] = ['academic:period:read', 'academic:period:write']
    const identityCurrent = vi.fn()
      .mockResolvedValueOnce({ userId: '7b717347-ae70-4a76-9a1d-01b9f178c0d2', subject: 'synthetic-subject', permissions })
      .mockResolvedValueOnce({ userId: '7b717347-ae70-4a76-9a1d-01b9f178c0d2', subject: 'synthetic-subject', permissions })
    const operations = emptyAcademicOperationsClient()
    operations.getAdminPeriods = vi.fn().mockResolvedValue([period])
    const openPeriod = vi.fn().mockRejectedValue(new AcademicOperationsApiError(403, 'Permission rejected'))
    operations.openPeriod = openPeriod
    window.history.replaceState(null, '', '#academia')
    render(
      <BrandingProvider loader={async () => DEFAULT_BRANDING}>
        <App
          catalogClient={emptyAcademicCatalogClient()}
          academicOperationsClient={operations}
          oidcConfiguration={oidcConfiguration}
          identityManager={authenticatedSessionManager()}
          currentIdentityClient={{ current: identityCurrent }}
        />
      </BrandingProvider>,
    )

    // Act
    await user.click(await screen.findByRole('button', { name: 'Abrir periodo 2026-2' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar apertura' }))

    // Assert: stale /me permission must not re-enable the rejected bearer.
    await waitFor(() => expect(identityCurrent).toHaveBeenCalledTimes(2))
    expect(openPeriod).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/permiso|sesión|servidor/i))
    expect(screen.queryByRole('button', { name: 'Abrir periodo 2026-2' })).not.toBeInTheDocument()

    // Act: navigating away and back must keep the token rejected for period writes.
    await user.click(within(screen.getByRole('navigation', { name: 'Principal' }))
      .getByRole('link', { name: 'Programas' }))
    await user.click(within(screen.getByRole('navigation', { name: 'Principal' }))
      .getByRole('link', { name: 'Estructura y periodos' }))

    // Assert
    expect(screen.queryByRole('button', { name: 'Abrir periodo 2026-2' })).not.toBeInTheDocument()
  })

  it('requires administrative read and write permissions for the audited order editor', async () => {
    // Arrange
    const user = userEvent.setup()
    const unitId = 'fae06170-9acf-4718-854e-92e945a7db17'
    const operations = emptyAcademicOperationsClient()
    operations.getStructure = vi.fn().mockResolvedValue({
      units: [{
        id: unitId,
        code: 'FAC-CIENCIAS',
        type: 'FACULTY',
        displayName: 'Facultad de Ciencias',
        displayOrder: 2,
        status: 'ACTIVE',
        validFrom: '2026-01-01',
        validThrough: null,
      }],
      organizationRelations: [],
      sites: [],
      siteRelations: [],
      programAffiliations: [],
    })
    operations.getAdminStructure = async (_accessToken) => operations.getStructure()
    const changeOrganizationUnitOrder = vi.fn().mockResolvedValue(undefined)
    operations.changeOrganizationUnitOrder = changeOrganizationUnitOrder
    window.history.replaceState(null, '', '#academia')
    render(
      <BrandingProvider loader={async () => DEFAULT_BRANDING}>
        <App
          catalogClient={emptyAcademicCatalogClient()}
          academicOperationsClient={operations}
          oidcConfiguration={oidcConfiguration}
          identityManager={authenticatedSessionManager()}
          currentIdentityClient={identityClientWithPermissions(['academic:structure:read', 'academic:structure:write'])}
        />
      </BrandingProvider>,
    )

    // Act: open an action after the identity grants both structure permissions.
    await user.click(await screen.findByRole('button', { name: 'Cambiar orden de Facultad de Ciencias' }))
    await user.clear(screen.getByLabelText('Nuevo orden de Facultad de Ciencias'))
    await user.type(screen.getByLabelText('Nuevo orden de Facultad de Ciencias'), '6')
    await user.type(screen.getByLabelText('Referencia institucional de Facultad de Ciencias'), 'Resolución 456')
    await user.click(screen.getByRole('button', { name: 'Guardar orden de Facultad de Ciencias' }))

    // Assert: structure ordering receives the resolved bearer within its own permission scope.
    expect(changeOrganizationUnitOrder).toHaveBeenCalledWith(
      unitId,
      { expectedDisplayOrder: 2, displayOrder: 6, sourceReference: 'Resolución 456' },
      'synthetic-access-token',
    )
    expect(screen.queryByRole('button', { name: /abrir periodo|cerrar periodo/i })).not.toBeInTheDocument()
  })

  it.each([
    { status: 401, revalidatedIdentity: new IdentityApiError(401), scenario: 'an expired token' },
    { status: 403, revalidatedIdentity: { userId: '7b717347-ae70-4a76-9a1d-01b9f178c0d2', subject: 'synthetic-subject', permissions: [] } satisfies CurrentIdentity,
      scenario: 'a removed permission' },
    { status: 403, revalidatedIdentity: { userId: '7b717347-ae70-4a76-9a1d-01b9f178c0d2', subject: 'synthetic-subject', permissions: ['academic:structure:write'] } satisfies CurrentIdentity,
      scenario: 'a stale permission response' },
  ])('revalidates identity and hides the order editor after a PATCH $status with $scenario', async ({ status, revalidatedIdentity }) => {
    // Arrange
    const user = userEvent.setup()
    const unitId = 'fae06170-9acf-4718-854e-92e945a7db17'
    const identityCurrent = vi.fn()
      .mockResolvedValueOnce({ userId: '7b717347-ae70-4a76-9a1d-01b9f178c0d2', subject: 'synthetic-subject', permissions: ['academic:structure:read', 'academic:structure:write'] })
      .mockImplementationOnce(() => revalidatedIdentity instanceof Error
        ? Promise.reject(revalidatedIdentity)
        : Promise.resolve(revalidatedIdentity))
    const operations = emptyAcademicOperationsClient()
    const getStructure = vi.fn().mockResolvedValue({
      units: [{
        id: unitId,
        code: 'FAC-CIENCIAS',
        type: 'FACULTY',
        displayName: 'Facultad de Ciencias',
        displayOrder: 2,
        status: 'ACTIVE',
        validFrom: '2026-01-01',
        validThrough: null,
      }],
      organizationRelations: [],
      sites: [],
      siteRelations: [],
      programAffiliations: [],
    })
    operations.getStructure = getStructure
    operations.getAdminStructure = async (_accessToken) => getStructure()
    operations.changeOrganizationUnitOrder = vi.fn().mockRejectedValue(
      new AcademicOperationsApiError(status, 'Authorization rejected'),
    )
    window.history.replaceState(null, '', '#academia')
    render(
      <BrandingProvider loader={async () => DEFAULT_BRANDING}>
        <App
          catalogClient={emptyAcademicCatalogClient()}
          academicOperationsClient={operations}
          oidcConfiguration={oidcConfiguration}
          identityManager={authenticatedSessionManager()}
          currentIdentityClient={{ current: identityCurrent }}
        />
      </BrandingProvider>,
    )

    // Act
    await user.click(await screen.findByRole('button', { name: 'Cambiar orden de Facultad de Ciencias' }))
    await user.clear(screen.getByLabelText('Nuevo orden de Facultad de Ciencias'))
    await user.type(screen.getByLabelText('Nuevo orden de Facultad de Ciencias'), '6')
    await user.type(screen.getByLabelText('Referencia institucional de Facultad de Ciencias'), 'Resolución 456')
    await user.click(screen.getByRole('button', { name: 'Guardar orden de Facultad de Ciencias' }))

    // Assert
    await waitFor(() => expect(identityCurrent).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByLabelText('Nuevo orden de Facultad de Ciencias')).not.toBeInTheDocument())
    expect(operations.changeOrganizationUnitOrder).toHaveBeenCalledOnce()

    // Act: return to the academic view after its page component has unmounted.
    await user.click(within(screen.getByRole('navigation', { name: 'Principal' }))
      .getByRole('link', { name: 'Programas' }))
    await user.click(within(screen.getByRole('navigation', { name: 'Principal' }))
      .getByRole('link', { name: 'Estructura y periodos' }))
    await waitFor(() => expect(getStructure.mock.calls.length).toBeGreaterThanOrEqual(3))

    // Assert: a denied token cannot regain its editor after route navigation.
    expect(screen.queryByRole('button', { name: 'Cambiar orden de Facultad de Ciencias' })).not.toBeInTheDocument()
  })
})

describe('Student services directory route', () => {
  it('opens the public directory from the application navigation', async () => {
    // Arrange
    const user = userEvent.setup()
    window.history.replaceState(null, '', '#inicio')
    render(
      <BrandingProvider loader={async () => DEFAULT_BRANDING}>
        <App />
      </BrandingProvider>,
    )

    // Act
    const servicesLink = await screen.findByRole('link', { name: /servicios estudiantiles/i })
    await user.click(servicesLink)

    // Assert
    expect(await screen.findByRole('heading', {
      name: 'Servicios para acompañar tu vida universitaria',
    })).toBeVisible()
    expect(servicesLink).toHaveAttribute('href', '#estudiantes')
    expect(servicesLink).toHaveAttribute('aria-current', 'page')
  })
})
