import { useEffect, useState } from 'react'
import type { BrandBanner, PublicBranding } from '../branding/contracts'
import type { ApplicationPermission } from '../identity/identityContracts'
import { UPTC_OFFICIAL_PAYMENT_GUIDANCE_URL } from '../../shared/officialUptcLinks'
import { WorkspaceLinkCard } from './WorkspaceLinkCard'
import type { WorkspaceLink } from './workspaceContracts'
import './WorkspaceHomePage.scss'

interface WorkspaceHomePageProps {
  branding: PublicBranding
  permissions: readonly ApplicationPermission[]
  isLocalPreview: boolean
  /** Deterministic clock seam for tests; production follows the wall clock. */
  now?: number
}

const ADMIN_LINKS: readonly (WorkspaceLink & { permissions: readonly ApplicationPermission[] })[] = [
  {
    href: '#inicio',
    title: 'Identidad visual',
    description: 'Ajusta la marca, los módulos y los banners institucionales.',
    eyebrow: 'Marca institucional',
    symbol: '✳',
    permissions: ['branding:read'],
  },
  {
    href: '#programas',
    title: 'Programas y currículos',
    description: 'Consulta el catálogo curricular y sus revisiones.',
    eyebrow: 'Catálogo académico',
    symbol: '▧',
    permissions: ['academic:catalog:read'],
  },
  {
    href: '#academia',
    title: 'Estructura, periodos y oferta',
    description: 'Consulta el árbol académico, el ciclo de periodos y borradores de oferta.',
    eyebrow: 'Operación académica',
    symbol: '◷',
    permissions: ['academic:structure:read', 'academic:period:read', 'academic:offerings:read'],
  },
  {
    href: '#admisiones',
    title: 'Gestión de convocatorias',
    description: 'Prepara y publica revisiones de calendarios de admisión.',
    eyebrow: 'Admisiones',
    symbol: '◇',
    permissions: ['admissions:calendar:read'],
  },
  {
    href: '#accesos',
    title: 'Accesos y perfiles',
    description: 'Consulta perfiles y asignaciones autorizadas.',
    eyebrow: 'Administración',
    symbol: '⌑',
    permissions: ['identity:roles:read'],
  },
]

export function WorkspaceHomePage({
  branding,
  permissions,
  isLocalPreview,
  now,
}: WorkspaceHomePageProps) {
  const [wallClock, setWallClock] = useState(() => Date.now())

  useEffect(() => {
    if (now !== undefined) return
    const interval = window.setInterval(() => setWallClock(Date.now()), 60_000)
    return () => window.clearInterval(interval)
  }, [now])

  const banner = findActiveHomeBanner(branding.banners, now ?? wallClock)
  const publicLinks = buildPublicLinks(branding)
  const adminLinks = buildAdminLinks(branding)
    .filter((link) => link.permissions.some((permission) => permissions.includes(permission)))

  return (
    <div className="workspace-home">
      <header className="workspace-home-hero">
        {banner && <img className="workspace-home-hero-image" src={`/assets/${banner.assetId}`} alt={banner.altText} />}
        <div className="workspace-home-hero-copy">
          <p className="workspace-home-eyebrow">PORTAL UNIVERSITARIO</p>
          <h1>{banner?.title ?? 'Tu universidad, en un mismo lugar'}</h1>
          <p>Encuentra tus servicios, explora la vida universitaria y continúa desde donde lo necesitas.</p>
        </div>
        <span className="workspace-home-hero-mark" aria-hidden="true">{branding.institutionName.slice(0, 1)}</span>
      </header>

      {import.meta.env.DEV && isLocalPreview && (
        <aside
          className="workspace-home-preview-notice"
          aria-label="Vista previa con datos sintéticos"
          aria-live="polite"
          aria-atomic="true"
        >
          <strong>Desarrollador local · preview</strong>
          <span>Esta sesión es de demostración y usa permisos de prueba. No representa un rol institucional.</span>
        </aside>
      )}

      <section className="workspace-home-section" aria-labelledby="workspace-home-public-title">
        <div className="workspace-home-section-heading">
          <div>
            <p className="workspace-home-eyebrow">VIDA UNIVERSITARIA</p>
            <h2 id="workspace-home-public-title">Explora la universidad</h2>
          </div>
          <span>Servicios y recursos</span>
        </div>
        <div className="workspace-home-grid">
          {publicLinks.map((link) => <WorkspaceLinkCard key={link.href} link={link} />)}
        </div>
      </section>

      {adminLinks.length > 0 && (
        <section className="workspace-home-section" aria-labelledby="workspace-home-admin-title">
          <div className="workspace-home-section-heading">
            <div>
              <p className="workspace-home-eyebrow">ACCESO POR CAPACIDAD</p>
              <h2 id="workspace-home-admin-title">Herramientas administrativas</h2>
            </div>
            <span>Según permisos efectivos</span>
          </div>
          <p className="workspace-home-section-intro">
            Estos accesos se muestran según los permisos confirmados por la plataforma. El servidor valida cada operación.
          </p>
          <div className="workspace-home-grid">
            {adminLinks.map((link) => <WorkspaceLinkCard key={link.href + link.title} link={link} />)}
          </div>
        </section>
      )}

    </div>
  )
}

