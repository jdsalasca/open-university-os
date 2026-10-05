import { useEffect, useMemo, useState } from 'react'
import type {
  PublicUndergraduateCatalogSnapshot,
  PublicUndergraduateProgram,
  PublicUndergraduateProgramFilters,
} from './publicUndergraduateCatalog'
import { filterPublicUndergraduatePrograms } from './publicUndergraduateCatalog'
import { formatPublicCatalogDate, uniqueProgramOptions } from './publicCatalogShared'
import { fetchPublicUndergraduateCatalog } from './publicUndergraduateCatalogClient'
import './PublicProgramDirectory.scss'

const PUBLIC_CATALOG_PAGE_URL = 'https://www.uptc.edu.co/sitio/portal/sitios/programas_ofer/pregrado.html'
const EMPTY_PROGRAMS: readonly PublicUndergraduateProgram[] = []

interface PublicUndergraduateDirectoryProps {
  snapshot?: PublicUndergraduateCatalogSnapshot
}

const INITIAL_FILTERS: PublicUndergraduateProgramFilters = {
  query: '',
  faculty: '',
  place: '',
  modality: '',
  level: '',
  offered: 'all',
}

/** Cards shown before the visitor asks for the rest; about a screen and a half. */
const RESULT_WINDOW = 24

export function PublicUndergraduateDirectory({
  snapshot: providedSnapshot,
}: PublicUndergraduateDirectoryProps) {
  const [loadedSnapshot, setLoadedSnapshot] = useState<PublicUndergraduateCatalogSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(providedSnapshot === undefined)
  const [retryCount, setRetryCount] = useState(0)
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  // The 79-program snapshot renders about 9,600 px in one go, which pushes everything below it down
  // after the deferred chunk resolves (CLS 0.85) and asks the visitor to scroll past a screen of
  // cards before reaching the curriculum catalog. The window keeps the first block readable.
  const [visibleCount, setVisibleCount] = useState(RESULT_WINDOW)
  const snapshot = providedSnapshot ?? loadedSnapshot

  useEffect(() => {
    if (providedSnapshot !== undefined) return

    const controller = new AbortController()
    fetchPublicUndergraduateCatalog(controller.signal)
      .then((result) => setLoadedSnapshot(result))
      .catch(() => undefined)
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [providedSnapshot, retryCount])

  const snapshotPrograms = snapshot?.programs ?? EMPTY_PROGRAMS
  const programs = useMemo(
    () => filterPublicUndergraduatePrograms(snapshotPrograms, filters),
    [snapshotPrograms, filters],
  )
  const facultyOptions = useMemo(() => uniqueProgramOptions(snapshotPrograms, (program) => program.faculty), [snapshotPrograms])
  const placeOptions = useMemo(() => uniqueProgramOptions(snapshotPrograms, (program) => program.placeLabel), [snapshotPrograms])
  const modalityOptions = useMemo(() => uniqueProgramOptions(snapshotPrograms, (program) => program.modality), [snapshotPrograms])
  const levelOptions = useMemo(() => uniqueProgramOptions(snapshotPrograms, (program) => program.level), [snapshotPrograms])
  const markedOfferedCount = useMemo(
    () => snapshotPrograms.filter((program) => program.markedOffered).length,
    [snapshotPrograms],
  )
  const filtersAreActive = Object.entries(filters).some(([key, value]) =>
    key === 'offered' ? value !== 'all' : value !== '',
  )

  function updateFilter<Key extends keyof PublicUndergraduateProgramFilters>(
    key: Key,
    value: PublicUndergraduateProgramFilters[Key],
  ) {
    setFilters((current) => ({ ...current, [key]: value }))
    setVisibleCount(RESULT_WINDOW)
  }

  if (!snapshot && isLoading) {
    return (
      <section className="public-program-directory" aria-labelledby="public-program-title">
        <div className="catalog-loading catalog-loading-directory" role="status">Cargando el directorio público de programas…</div>
      </section>
    )
  }

  if (!snapshot) {
    return (
      <section className="public-program-directory" aria-labelledby="public-program-title">
        <div className="catalog-error" role="alert">
          <div>
            <strong id="public-program-title">No se pudo cargar el directorio público</strong>
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
          <p className="public-program-eyebrow">OFERTA ACADÉMICA · PREGRADO</p>
          <h2 id="public-program-title">Programas de pregrado UPTC</h2>
          <p>Busca por programa, facultad, modalidad y lugar de desarrollo en el catálogo público de la Universidad.</p>
          <div className="public-program-source-line">
            <span>{snapshot.programs.length} programas en la consulta</span>
            <span aria-hidden="true">·</span>
            <span>{markedOfferedCount} con la marca “Programa ofertado”</span>
          </div>
          <a className="public-program-admissions-link" href="#admisiones">
            Consultar fechas de admisión <span aria-hidden="true">→</span>
          </a>
        </div>
        <div className="public-program-hero-seal" aria-hidden="true"><span>UPTC</span><i>✳</i></div>
      </header>

      <p className="public-program-source-note" role="note">
        <span className="public-program-source-icon" aria-hidden="true">i</span>
        <span>
          Fuente: <a href={snapshot.source.pageUrl} rel="noreferrer" target="_blank">catálogo público UPTC</a>.
          {' '}La fuente señala actualización: {formatPublicCatalogDate(snapshot.source.pageUpdatedAt)}; esta consulta se registró el {formatPublicCatalogDate(snapshot.source.capturedAt)}.
          {' '}La marca “Programa ofertado” transcribe el archivo académico y no confirma convocatoria abierta, fechas, cupos ni admisión.
        </span>
      </p>

      <section className="public-program-search" aria-labelledby="public-program-search-title">
        <div className="public-program-search-heading">
          <div>
            <p className="public-program-eyebrow">DIRECTORIO PÚBLICO</p>
            <h2 id="public-program-search-title">Encuentra tu programa</h2>
          </div>
          <span className="public-program-results-count" role="status">
            {programs.length} {programs.length === 1 ? 'resultado' : 'resultados'} de {snapshot.programs.length}
          </span>
        </div>

        <div className="public-program-filters">
          <label className="public-program-search-field">
            <span>Buscar programa</span>
            <input
              aria-label="Buscar en el directorio de programas UPTC"
              onChange={(event) => updateFilter('query', event.currentTarget.value)}
              placeholder="Nombre, facultad o lugar"
              type="search"
              value={filters.query}
            />
          </label>
          <label>
            <span>Facultad</span>
            <select aria-label="Facultad" onChange={(event) => updateFilter('faculty', event.currentTarget.value)} value={filters.faculty}>
              <option value="">Todas las facultades</option>
              {facultyOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <span>Lugar en la ficha pública</span>
            <select aria-label="Lugar en la ficha pública" onChange={(event) => updateFilter('place', event.currentTarget.value)} value={filters.place}>
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
          <label>
            <span>Marca de oferta en la fuente</span>
            <select aria-label="Marca de oferta en la fuente" onChange={(event) => updateFilter('offered', event.currentTarget.value as PublicUndergraduateProgramFilters['offered'])} value={filters.offered}>
              <option value="all">Todas las marcas</option>
              <option value="marked">Marcado como ofertado</option>
              <option value="unmarked">Sin marca de ofertado</option>
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
            <ul className="public-program-results" aria-label="Programas encontrados">
              {programs.slice(0, visibleCount).map((program) => (
              <li className="public-program-card" key={program.id}>
                <div className="public-program-card-topline">
                  <span className="public-program-card-level">{program.level}</span>
                  <span className={`public-program-offer-tag${program.markedOffered ? ' is-marked' : ''}`}>
                    {program.markedOffered ? 'Programa ofertado · fuente UPTC' : 'Sin marca de ofertado · fuente UPTC'}
                  </span>
                </div>
                <h3><a href={program.detailUrl} rel="noreferrer" target="_blank">{program.name}</a></h3>
                <dl className="public-program-card-details">
                  <div><dt>Facultad</dt><dd>{program.faculty}</dd></div>
                  <div><dt>Modalidad</dt><dd>{program.modality}</dd></div>
                  <div><dt>Lugar publicado</dt><dd>{program.placeLabel}</dd></div>
                </dl>
                {program.locationsSummary && (
                  <p className="public-program-locations"><span>Lugares asociados</span>{program.locationsSummary}</p>
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
