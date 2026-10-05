import { useEffect, useMemo, useState } from 'react'
import type {
  PublicPostgraduateCatalogSnapshot,
  PublicPostgraduateProgram,
  PublicPostgraduateProgramFilters,
} from './publicPostgraduateCatalog'
import { filterPublicPostgraduatePrograms } from './publicPostgraduateCatalog'
import { fetchPublicPostgraduateCatalog } from './publicPostgraduateCatalogClient'
import { formatPublicCatalogDate, uniqueProgramOptions } from './publicCatalogShared'
import './PublicProgramDirectory.scss'

const PUBLIC_CATALOG_PAGE_URL = 'https://www.uptc.edu.co/sitio/portal/sitios/programas_ofer/posgrados.html'
const EMPTY_PROGRAMS: readonly PublicPostgraduateProgram[] = []

interface PublicPostgraduateDirectoryProps {
  snapshot?: PublicPostgraduateCatalogSnapshot
}

const INITIAL_FILTERS: PublicPostgraduateProgramFilters = {
  query: '',
  facultyOrUnit: '',
  place: '',
  modality: '',
  level: '',
}

/** Cards shown before the visitor asks for the rest; about a screen and a half. */
const RESULT_WINDOW = 24

export function PublicPostgraduateDirectory({ snapshot: providedSnapshot }: PublicPostgraduateDirectoryProps) {
  const [loadedSnapshot, setLoadedSnapshot] = useState<PublicPostgraduateCatalogSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(providedSnapshot === undefined)
  const [retryCount, setRetryCount] = useState(0)
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  // The 139-program snapshot rendered about 15,700 px in one go, so switching to posgrado pushed the
  // curriculum catalog thousands of pixels down (measured CLS 0.62) and asked for a 17,000 px scroll.
  const [visibleCount, setVisibleCount] = useState(RESULT_WINDOW)
  const snapshot = providedSnapshot ?? loadedSnapshot

  useEffect(() => {
    if (providedSnapshot !== undefined) return

    const controller = new AbortController()
    fetchPublicPostgraduateCatalog(controller.signal)
      .then((result) => setLoadedSnapshot(result))
      .catch(() => undefined)
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [providedSnapshot, retryCount])

  const snapshotPrograms = snapshot?.programs ?? EMPTY_PROGRAMS
  const programs = useMemo(
    () => filterPublicPostgraduatePrograms(snapshotPrograms, filters),
    [snapshotPrograms, filters],
  )
  const facultyOrUnitOptions = useMemo(
    () => uniqueProgramOptions(snapshotPrograms, (program) => program.facultyOrUnit),
    [snapshotPrograms],
  )
  const placeOptions = useMemo(() => uniqueProgramOptions(snapshotPrograms, (program) => program.placeLabel), [snapshotPrograms])
  const modalityOptions = useMemo(() => uniqueProgramOptions(snapshotPrograms, (program) => program.modality), [snapshotPrograms])
  const levelOptions = useMemo(() => uniqueProgramOptions(snapshotPrograms, (program) => program.level), [snapshotPrograms])
  const filtersAreActive = Object.values(filters).some(Boolean)

  function updateFilter<Key extends keyof PublicPostgraduateProgramFilters>(
    key: Key,
    value: PublicPostgraduateProgramFilters[Key],
  ) {
    setFilters((current) => ({ ...current, [key]: value }))
    setVisibleCount(RESULT_WINDOW)
  }

  if (!snapshot && isLoading) {
    return (
      <section className="public-program-directory" aria-labelledby="public-program-title">
        <div className="catalog-loading catalog-loading-directory" role="status">Cargando el directorio público de posgrado…</div>
      </section>
    )
  }

  if (!snapshot) {
    return (
      <section className="public-program-directory" aria-labelledby="public-program-title">
        <div className="catalog-error" role="alert">
          <div>
            <strong id="public-program-title">No se pudo cargar el directorio público de posgrado</strong>
            <p>No fue posible cargar los programas. Inténtalo de nuevo o consulta la publicación oficial de la UPTC.</p>
            <a href={PUBLIC_CATALOG_PAGE_URL} rel="noreferrer" target="_blank">Abrir catálogo público UPTC</a>
          </div>
          <button className="catalog-button catalog-button-secondary" type="button" onClick={() => {
            setLoadedSnapshot(null)
            setIsLoading(true)
            setRetryCount((count) => count + 1)
          }}>
            Reintentar
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="public-program-directory" aria-labelledby="public-program-title">
      <header className="public-program-hero">
        <div className="public-program-hero-copy">
          <p className="public-program-eyebrow">DIRECTORIO ACADÉMICO · POSGRADO</p>
          <h2 id="public-program-title">Programas de posgrado UPTC</h2>
          <p>Consulta los programas que aparecen en el directorio público, con búsqueda por unidad académica, nivel, modalidad y lugar.</p>
          <div className="public-program-source-line">
            <span>{snapshot.programs.length} programas en el directorio público</span>
            <span aria-hidden="true">·</span>
            <span>Instantánea informativa</span>
          </div>
        </div>
        <div className="public-program-hero-seal" aria-hidden="true"><span>UPTC</span><i>✳</i></div>
      </header>

      <p className="public-program-source-note" role="note">
        <span className="public-program-source-icon" aria-hidden="true">i</span>
        <span>
          Fuente: <a href={snapshot.source.pageUrl} rel="noreferrer" target="_blank">directorio público de posgrados UPTC</a>.
          {' '}La fuente señala actualización: {formatPublicCatalogDate(snapshot.source.pageUpdatedAt)}; la consulta se registró el {formatPublicCatalogDate(snapshot.source.capturedAt)}.
          {' '}La inclusión en el directorio no confirma oferta abierta, convocatoria, fechas, cupos, admisión ni matrícula.
        </span>
      </p>

      <section className="public-program-search" aria-labelledby="public-postgraduate-search-title">
        <div className="public-program-search-heading">
          <div>
            <p className="public-program-eyebrow">DIRECTORIO PÚBLICO</p>
            <h2 id="public-postgraduate-search-title">Explora programas de posgrado</h2>
          </div>
          <span className="public-program-results-count" role="status">
            {programs.length} {programs.length === 1 ? 'resultado' : 'resultados'} de {snapshot.programs.length}
          </span>
        </div>

        <div className="public-program-filters">
          <label className="public-program-search-field">
            <span>Buscar programa</span>
            <input
              aria-label="Buscar en el directorio de posgrado UPTC"
              onChange={(event) => updateFilter('query', event.currentTarget.value)}
              placeholder="Nombre, código, unidad o lugar"
              type="search"
              value={filters.query}
            />
          </label>
          <label>
            <span>Facultad o unidad publicada</span>
            <select aria-label="Facultad o unidad publicada" onChange={(event) => updateFilter('facultyOrUnit', event.currentTarget.value)} value={filters.facultyOrUnit}>
              <option value="">Todas las unidades</option>
              {facultyOrUnitOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <span>Lugar publicado</span>
            <select aria-label="Lugar publicado" onChange={(event) => updateFilter('place', event.currentTarget.value)} value={filters.place}>
              <option value="">Todos los lugares</option>
              {placeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <span>Modalidad</span>
            <select aria-label="Modalidad" onChange={(event) => updateFilter('modality', event.currentTarget.value)} value={filters.modality}>
              <option value="">Todas las modalidades</option>
              {modalityOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <span>Nivel académico</span>
            <select aria-label="Nivel académico" onChange={(event) => updateFilter('level', event.currentTarget.value)} value={filters.level}>
              <option value="">Todos los niveles</option>
              {levelOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          {filtersAreActive && (
            <button className="public-program-reset" onClick={() => setFilters(INITIAL_FILTERS)} type="button">
              Limpiar filtros
            </button>
          )}
        </div>

        {programs.length > 0 ? (
          <>
            <ul className="public-program-results" aria-label="Programas de posgrado encontrados">
              {programs.slice(0, visibleCount).map((program) => (
              <li className="public-program-card" key={program.programCode}>
                <div className="public-program-card-topline">
                  <span className="public-program-card-level">{program.level}</span>
                  <span className="public-program-code">Código {program.programCode}</span>
                </div>
                <h3><a href={program.detailUrl} rel="noreferrer" target="_blank">{program.name}</a></h3>
                <dl className="public-program-card-details">
                  <div><dt>Facultad o unidad publicada</dt><dd>{program.facultyOrUnit}</dd></div>
                  <div><dt>Modalidad</dt><dd>{program.modality}</dd></div>
                  <div><dt>Lugar publicado</dt><dd>{program.placeLabel}</dd></div>
                </dl>
                {program.locationsSummary && (
                  <p className="public-program-locations"><span>Lugares asociados en la fuente</span>{program.locationsSummary}</p>
                )}
                <a className="public-program-detail-link" href={program.detailUrl} rel="noreferrer" target="_blank">
                  Consultar ficha UPTC <span aria-hidden="true">↗</span>
                </a>
              </li>
              ))}
            </ul>
            {visibleCount < programs.length && (
              <div className="public-program-window">
                <p>
                  Mostrando {Math.min(visibleCount, programs.length)} de {programs.length} programas.
                </p>
                <button
                  className="public-program-more"
                  type="button"
                  onClick={() => setVisibleCount((current) => current + RESULT_WINDOW)}
                >
                  Ver más ({programs.length - Math.min(visibleCount, programs.length)} restantes)
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="public-program-empty" role="status">
            <span aria-hidden="true">⌕</span>
            <h3>No hay programas que coincidan</h3>
            <p>Prueba con otro nombre o combina menos filtros.</p>
            <button className="public-program-reset" onClick={() => setFilters(INITIAL_FILTERS)} type="button">
              Limpiar filtros
            </button>
          </div>
        )}
      </section>
    </section>
  )
}