function buildPublicLinks(branding: PublicBranding): WorkspaceLink[] {
  const programs = branding.modules.find((module) => module.key === 'programs')
  const links: WorkspaceLink[] = [{
    href: '#programas',
    title: `${programs?.label ?? 'Programas'} de pregrado`,
    description: 'Explora la oferta pública por programa, facultad, modalidad y lugar, con enlaces a las fichas UPTC.',
    eyebrow: 'UPTC · Oferta pública',
    symbol: '▧',
  }]
  const students = branding.modules.find((module) => module.key === 'students')
  links.push({
    href: '#estudiantes',
    title: `${students?.label ?? 'Estudiantes'} · Servicios académicos`,
    description: 'Encuentra las rutas oficiales para consultar horarios, calificaciones e inscripción de materias.',
    eyebrow: 'Canales oficiales UPTC',
    symbol: '◎',
  })
  links.push({
    href: UPTC_OFFICIAL_PAYMENT_GUIDANCE_URL,
    title: 'Pagos y recibos',
    description: 'Consulta la información oficial de recaudo. Universiry no recibe pagos ni datos bancarios.',
    eyebrow: 'Canal oficial UPTC',
    symbol: '$',
    openInNewTab: true,
  })
  const admissions = branding.modules.find((module) => module.key === 'admissions')
  if (admissions?.available && admissions.visible) {
    links.unshift({
      href: '#admisiones',
      title: admissions.label,
      description: 'Consulta fechas e información pública para aspirantes.',
      eyebrow: 'Información pública',
      symbol: '◇',
    })
  }
  const spaces = branding.modules.find((module) => module.key === 'spaces')
  if (spaces?.available && spaces.visible) {
    links.push({
      href: '#espacios',
      title: spaces.label,
      description: 'Encuentra ubicaciones y consulta las fuentes publicadas.',
      eyebrow: spaces.label,
      symbol: '⌖',
    })
  }
  return links
}

function buildAdminLinks(branding: PublicBranding): readonly (WorkspaceLink & { permissions: readonly ApplicationPermission[] })[] {
  const identityLabel = branding.modules.find((module) => module.key === 'visual-identity')?.label ?? 'Identidad visual'
  const programsLabel = branding.modules.find((module) => module.key === 'programs')?.label ?? 'Programas'
  const admissionsLabel = branding.modules.find((module) => module.key === 'admissions')?.label ?? 'convocatorias'
  return ADMIN_LINKS.map((link) => {
    if (link.href === '#inicio') return { ...link, title: identityLabel }
    if (link.href === '#programas') return { ...link, title: `${programsLabel} y currículos` }
    if (link.href === '#admisiones') return { ...link, title: `Gestionar ${admissionsLabel}` }
    return link
  })
}

function findActiveHomeBanner(banners: readonly BrandBanner[], now: number): BrandBanner | undefined {
  return banners
    .filter((banner) => banner.placement === 'home-hero')
    .filter((banner) => banner.startsAt === null || Date.parse(banner.startsAt) <= now)
    .filter((banner) => banner.endsAt === null || now < Date.parse(banner.endsAt))
    .sort((left, right) => left.order - right.order)[0]
}
