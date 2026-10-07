import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { academicCatalogClient } from './features/academics/academicCatalogClient'
import type { AcademicCatalogClient, AcademicCatalogPermission } from './features/academics/contracts'
import type {
  AcademicOperationsClient,
  AcademicPeriodAuthorization,
  AcademicStructureAuthorization,
} from './features/academics/academicOperationsContracts'
import type { AcademicOfferingAuthorization } from './features/academics/academicOfferingDraftContracts'
import { useBranding } from './features/branding/useBranding'
import type { SpaceGuideClient } from './features/spaces/spaceGuideClient'
import { roleAccessClient as defaultRoleAccessClient } from './features/access/roleAccessClient'
import type { RoleAccessClient, RoleScopeKind } from './features/access/roleAccessContracts'
import type { RoleAccessScopeOption } from './features/access/RoleAccessPage'
import { admissionsCallClient as defaultAdmissionsCallClient } from './features/admissions/admissionsCallClient'
import type { AdmissionsCalendarAuthorization, AdmissionsCallClient } from './features/admissions/admissionsCallContracts'
import { IdentityProvider } from './features/identity/IdentityProvider'
import type { IdentitySessionManager } from './features/identity/IdentityProvider'
import type { LocalPreviewSessionClient } from './features/identity/localPreviewSessionClient'
import { useIdentity } from './features/identity/identityContext'
import type { IdentityClient } from './features/identity/identityContracts'
import type { OidcConfigurationResult } from './features/identity/oidcConfiguration'
import { ThemeSelector } from './features/theme/ThemeSelector'
import type { MobileNavigationItem } from './features/navigation/MobileNavigation'
import './App.scss'

const WorkspaceHomePage = lazy(() =>
  import('./features/workspace/WorkspaceHomePage')
    .then(({ WorkspaceHomePage: page }) => ({ default: page })),
)
const AcademicCatalogPage = lazy(() =>
  import('./features/academics/AcademicCatalogPage')
    .then(({ AcademicCatalogPage: page }) => ({ default: page })),
)
const AcademicOperationsPage = lazy(() =>
  import('./features/academics/AcademicOperationsPage')
    .then(({ AcademicOperationsPage: page }) => ({ default: page })),
)
const AdmissionsExperience = lazy(() =>
  import('./features/admissions/AdmissionsExperience')
    .then(({ AdmissionsExperience: page }) => ({ default: page })),
)
const SpaceGuidePage = lazy(() =>
  import('./features/spaces/SpaceGuidePage')
    .then(({ SpaceGuidePage: page }) => ({ default: page })),
)
const StudentServicesPage = lazy(() =>
  import('./features/students/StudentServicesPage')
    .then(({ StudentServicesPage: page }) => ({ default: page })),
)
const LibraryAdminPage = lazy(() =>
  import('./features/library/LibraryAdminPage')
    .then(({ LibraryAdminPage: page }) => ({ default: page })),
)
const MyNoticesPage = lazy(() =>
  import('./features/notices/MyNoticesPage')
    .then(({ MyNoticesPage: page }) => ({ default: page })),
)
const InstitutionalNoticesAdminPage = lazy(() =>
  import('./features/notices/InstitutionalNoticesAdminPage')
    .then(({ InstitutionalNoticesAdminPage: page }) => ({ default: page })),
)
const VisualIdentityCenter = lazy(() =>
  import('./features/branding/VisualIdentityCenter')
    .then(({ VisualIdentityCenter: page }) => ({ default: page })),
)
const RoleAccessPage = lazy(() =>
  import('./features/access/RoleAccessPage')
    .then(({ RoleAccessPage: page }) => ({ default: page })),
)
const MobileNavigation = lazy(() =>
  import('./features/navigation/MobileNavigation')
    .then(({ MobileNavigation: navigation }) => ({ default: navigation })),
)
interface AppProps {
  catalogClient?: AcademicCatalogClient
  academicOperationsClient?: AcademicOperationsClient
  spaceGuideClient?: SpaceGuideClient
  oidcConfiguration?: OidcConfigurationResult
  identityManager?: IdentitySessionManager
  currentIdentityClient?: IdentityClient
  localPreviewSessionClient?: LocalPreviewSessionClient | null
  roleAccessClient?: RoleAccessClient
  admissionsCallClient?: AdmissionsCallClient
}

let academicOperationsClientPromise: Promise<AcademicOperationsClient> | null = null

function resolveAcademicOperationsClient(client?: AcademicOperationsClient): Promise<AcademicOperationsClient> {
  if (client) return Promise.resolve(client)
  academicOperationsClientPromise ??= import('./features/academics/academicOperationsClient')
    .then(({ academicOperationsClient: defaultClient }) => defaultClient)
    .catch((error: unknown) => {
      academicOperationsClientPromise = null
      throw error
    })
  return academicOperationsClientPromise
}

type ApplicationView = 'home' | 'identity' | 'programs' | 'academia' | 'admissions' | 'spaces' | 'access' | 'library' | 'notices' | 'notices-admin'
  | 'student-services'

