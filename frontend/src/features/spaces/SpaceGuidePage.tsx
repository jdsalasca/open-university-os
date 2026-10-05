import { useEffect, useMemo, useState } from 'react'
import type {
  SpaceAnnouncement,
  SpaceDirectorySnapshot,
  SpaceLocation,
  SpaceLocationKind,
  SpaceUseKind,
  SpaceUsePathway,
} from './spaceGuideContracts'
import { spaceGuideClient as defaultSpaceGuideClient } from './spaceGuideClient'
import type { SpaceGuideClient } from './spaceGuideClient'
import './SpaceGuidePage.scss'

interface SpaceGuidePageProps {
  client?: SpaceGuideClient
}

type LoadState =
  | { status: 'loading'; attempt: number }
  | { status: 'error'; attempt: number }
  | { status: 'ready'; attempt: number; snapshot: SpaceDirectorySnapshot }

const TYPE_LABELS: Record<SpaceLocationKind, string> = {
  CAMPUS: 'Sede universitaria',
  REGIONAL_SITE: 'Sede regional',
  CREAD: 'CREAD',
  SERVICE: 'Servicio universitario',
}

const TYPE_FILTER_LABELS: Record<SpaceLocationKind, string> = {
  CAMPUS: 'Sedes universitarias',
  REGIONAL_SITE: 'Sedes regionales',
  CREAD: 'CREAD',
  SERVICE: 'Servicios',
}

const USE_KIND_LABELS: Record<SpaceUseKind, string> = {
  AUDITORIUM_OR_ACADEMIC_SPACE: 'Préstamo o alquiler',
  SPORTS_VENUE: 'Escenarios deportivos',
  LIBRARY_ROOM: 'Espacios de biblioteca',
  COMPUTER_CLASSROOM: 'Asignación académica',
  INTERNAL_STAFF_SPACE: 'Uso interno',
}

export function SpaceGuidePage({ client = defaultSpaceGuideClient }: SpaceGuidePageProps) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<LoadState>({ status: 'loading', attempt: 0 })
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState<SpaceLocationKind | 'ALL'>('ALL')
  const [municipality, setMunicipality] = useState('ALL')
  const visibleState = useMemo(
    () => (state.attempt === attempt ? state : { status: 'loading' as const, attempt }),
    [attempt, state],
  )

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    client.listSpaces(controller.signal).then((snapshot) => {
      if (!active) return
      const availableMunicipalities = new Set(
        snapshot.locations.map((location) => normalizeForSearch(location.municipality)),
      )
      setMunicipality((current) => current === 'ALL'
        || availableMunicipalities.has(normalizeForSearch(current)) ? current : 'ALL')
      setState({ status: 'ready', attempt, snapshot })
    }).catch(() => {
      if (active && !controller.signal.aborted) setState({ status: 'error', attempt })
    })
    return () => {
      active = false
      controller.abort()
    }
  }, [attempt, client])

  const municipalityOptions = useMemo(() => {
    if (visibleState.status !== 'ready') return []
    const municipalities = new Map<string, string>()
    for (const location of visibleState.snapshot.locations) {
      const label = location.municipality.trim()
      const normalized = normalizeForSearch(label)
      if (normalized && !municipalities.has(normalized)) municipalities.set(normalized, label)
    }
    return [...municipalities.values()].sort((left, right) => left.localeCompare(right, 'es-CO', { sensitivity: 'base' }))
  }, [visibleState])

  const visibleLocations = useMemo(() => {
    if (visibleState.status !== 'ready') return []
    const normalizedSearch = normalizeForSearch(search.trim())
    return visibleState.snapshot.locations.filter((location) => {
      if (kind !== 'ALL' && location.kind !== kind) return false
      if (municipality !== 'ALL'
        && normalizeForSearch(location.municipality) !== normalizeForSearch(municipality)) return false
      if (!normalizedSearch) return true
      return normalizeForSearch(searchableText(location)).includes(normalizedSearch)
    })
  }, [kind, municipality, search, visibleState])

  const visiblePathways = useMemo(() => {
    if (visibleState.status !== 'ready') return []
    const normalizedSearch = normalizeForSearch(search.trim())
    return visibleState.snapshot.requestPathways.filter((pathway) => !normalizedSearch
      || normalizeForSearch(searchablePathwayText(pathway)).includes(normalizedSearch))
  }, [search, visibleState])

  return (
    <section className="spaces-page" aria-label="Guía pública de espacios UPTC">
      <div className="spaces-hero">
        <div className="spaces-hero-copy">
          <p className="spaces-eyebrow"><span aria-hidden="true" /> ORIENTACIÓN · UPTC</p>
          <h1>Guía de espacios</h1>
          <p className="spaces-intro">
            Consulta ubicaciones publicadas y encuentra los canales oficiales para préstamo, asignación o alquiler de algunos espacios.
          </p>
          <div className="spaces-source-note">
            <span className="spaces-source-dot" aria-hidden="true" />
            <span>Consulta las fuentes oficiales antes de desplazarte; esta guía no muestra rutas interiores.</span>
          </div>
        </div>
        <div className="spaces-hero-art" aria-hidden="true">
          <span className="spaces-map-orbit spaces-map-orbit-one" />
          <span className="spaces-map-orbit spaces-map-orbit-two" />
          <span className="spaces-map-line spaces-map-line-one" />
          <span className="spaces-map-line spaces-map-line-two" />
          <span className="spaces-map-pin">U</span>
          <span className="spaces-map-caption">TUNJA · BOYACÁ</span>
        </div>
      </div>

      <section className="spaces-search-panel" aria-label="Buscar espacios y rutas oficiales">
        <label className="spaces-search-field">
          <span>Buscar espacios o rutas oficiales</span>
          <span className="spaces-search-control">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              aria-label="Buscar espacios o rutas oficiales"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Sede, municipio, alquiler, asignación o fuente oficial"
            />
          </span>
        </label>
        <label className="spaces-kind-field">
          <span>Tipo de lugar</span>
          <select
            aria-label="Filtrar por tipo"
            value={kind}
            onChange={(event) => setKind(event.target.value as SpaceLocationKind | 'ALL')}
          >
            <option value="ALL">Todos los espacios</option>
            {Object.entries(TYPE_FILTER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="spaces-municipality-field">
          <span>Municipio</span>
          <select
            aria-label="Filtrar por municipio"
            disabled={visibleState.status !== 'ready'}
            value={municipality}
            onChange={(event) => setMunicipality(event.target.value)}
          >
            <option value="ALL">Todos los municipios</option>
            {municipalityOptions.map((option) => (
              <option key={normalizeForSearch(option)} value={option}>{option}</option>
            ))}
          </select>
        </label>
        {visibleState.status === 'ready' && (
          <p className="spaces-result-count" role="status" aria-live="polite">
            {visibleLocations.length} de {visibleState.snapshot.locations.length} espacios ·{' '}
            {visiblePathways.length} de {visibleState.snapshot.requestPathways.length} recorridos oficiales
          </p>
        )}
      </section>

      {visibleState.status === 'loading' && <p className="spaces-state-message" role="status">Cargando guía de espacios…</p>}
      {visibleState.status === 'error' && (
        <div className="spaces-state-error" role="alert">
          <p>No se pudo cargar la guía de espacios en este momento.</p>
          <button type="button" onClick={() => setAttempt((current) => current + 1)}>Reintentar</button>
        </div>
      )}
      {visibleState.status === 'ready' && visibleLocations.length === 0 && (
        <div className="spaces-empty-state">
          <span aria-hidden="true">⌕</span>
          <p>No encontramos espacios con esos filtros.</p>
          <button type="button" onClick={() => { setSearch(''); setKind('ALL'); setMunicipality('ALL') }}>
            Limpiar filtros
          </button>
        </div>
      )}
      {visibleState.status === 'ready' && visibleLocations.length > 0 && (
        <div className="spaces-location-grid">
          {visibleLocations.map((location) => <SpaceLocationCard key={location.id} location={location} />)}
        </div>
      )}

      {visibleState.status === 'ready' && (
        <SpaceUsePathways
          pathways={visiblePathways}
          totalPathways={visibleState.snapshot.requestPathways.length}
          onClearSearch={() => setSearch('')}
        />
      )}

      {visibleState.status === 'ready' && (
        <div className="spaces-directory-footer">
          <div>
            <p className="spaces-eyebrow"><span aria-hidden="true" /> OTRAS UBICACIONES</p>
            <h2>Consulta el directorio institucional</h2>
            <p>Para oficinas y dependencias que no aparecen aquí, revisa la ubicación publicada por UPTC.</p>
          </div>
          <a href={visibleState.snapshot.officialOfficeDirectoryUrl} target="_blank" rel="noreferrer">
            Directorio oficial de oficinas <span aria-hidden="true">↗</span>
          </a>
        </div>
      )}
    </section>
  )
}

function SpaceUsePathways({
  pathways,
  totalPathways,
  onClearSearch,
}: {
  pathways: SpaceUsePathway[]
  totalPathways: number
  onClearSearch: () => void
}) {
  return (
    <section className="spaces-pathways" aria-labelledby="spaces-pathways-title">
      <div className="spaces-pathways-heading">
        <div>
          <p className="spaces-eyebrow"><span aria-hidden="true" /> ORIENTACIÓN DE SERVICIOS</p>
          <h2 id="spaces-pathways-title">Préstamo, asignación y alquiler</h2>
          <p>Consulta con la unidad responsable las reglas vigentes para cada tipo de espacio.</p>
        </div>
        <span className="spaces-pathways-mark" aria-hidden="true">↗</span>
      </div>
      <p className="spaces-pathways-count">{pathways.length} de {totalPathways} recorridos oficiales</p>
      {pathways.length > 0
        ? <div className="spaces-pathway-grid">
          {pathways.map((pathway) => <SpaceUsePathwayCard key={pathway.id} pathway={pathway} />)}
        </div>
        : <div className="spaces-pathways-empty">
          <p>No encontramos recorridos oficiales para esta búsqueda.</p>
          <button type="button" onClick={onClearSearch}>Limpiar búsqueda</button>
        </div>}
    </section>
  )
}

function SpaceUsePathwayCard({ pathway }: { pathway: SpaceUsePathway }) {
  return (
    <article className="spaces-pathway-card" aria-label={pathway.title}>
      <span className="spaces-pathway-kind">{USE_KIND_LABELS[pathway.kind]}</span>
      <h3>{pathway.title}</h3>
      <p className="spaces-pathway-audience">{pathway.audience}</p>
      <p className="spaces-pathway-summary">{pathway.summary}</p>
      <p className="spaces-pathway-note">{pathway.availabilityNote}</p>
      <ul className="spaces-pathway-sources" aria-label={`Fuentes oficiales: ${pathway.title}`}>
        {pathway.sources.map((source) => (
          <li key={source.url}>
            <a href={source.url} target="_blank" rel="noreferrer">
              Consultar {source.label} <span aria-hidden="true">↗</span>
            </a>
            <span className="spaces-source-date">
              {source.sourceUpdatedAt ? `Actualizada ${formatDate(source.sourceUpdatedAt)} · ` : ''}
              Consultada {formatDate(source.checkedAt)}
            </span>
          </li>
        ))}
      </ul>
    </article>
  )
}

function SpaceLocationCard({ location }: { location: SpaceLocation }) {
  const mapUrl = buildOpenStreetMapSearchUrl(location)

  return (
    <article className={`spaces-location-card is-${location.kind.toLowerCase()}`} aria-label={location.name}>
      <div className="spaces-card-topline">
        <span className="spaces-type-badge">{TYPE_LABELS[location.kind]}</span>
        <span className="spaces-card-mark" aria-hidden="true">⌖</span>
      </div>
      <h2>{location.name}</h2>
      <p className="spaces-location-place">
        {location.municipality}{location.department ? ` · ${location.department}` : ''}
      </p>
      <div className="spaces-address-block">
        <span>UBICACIÓN PUBLICADA</span>
        {location.address && <p>{location.address}</p>}
        {location.locationDetail && <p className="spaces-location-detail">{location.locationDetail}</p>}
      </div>
      {location.announcement && <SpaceAnnouncementDetails announcement={location.announcement} />}
      <div className="spaces-card-actions">
        {mapUrl
          ? <a className="spaces-map-link" href={mapUrl} target="_blank" rel="noreferrer">
            Abrir búsqueda de mapa para {location.name} <span aria-hidden="true">↗</span>
          </a>
          : <span className="spaces-map-unavailable">Sin dirección para búsqueda cartográfica</span>}
        <a className="spaces-source-link" href={location.source.url} target="_blank" rel="noreferrer">
          {location.source.label} <span aria-hidden="true">↗</span>
        </a>
      </div>
      <p className="spaces-source-date">
        {location.source.sourceUpdatedAt
          ? `Fuente actualizada ${formatDate(location.source.sourceUpdatedAt)} · `
          : ''}
        Consultada {formatDate(location.source.checkedAt)}
      </p>
    </article>
  )
}

function SpaceAnnouncementDetails({ announcement }: { announcement: SpaceAnnouncement }) {
  return (
    <section className="spaces-announcement" aria-label="Capacidades anunciadas">
      <h3>Capacidades anunciadas</h3>
      <ul className="spaces-announcement-capacities">
        {announcement.capacities.map((capacity) => (
          <li key={capacity.areaName}>
            <span>{capacity.areaName}</span>
            <strong>{capacity.announcedCapacityPersons} personas</strong>
          </li>
        ))}
      </ul>
      <p className="spaces-announcement-note">
        {announcement.locationNote} Las cifras son anuncios publicados; no indican disponibilidad actual.
      </p>
      <ul className="spaces-announcement-references" aria-label="Referencias oficiales de ubicación">
        {announcement.locationReferences.map((source) => (
          <li key={source.url}>
            <a href={source.url} target="_blank" rel="noreferrer">
              {source.label} <span aria-hidden="true">↗</span>
            </a>
            <span className="spaces-source-date">
              {source.sourceUpdatedAt ? `Actualizada ${formatDate(source.sourceUpdatedAt)} · ` : ''}
              Consultada {formatDate(source.checkedAt)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function buildOpenStreetMapSearchUrl(location: Pick<SpaceLocation, 'address' | 'mapQuery'>): string | null {
  if (!location.address?.trim() || !location.mapQuery?.trim()) return null
  const url = new URL('https://www.openstreetmap.org/search')
  url.searchParams.set('query', location.mapQuery.trim())
  return url.toString()
}

function searchableText(location: SpaceLocation): string {
  return [location.name, location.municipality, location.department, location.address, location.locationDetail]
    .filter((value): value is string => Boolean(value))
    .join(' ')
}

function searchablePathwayText(pathway: SpaceUsePathway): string {
  return [
    USE_KIND_LABELS[pathway.kind],
    pathway.title,
    pathway.audience,
    pathway.summary,
    pathway.availabilityNote,
    ...pathway.sources.map((source) => source.label),
  ].join(' ')
}

function normalizeForSearch(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es-CO')
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)))
}