const MODULE_SYMBOLS: Record<string, string> = {
  home: '⌂',
  students: '◎',
  programs: '▧',
  curricula: '▤',
  subjects: '◇',
  'academic-load': '◷',
  admissions: '◇',
  spaces: '⌖',
  'visual-identity': '✳',
}

export function App({
  catalogClient = academicCatalogClient,
  academicOperationsClient: operationsClient,
  spaceGuideClient: guideClient,
  oidcConfiguration,
  identityManager,
  currentIdentityClient,
  localPreviewSessionClient: providedLocalPreviewSessionClient,
  roleAccessClient = defaultRoleAccessClient,
  admissionsCallClient = defaultAdmissionsCallClient,
}: AppProps = {}) {
  const [loadedLocalPreviewSessionClient, setLoadedLocalPreviewSessionClient] = useState<LocalPreviewSessionClient | undefined>()
  useEffect(() => {
    if (providedLocalPreviewSessionClient !== undefined || !import.meta.env.DEV) return
    let active = true
    void import('./features/identity/localPreviewSessionClient')
      .then(({ localPreviewSessionClient: client }) => {
        if (active) setLoadedLocalPreviewSessionClient(client)
      })
      .catch(() => undefined)
    return () => { active = false }
  }, [providedLocalPreviewSessionClient])
  const localPreviewSessionClient = providedLocalPreviewSessionClient === undefined
    ? loadedLocalPreviewSessionClient
    : providedLocalPreviewSessionClient ?? undefined

  return (
    <IdentityProvider
      configuration={oidcConfiguration}
      manager={identityManager}
      identityClient={currentIdentityClient}
      localPreviewSessionClient={localPreviewSessionClient}
    >
      <ApplicationShell catalogClient={catalogClient} operationsClient={operationsClient}
        spaceGuideClient={guideClient} roleAccessClient={roleAccessClient} admissionsCallClient={admissionsCallClient} />
    </IdentityProvider>
  )
}

function ApplicationShell({
  catalogClient,
  operationsClient,
  spaceGuideClient,
  roleAccessClient,
  admissionsCallClient,
}: {
  catalogClient: AcademicCatalogClient
  operationsClient?: AcademicOperationsClient
  spaceGuideClient?: SpaceGuideClient
  roleAccessClient: RoleAccessClient
  admissionsCallClient: AdmissionsCallClient
}) {
  const { branding, status } = useBranding()
  const { state: identity, login, logout, retry, loginAvailable, localPreviewAvailable } = useIdentity()
  const localPreviewEnabled = import.meta.env.DEV && localPreviewAvailable
  const [view, setView] = useState<ApplicationView>(() => readApplicationView())
  const [rejectedStructureAccessToken, setRejectedStructureAccessToken] = useState<string | null>(null)
  const [rejectedPeriodAccessToken, setRejectedPeriodAccessToken] = useState<string | null>(null)
  const [rejectedOfferingAccessToken, setRejectedOfferingAccessToken] = useState<string | null>(null)
  const [rejectedRoleAccessToken, setRejectedRoleAccessToken] = useState<string | null>(null)
  const [rejectedAdmissionsAccessToken, setRejectedAdmissionsAccessToken] = useState<string | null>(null)
  const [rejectedLibraryAccessToken, setRejectedLibraryAccessToken] = useState<string | null>(null)
  useEffect(() => {
    const onHashChange = () => setView(readApplicationView())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Al cambiar de ruta el foco se queda en el enlace que se pulso, y el siguiente Tab sigue
  // recorriendo el menu: el contenido nuevo no llega a anunciarse. Se mueve al encabezado principal de
  // la pagina, que es lo que recomienda WAI-ARIA para navegacion de una sola pagina, y no al `main`
  // entero por dos razones concretas:
  //
  //  1. `main` mide miles de pixeles y arranca en y=0, debajo de la barra superior, asi que cualquier
  //     indicador en su borde superior queda tapado.
  //  2. `main` empieza por el aviso de sesion sintetica, de modo que un lector de pantalla anunciaba
  //     ese aviso en vez del titulo de la pagina a la que se acaba de entrar.
  //
  // Las vistas se cargan bajo demanda, asi que al cambiar de ruta el `h1` todavia no existe: React esta
  // resolviendo el chunk y `main` solo contiene el marcador de carga. Por eso se enfoca `main` de
  // inmediato —para no perder el foco— y en cuanto aparece el titulo se le pasa el foco a el.
  //
  // Solo al cambiar de vista, nunca en cada render, para no quitarle el foco a quien esta escribiendo.
  const mainRef = useRef<HTMLElement | null>(null)
  const firstView = useRef(true)
  useEffect(() => {
    if (firstView.current) {
      firstView.current = false
      return
    }
    const principal = mainRef.current
    if (!principal) return
    const enfocarTitulo = () => {
      const titulo = principal.querySelector('h1')
      if (!(titulo instanceof HTMLElement)) return false
      if (!titulo.hasAttribute('tabindex')) titulo.setAttribute('tabindex', '-1')
      titulo.focus()
      return true
    }
    if (!enfocarTitulo()) {
      principal.focus()
      const observador = new MutationObserver(() => {
        if (enfocarTitulo()) observador.disconnect()
      })
      observador.observe(principal, { childList: true, subtree: true })
      // Si la vista nunca trae un `h1`, el observador se retira solo para no quedar mirando el DOM.
      window.setTimeout(() => observador.disconnect(), 5000)
    }
    return () => undefined
  }, [view])

  const modules = branding.modules.filter((module) =>
    module.available
      && module.visible
      && !['home', 'visual-identity', 'programs', 'admissions', 'spaces', 'students'].includes(module.key))
  const identityModule = branding.modules.find((module) => module.key === 'visual-identity')
  const programsModule = branding.modules.find((module) => module.key === 'programs')
  const admissionsModule = branding.modules.find((module) => module.key === 'admissions')
  const spacesModule = branding.modules.find((module) => module.key === 'spaces')
  const studentsModule = branding.modules.find((module) => module.key === 'students')
  const institutionLogo = branding.assets.logoDark
    ? `/assets/${branding.assets.logoDark}`
    : null
  const identityLabel = identityModule?.label ?? 'Identidad visual'
  const programsLabel = programsModule?.label ?? 'Programas'
  const admissionsLabel = admissionsModule?.label ?? 'Admisiones'
  const spacesLabel = spacesModule?.label ?? 'Guía de espacios'
  const studentServicesLabel = studentsModule?.label && studentsModule.label !== 'Estudiantes'
    ? `Servicios · ${studentsModule.label}`
    : 'Servicios estudiantiles'
  const isProgramsView = view === 'programs'
  const isAcademicOperationsView = view === 'academia'
  const isAdmissionsView = view === 'admissions'
  const isSpacesView = view === 'spaces'
  const isStudentServicesView = view === 'student-services'
  const isHomeView = view === 'home'
  const isRoleAccessView = view === 'access'
  const isLibraryView = view === 'library'
  const isNoticesView = view === 'notices'
  const isNoticesAdminView = view === 'notices-admin'
  const isIdentityView = view === 'identity'
  const mainContentId = isHomeView ? 'resumen'
    : isStudentServicesView ? 'estudiantes'
      : isLibraryView ? 'biblioteca'
        : isNoticesView ? 'avisos'
          : isNoticesAdminView ? 'avisos-admin'
            : isIdentityView ? 'inicio'
              : isProgramsView ? 'programas'
                : isAdmissionsView ? 'admisiones'
                  : isSpacesView ? 'espacios'
                    : isRoleAccessView ? 'accesos'
                      : 'academia'
  const authenticatedIdentity = identity.status === 'authenticated' ? identity : null
  const hasAuthenticatedSession = authenticatedIdentity !== null
  const isLocalPreviewSession = import.meta.env.DEV && authenticatedIdentity?.sessionType === 'local-preview'
  const canEndSession = hasAuthenticatedSession || (identity.status === 'error' && loginAvailable)
  const catalogAuthorization = authenticatedIdentity
    ? {
      accessToken: authenticatedIdentity.accessToken,
      permissions: authenticatedIdentity.permissions.filter(isAcademicCatalogPermission),
    }
    : null
  const periodAuthorization: AcademicPeriodAuthorization | null = authenticatedIdentity
    ? {
      accessToken: authenticatedIdentity.accessToken,
      canRead: authenticatedIdentity.permissions.includes('academic:period:read')
        && authenticatedIdentity.accessToken !== rejectedPeriodAccessToken,
      canWrite: authenticatedIdentity.permissions.includes('academic:period:write')
        && authenticatedIdentity.accessToken !== rejectedPeriodAccessToken,
    }
    : null
  const structureAuthorization: AcademicStructureAuthorization | null = authenticatedIdentity
    ? {
      accessToken: authenticatedIdentity.accessToken,
      canRead: authenticatedIdentity.permissions.includes('academic:structure:read')
        && authenticatedIdentity.accessToken !== rejectedStructureAccessToken,
      canWrite: authenticatedIdentity.permissions.includes('academic:structure:write')
        && authenticatedIdentity.accessToken !== rejectedStructureAccessToken,
    }
    : null
  const offeringAuthorization: AcademicOfferingAuthorization | null = authenticatedIdentity
    ? {
      accessToken: authenticatedIdentity.accessToken,
      canRead: authenticatedIdentity.permissions.includes('academic:offerings:read')
        && authenticatedIdentity.accessToken !== rejectedOfferingAccessToken,
      canWrite: authenticatedIdentity.permissions.includes('academic:offerings:write')
        && authenticatedIdentity.accessToken !== rejectedOfferingAccessToken,
    }
    : null
  const roleAccessAuthorization = authenticatedIdentity
    ? {
      accessToken: authenticatedIdentity.accessToken,
      canRead: authenticatedIdentity.permissions.includes('identity:roles:read')
        && authenticatedIdentity.accessToken !== rejectedRoleAccessToken,
      canWrite: authenticatedIdentity.permissions.includes('identity:roles:write')
        && authenticatedIdentity.accessToken !== rejectedRoleAccessToken,
    }
    : null
  const admissionsAuthorization: AdmissionsCalendarAuthorization | null = authenticatedIdentity
    ? {
      accessToken: authenticatedIdentity.accessToken,
      canRead: authenticatedIdentity.permissions.includes('admissions:calendar:read')
        && authenticatedIdentity.accessToken !== rejectedAdmissionsAccessToken,
      canWrite: authenticatedIdentity.permissions.includes('admissions:calendar:write')
        && authenticatedIdentity.accessToken !== rejectedAdmissionsAccessToken,
    }
    : null
  const noticesAuthorization = authenticatedIdentity
    ? {
      accessToken: authenticatedIdentity.accessToken,
      canRead: authenticatedIdentity.permissions.includes('notices:read'),
      canWrite: authenticatedIdentity.permissions.includes('notices:write'),
    }
    : null
  const libraryAuthorization = authenticatedIdentity    ? {
      accessToken: authenticatedIdentity.accessToken,
      canRead: authenticatedIdentity.permissions.includes('library:read')
        && authenticatedIdentity.accessToken !== rejectedLibraryAccessToken,
      canWrite: authenticatedIdentity.permissions.includes('library:write')
        && authenticatedIdentity.accessToken !== rejectedLibraryAccessToken,
    }
    : null
  const mobileNavigationItems: MobileNavigationItem[] = [
    { href: '#resumen', label: 'Resumen', symbol: MODULE_SYMBOLS.home, primary: true },
    { href: '#programas', label: programsLabel, symbol: MODULE_SYMBOLS.programs, primary: true },
    { href: '#inicio', label: identityLabel, symbol: MODULE_SYMBOLS['visual-identity'] },
    ...(roleAccessAuthorization?.canRead
      ? [{ href: '#accesos', label: 'Accesos y perfiles', symbol: '⌑' }]
      : []),
    ...(admissionsModule?.available && admissionsModule.visible
      ? [{ href: '#admisiones', label: admissionsLabel, symbol: MODULE_SYMBOLS.admissions }]
      : []),
    ...(spacesModule?.available && spacesModule.visible
      ? [{ href: '#espacios', label: spacesLabel, symbol: MODULE_SYMBOLS.spaces }]
      : []),
    { href: '#estudiantes', label: studentServicesLabel, symbol: MODULE_SYMBOLS.students },
    ...(libraryAuthorization?.canRead
      ? [{ href: '#biblioteca', label: 'Biblioteca', symbol: '▤' }]
      : []),
    ...(hasAuthenticatedSession
      ? [{ href: '#avisos', label: 'Mis avisos', symbol: '✉' }]
      : []),
    ...(noticesAuthorization?.canRead
      ? [{ href: '#avisos-admin', label: 'Administrar avisos', symbol: '✎' }]
      : []),
    { href: '#academia', label: 'Estructura académica', symbol: MODULE_SYMBOLS['academic-load'] },
  ]
  const revalidateRejectedStructureAccess = useCallback(async (accessToken: string): Promise<void> => {
    setRejectedStructureAccessToken(accessToken)
    await retry()
  }, [retry])
  const revalidateRejectedPeriodAccess = useCallback(async (accessToken: string): Promise<void> => {
    setRejectedPeriodAccessToken(accessToken)
    await retry()
  }, [retry])
  const revalidateRejectedOfferingAccess = useCallback(async (accessToken: string): Promise<void> => {
    setRejectedOfferingAccessToken(accessToken)
    await retry()
  }, [retry])
  const revalidateRejectedRoleAccess = useCallback(async (accessToken: string): Promise<void> => {
    setRejectedRoleAccessToken(accessToken)
    await retry()
  }, [retry])
  const revalidateRejectedAdmissionsAccess = useCallback(async (accessToken: string): Promise<void> => {
    setRejectedAdmissionsAccessToken(accessToken)
    await retry()
  }, [retry])
  const revalidateRejectedLibraryAccess = useCallback(async (accessToken: string): Promise<void> => {
    setRejectedLibraryAccessToken(accessToken)
    await retry()
  }, [retry])
  const loadRoleScopeOptions = useCallback(async (
    kind: RoleScopeKind,
    signal?: AbortSignal,
  ): Promise<RoleAccessScopeOption[]> => {
    if (kind === 'SITE' || kind === 'FACULTY') {
      const structureClient = await resolveAcademicOperationsClient(operationsClient)
      const structure = await structureClient.getStructure(signal)
      if (kind === 'SITE') {
        return structure.sites
          .filter((site) => site.status === 'ACTIVE')
          .sort((left, right) => left.displayName.localeCompare(right.displayName, 'es'))
          .map((site) => ({ reference: site.id, label: `${site.code} · ${site.displayName}` }))
      }
      return structure.units
        .filter((unit) => unit.type === 'FACULTY' && unit.status === 'ACTIVE')
        .sort((left, right) => left.displayName.localeCompare(right.displayName, 'es'))
        .map((unit) => ({ reference: unit.id, label: `${unit.code} · ${unit.displayName}` }))
    }
    if (kind === 'PROGRAM') {
      const programs = await catalogClient.listPrograms(signal)
      return programs
        .sort((left, right) => left.programName.localeCompare(right.programName, 'es'))
        .map((program) => ({ reference: program.id, label: `${program.programCode} · ${program.programName}` }))
    }
    return []
  }, [catalogClient, operationsClient])
  const sessionLabel = isLocalPreviewSession ? 'Desarrollador local · preview activo'
    : identity.status === 'authenticated' ? 'Sesión institucional activa'
    : identity.status === 'loading' ? 'Verificando sesión…'
      : identity.status === 'unconfigured' ? 'Acceso institucional pendiente de configuración'
        : identity.status === 'error' ? identity.message
          : identity.reason === 'expired' ? 'Sesión vencida · Sin acceso'
            : 'Sin sesión institucional'
  const identityCenterKey = `${branding.revision}:${authenticatedIdentity?.subject ?? 'anonymous'}`
  const currentPageLabel = isHomeView ? 'Resumen'
    : isRoleAccessView ? 'Accesos y perfiles'
    : isLibraryView ? 'Biblioteca'
    : isNoticesView ? 'Mis avisos'
    : isNoticesAdminView ? 'Administrar avisos'
    : isStudentServicesView ? studentServicesLabel
    : isAdmissionsView ? admissionsLabel
    : isSpacesView ? spacesLabel
    : isProgramsView ? programsLabel
    : isAcademicOperationsView ? 'Estructura y periodos'
      : identityLabel

  return (
    <div className="platform-shell">
      <aside className="sidebar" aria-label="Navegación del sistema">
        <a
          className="nav-item active skip-link"
          href={`#${mainContentId}`}
          onClick={() => document.getElementById(mainContentId)?.focus()}
        >
          Saltar al contenido principal
        </a>
        <a className="brand-lockup" href="#resumen" aria-label={`${branding.institutionName}, inicio`}>
          {institutionLogo
            ? <img className="brand-lockup-logo" src={institutionLogo} alt="" />
            : <span className="brand-monogram" aria-hidden="true">U</span>}
          <span className="brand-lockup-copy">
            <strong>{branding.institutionName}</strong>
            <small>PLATAFORMA UNIVERSITARIA</small>
          </span>
        </a>

        <div className="sidebar-group">
          <p className="sidebar-caption">ESPACIO DE TRABAJO</p>
          <nav className="primary-nav" aria-label="Principal">
            <a className={`nav-item${isHomeView ? ' active' : ''}`} href="#resumen" aria-current={isHomeView ? 'page' : undefined}>
              <span className="nav-glyph" aria-hidden="true">⌂</span>
              <span>Resumen</span>
              {isHomeView && <span className="nav-status" aria-hidden="true" />}
            </a>
            <a className={`nav-item${isIdentityView ? ' active' : ''}`} href="#inicio" aria-current={isIdentityView ? 'page' : undefined}>
              <span className="nav-glyph" aria-hidden="true">✳</span>
              <span>{identityLabel}</span>
              {isIdentityView && <span className="nav-status" aria-hidden="true" />}
            </a>
            {roleAccessAuthorization?.canRead && (
              <a className={`nav-item${isRoleAccessView ? ' active' : ''}`} href="#accesos"
                aria-current={isRoleAccessView ? 'page' : undefined}>
                <span className="nav-glyph" aria-hidden="true">⌑</span>
                <span>Accesos y perfiles</span>
                {isRoleAccessView && <span className="nav-status" aria-hidden="true" />}
              </a>
            )}
            <a className={`nav-item${isProgramsView ? ' active' : ''}`} href="#programas" aria-current={isProgramsView ? 'page' : undefined}>
              <span className="nav-glyph" aria-hidden="true">▧</span>
              <span>{programsLabel}</span>
              {isProgramsView && <span className="nav-status" aria-hidden="true" />}
            </a>
            {admissionsModule?.available && admissionsModule.visible && (
              <a className={`nav-item${isAdmissionsView ? ' active' : ''}`} href="#admisiones" aria-current={isAdmissionsView ? 'page' : undefined}>
                <span className="nav-glyph" aria-hidden="true">{MODULE_SYMBOLS.admissions}</span>
                <span>{admissionsLabel} · Información pública</span>
                {isAdmissionsView && <span className="nav-status" aria-hidden="true" />}
              </a>
            )}
            {spacesModule?.available && spacesModule.visible && (
              <a className={`nav-item${isSpacesView ? ' active' : ''}`} href="#espacios" aria-current={isSpacesView ? 'page' : undefined}>
                <span className="nav-glyph" aria-hidden="true">{MODULE_SYMBOLS.spaces}</span>
              <span>{spacesLabel}</span>
                {isSpacesView && <span className="nav-status" aria-hidden="true" />}
              </a>
            )}
            <a className={`nav-item${isStudentServicesView ? ' active' : ''}`} href="#estudiantes"
              aria-current={isStudentServicesView ? 'page' : undefined}>
              <span className="nav-glyph" aria-hidden="true">{MODULE_SYMBOLS.students}</span>
              <span>{studentServicesLabel}</span>
              {isStudentServicesView && <span className="nav-status" aria-hidden="true" />}
            </a>
            <a className={`nav-item${isAcademicOperationsView ? ' active' : ''}`} href="#academia" aria-current={isAcademicOperationsView ? 'page' : undefined}>
              <span className="nav-glyph" aria-hidden="true">◷</span>
              <span>Estructura y periodos</span>
              {isAcademicOperationsView && <span className="nav-status" aria-hidden="true" />}
            </a>
            {libraryAuthorization?.canRead && (
              <a className={`nav-item${isLibraryView ? ' active' : ''}`} href="#biblioteca"
                aria-current={isLibraryView ? 'page' : undefined}>
                <span className="nav-glyph" aria-hidden="true">▤</span>
                <span>Biblioteca · Catálogo y circulación</span>
                {isLibraryView && <span className="nav-status" aria-hidden="true" />}
              </a>
            )}
            {hasAuthenticatedSession && (
              <a className={`nav-item${isNoticesView ? ' active' : ''}`} href="#avisos"
                aria-current={isNoticesView ? 'page' : undefined}>
                <span className="nav-glyph" aria-hidden="true">✉</span>
                <span>Mis avisos</span>
                {isNoticesView && <span className="nav-status" aria-hidden="true" />}
              </a>
            )}
            {noticesAuthorization?.canRead && (
              <a className={`nav-item${isNoticesAdminView ? ' active' : ''}`} href="#avisos-admin"
                aria-current={isNoticesAdminView ? 'page' : undefined}>
                <span className="nav-glyph" aria-hidden="true">✎</span>
                <span>Administrar avisos</span>
                {isNoticesAdminView && <span className="nav-status" aria-hidden="true" />}
              </a>
            )}
          </nav>
        </div>

        {modules.length > 0 && (
          <div className="sidebar-group module-nav-group">
            <p className="sidebar-caption">VIDA UNIVERSITARIA</p>
            <nav className="primary-nav" aria-label="Módulos universitarios">
              {modules.map((module) => (
                <button className="nav-item subdued" type="button" key={module.key}>
                  <span className="nav-glyph" aria-hidden="true">{MODULE_SYMBOLS[module.key] ?? '◦'}</span>
                  <span>{module.label}</span>
                </button>
              ))}
            </nav>
          </div>
        )}

        <div className="sidebar-footer">
          <span className="environment-indicator" aria-hidden="true" />
          <span><strong>Entorno de desarrollo</strong><small>Sin datos estudiantiles reales</small></span>
        </div>
        <Suspense fallback={null}>
          <MobileNavigation items={mobileNavigationItems} currentHash={window.location.hash || '#resumen'} />
        </Suspense>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumbs"><span>{isHomeView ? 'Portal universitario' : isProgramsView || isAcademicOperationsView || isAdmissionsView || isSpacesView || isStudentServicesView || isLibraryView || isNoticesView || isNoticesAdminView ? 'Vida universitaria' : 'Administración'}</span><span aria-hidden="true">/</span><strong>{currentPageLabel}</strong></div>
          <div className="topbar-meta">
            <span className="autosave-indicator"><span aria-hidden="true" />{isHomeView ? 'Inicio institucional' : isNoticesAdminView ? 'Administración de avisos' : isNoticesView ? 'Avisos institucionales' : isLibraryView ? 'Servicios bibliográficos' : isStudentServicesView ? 'Directorio público' : isRoleAccessView ? 'Control administrativo' : isAdmissionsView ? 'Consulta de admisiones' : isSpacesView ? 'Consulta de espacios' : isProgramsView ? 'Consulta de programas' : isAcademicOperationsView ? 'Consulta académica' : status === 'ready' ? 'Identidad sincronizada' : 'Identidad de respaldo'}</span>
            <span className="topbar-divider" aria-hidden="true" />
            {isHomeView
              ? <span className="revision-chip">PORTAL UNIVERSITARIO</span>
              : isNoticesAdminView
              ? <span className="revision-chip">AVISOS · ADMINISTRACIÓN</span>
              : isNoticesView
              ? <span className="revision-chip">AVISOS · COMUNIDAD</span>
              : isLibraryView
              ? <span className="revision-chip">BIBLIOTECA · CATÁLOGO</span>
              : isRoleAccessView
              ? <span className="revision-chip">PERFILES · IDENTIDAD</span>
              : isAdmissionsView
              ? <span className="revision-chip">ADMISIONES · PREGRADO</span>
              : isSpacesView
                ? <span className="revision-chip">SEDES · CREAD</span>
              : isProgramsView
              ? <span className="revision-chip">PREGRADO · PRESENCIAL</span>
              : isAcademicOperationsView
                ? <span className="revision-chip">ESTRUCTURA · PERIODOS</span>
                : <span className="revision-chip">REV. {branding.revision.toString().padStart(2, '0')}</span>}
            <ThemeSelector />
            <div className="identity-session-controls" aria-label={isLocalPreviewSession ? 'Sesión de desarrollador local' : 'Sesión institucional'}>
              <span className={`identity-session-status is-${identity.status}`}
                role={identity.status === 'error' ? 'status' : undefined}
                aria-live="polite">
                {sessionLabel}
              </span>
              {identity.status === 'error' && (
                <button className="identity-session-button secondary" type="button" onClick={() => void retry()}>
                  Reintentar
                </button>
              )}
              <button
                className="identity-session-button"
                type="button"
                disabled={!loginAvailable || identity.status === 'loading'}
                onClick={() => void (canEndSession ? logout() : login())}
                title={!loginAvailable
                  ? 'El inicio de sesión requiere configuración institucional aprobada'
                  : localPreviewEnabled ? 'Sesión local temporal para revisar datos sintéticos' : undefined}
              >
                {isLocalPreviewSession
                  ? 'Salir del preview local'
                  : canEndSession ? 'Cerrar sesión' : localPreviewEnabled ? 'Entrar al preview local' : 'Iniciar sesión'}
              </button>
            </div>
          </div>
        </header>

        {isLocalPreviewSession && !isHomeView && (
          <aside
            className="local-preview-session-banner"
            aria-label="Sesión de preview local"
            aria-live="polite"
            aria-atomic="true"
          >
            <strong>Desarrollador local · modo preview</strong>
            <span>Permisos de demostración en este entorno; usa únicamente datos sintéticos. Esta sesión no es institucional.</span>
          </aside>
        )}

        <main id={mainContentId} tabIndex={-1} ref={mainRef}
          className={isHomeView ? 'workspace-home-page-content' : isStudentServicesView ? 'student-services-page-content' : isLibraryView ? 'library-page-content' : isNoticesView ? 'my-notices-page-content' : isNoticesAdminView ? 'notices-admin-page-content' : isRoleAccessView ? 'role-access-page-content' : isAdmissionsView ? 'admissions-page-content' : isSpacesView ? 'spaces-page-content' : isProgramsView ? 'catalog-page-content' : isAcademicOperationsView ? 'academic-page-content' : 'page-content identity-page-content'}>
          {isIdentityView && status === 'fallback' && (
            <div className="status-banner" role="status">
              <span className="status-banner-icon" aria-hidden="true">i</span>
              <span><strong>Mostrando identidad oficial de respaldo.</strong> El servicio de configuración pública no está disponible por ahora.</span>
            </div>
          )}
          {isIdentityView && status === 'loading' && <p className="sr-only" role="status">Cargando identidad institucional…</p>}

          <ModuleLoadBoundary
            key={view}
            fallback={<ModuleLoadFailure label={isHomeView
              ? 'la portada del portal'
              : isStudentServicesView
                ? 'el directorio de servicios estudiantiles'
              : isLibraryView
                ? 'el catálogo de biblioteca'
              : isNoticesView
                ? 'tus avisos institucionales'
              : isNoticesAdminView
                ? 'la administración de avisos'
              : isAdmissionsView
              ? 'la agenda de admisiones'
              : isSpacesView
                ? 'la guía de espacios'
                : isRoleAccessView
                  ? 'la consola de accesos'
              : isProgramsView || isAcademicOperationsView
                ? 'el módulo académico'
                : 'el centro de identidad visual'} />}
          >
            <Suspense fallback={<p
              className={isProgramsView || isAcademicOperationsView ? 'module-loading module-loading-tall' : 'module-loading'}
              role="status"
              aria-live="polite"
            >
              Cargando {isHomeView ? 'portada del portal' : isNoticesAdminView ? 'la administración de avisos' : isNoticesView ? 'tus avisos institucionales' : isStudentServicesView ? 'directorio de servicios estudiantiles' : isLibraryView ? 'catálogo de biblioteca' : isRoleAccessView ? 'consola de accesos' : isAdmissionsView ? 'agenda de admisiones' : isSpacesView ? 'guía de espacios' : isProgramsView || isAcademicOperationsView ? 'módulo académico' : 'centro de identidad visual'}…
            </p>}>
              {isHomeView
                ? <WorkspaceHomePage branding={branding} permissions={authenticatedIdentity?.permissions ?? []}
                  isLocalPreview={isLocalPreviewSession} />
                : isStudentServicesView
                  ? <StudentServicesPage />
                : isRoleAccessView
                ? <RoleAccessPage client={roleAccessClient} authorization={roleAccessAuthorization}
                  loadScopeOptions={loadRoleScopeOptions} onAuthorizationRejected={revalidateRejectedRoleAccess} />
                : isProgramsView
                ? <AcademicCatalogPage client={catalogClient} authorization={catalogAuthorization} />
                : isAcademicOperationsView
                  ? <AcademicOperationsPage
                    client={operationsClient}
                    loadPrograms={catalogClient.listPrograms}
                    authorization={periodAuthorization}
                    structureAuthorization={structureAuthorization}
                    offeringAuthorization={offeringAuthorization}
                    onStructureAuthorizationRejected={revalidateRejectedStructureAccess}
                    onPeriodAuthorizationRejected={revalidateRejectedPeriodAccess}
                    onOfferingAuthorizationRejected={revalidateRejectedOfferingAccess}
                  />
                  : isAdmissionsView
                    ? <AdmissionsExperience client={admissionsCallClient} authorization={admissionsAuthorization}
                      onAuthorizationRejected={revalidateRejectedAdmissionsAccess} />
                    : isSpacesView
                      ? <SpaceGuidePage {...(spaceGuideClient ? { client: spaceGuideClient } : {})} />
                    : isLibraryView
                      ? <LibraryAdminPage
                        authorization={libraryAuthorization}
                        onAuthorizationRejected={revalidateRejectedLibraryAccess}
                      />
                    : isNoticesView
                      ? <MyNoticesPage accessToken={authenticatedIdentity?.accessToken ?? null} />
                    : isNoticesAdminView
                      ? <InstitutionalNoticesAdminPage authorization={noticesAuthorization} />
                    : <VisualIdentityCenter
                    key={identityCenterKey}
                    accessToken={authenticatedIdentity?.accessToken ?? null}
                    permissions={authenticatedIdentity?.permissions ?? []}
                    initialConfiguration={branding}
                  />}
            </Suspense>
          </ModuleLoadBoundary>

          <footer className="page-footer"><span>{branding.institutionName}</span><span>{isHomeView
            ? 'Portada institucional · accesos administrativos según permisos efectivos'
            : isNoticesAdminView
            ? noticesAuthorization?.canWrite
              ? 'Publicación con referencia institucional · El aviso publicado no se edita'
              : 'Consulta de avisos · Publicar requiere autorización institucional'
            : isNoticesView
            ? 'Avisos según tus ámbitos vigentes · Solo lectura'
            : isLibraryView
            ? libraryAuthorization?.canWrite
              ? 'Catálogo y circulación · Referencia institucional exigida en cada operación'
              : 'Consulta del catálogo · Sin permiso de escritura'
            : isRoleAccessView
            ? roleAccessAuthorization?.canWrite
              ? 'Gestión de perfiles · permisos asignados y auditados en el servidor'
              : 'Consulta de perfiles · escritura requiere autorización institucional'
            : isStudentServicesView
              ? 'Fuentes públicas UPTC · Sin credenciales ni trámites'
            : isAdmissionsView
            ? admissionsAuthorization?.canRead && admissionsAuthorization.canWrite
              ? 'Calendario versionado · Publicación protegida y auditada'
              : 'Calendario público de admisiones · Información de referencia UPTC'
            : isSpacesView
              ? 'Guía pública de ubicaciones · Consulta la fuente oficial antes de desplazarte'
            : isProgramsView
            ? 'Directorio público de programas de pregrado · Fuente UPTC'
          : isAcademicOperationsView
              ? periodAuthorization?.canWrite
                ? 'Control del estado del periodo · Oferta y matrícula independientes'
                : 'Vista de consulta · Apertura y cierre requieren permiso institucional'
              : `Configuración pública · Rev. ${branding.revision}`}</span></footer>
        </main>
      </div>
    </div>
  )
}

export default App

function readApplicationView(): ApplicationView {
  if (typeof window === 'undefined') return 'home'
  if (window.location.hash === '#resumen') return 'home'
  if (window.location.hash === '#inicio') return 'identity'
  if (window.location.hash === '#estudiantes') return 'student-services'
  if (window.location.hash === '#biblioteca') return 'library'
  if (window.location.hash === '#avisos') return 'notices'
  if (window.location.hash === '#avisos-admin') return 'notices-admin'
  if (window.location.hash === '#programas') return 'programs'
  if (window.location.hash === '#academia') return 'academia'
  if (window.location.hash === '#admisiones') return 'admissions'
  if (window.location.hash === '#espacios') return 'spaces'
  if (window.location.hash === '#accesos') return 'access'
  return 'home'
}

function isAcademicCatalogPermission(permission: string): permission is AcademicCatalogPermission {
  return permission === 'academic:catalog:read' || permission === 'academic:catalog:write'
}

class ModuleLoadBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}

function ModuleLoadFailure({ label }: { label: string }) {
  return (
    <div className="module-load-failure" role="alert">
      <p>No se pudo cargar {label}.</p>
      <button className="module-load-retry" type="button" onClick={() => window.location.reload()}>
        Recargar pantalla
      </button>
    </div>
  )
}
