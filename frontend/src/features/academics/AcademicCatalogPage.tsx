import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { normalizeSearchText } from '../../shared/text/normalizeSearchText'
import type { ChangeEvent } from 'react'
import { academicCatalogClient } from './academicCatalogClient'
import { academicOperationsClient } from './academicOperationsClient'
import type { AcademicOperationsClient, AcademicStructureSnapshot } from './academicOperationsContracts'
import type {
  AcademicCatalogClient,
  AcademicCatalogIssue,
  AcademicCurriculum,
  AcademicCurriculumDraftsPage,
  AcademicCurriculumDetails,
  AcademicCurriculumEntriesPage,
  AcademicProgram,
  CatalogAuthorization,
  CurriculumImportPreview,
} from './contracts'
import {
  DEFAULT_ADMIN_DRAFT_PAGE_SIZE,
  MAX_PUBLIC_CURRICULUM_PAGE_SIZE,
  MAX_PUBLIC_CURRICULUM_SEARCH_CODE_POINTS,
  validateCurriculumCsvFile,
} from './contracts'
import './AcademicCatalogPage.scss'

const CurriculumVersionComparisonPanel = lazy(() => import('./CurriculumVersionComparisonPanel'))
const PublicProgramDirectories = lazy(() => import('./publicCatalog/PublicProgramDirectories').then((module) => ({
  default: module.PublicProgramDirectories,
})))

interface AcademicCatalogPageProps {
  client?: AcademicCatalogClient
  structureClient?: Pick<AcademicOperationsClient, 'getStructure'>
  authorization?: CatalogAuthorization | null
}

interface ProgramPlacement {
  organizationUnitName: string
  siteName: string
  displayName: string
}

const PENDING_PROGRAM_PLACEMENT: ProgramPlacement = {
  organizationUnitName: 'Adscripción pendiente de validar',
  siteName: 'Adscripción pendiente de validar',
  displayName: 'Adscripción pendiente de validar',
}

type RequestState = 'loading' | 'ready' | 'error'

interface ApiFailure extends Error {
  status?: number
  code?: string
  issues?: readonly AcademicCatalogIssue[]
}

export function AcademicCatalogPage({
  client = academicCatalogClient,
  structureClient = academicOperationsClient,
  authorization = null,
}: AcademicCatalogPageProps) {
  const accessToken = authorization?.accessToken.trim() ? authorization.accessToken : null
  const canReadDrafts = accessToken !== null
    && authorization?.permissions.includes('academic:catalog:read') === true

  const [programs, setPrograms] = useState<AcademicProgram[]>([])
  const [programPlacements, setProgramPlacements] = useState<Record<string, ProgramPlacement>>({})
  const [programsState, setProgramsState] = useState<RequestState>('loading')
  const [programsError, setProgramsError] = useState('')
  const [programRetry, setProgramRetry] = useState(0)
  const [programSearch, setProgramSearch] = useState('')
  const [selectedProgramId, setSelectedProgramId] = useState('')
  const [curricula, setCurricula] = useState<AcademicCurriculum[]>([])
  const [curriculaState, setCurriculaState] = useState<RequestState>('ready')
  const [curriculaError, setCurriculaError] = useState('')
  const [publicRefresh, setPublicRefresh] = useState(0)
  const [selectedCurriculum, setSelectedCurriculum] = useState<AcademicCurriculum | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      client.listPrograms(controller.signal),
      structureClient.getStructure(controller.signal),
    ])
      .then(([result, structure]) => {
        setPrograms(result)
        setProgramPlacements(resolveProgramPlacements(result, structure))
        setProgramsState('ready')
        setSelectedProgramId(result[0]?.id ?? '')
        setCurricula([])
        setSelectedCurriculum(null)
        setCurriculaState(result.length > 0 ? 'loading' : 'ready')
        setCurriculaError('')
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setProgramsError('No se pudo cargar el catálogo y la adscripción académica vigente. Comprueba la conexión e inténtalo de nuevo.')
        setProgramsState('error')
      })
    return () => controller.abort()
  }, [client, structureClient, programRetry])

  useEffect(() => {
    if (!selectedProgramId) return

    const controller = new AbortController()
    client.listCurricula(selectedProgramId, controller.signal)
      .then((result) => {
        setCurricula(result.filter((curriculum) => curriculum.status === 'PUBLISHED'))
        setCurriculaState('ready')
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setCurriculaError('No se pudieron cargar las versiones publicadas de este programa.')
        setCurriculaState('error')
      })
    return () => controller.abort()
  }, [client, selectedProgramId, publicRefresh])

  const selectedProgram = useMemo(
    () => programs.find((program) => program.id === selectedProgramId) ?? null,
    [programs, selectedProgramId],
  )
  const visiblePrograms = useMemo(() => {
    const normalizedSearch = normalizeSearchText(programSearch)
    if (normalizedSearch.length === 0) return programs
    return programs.filter((program) => normalizeSearchText([
      program.programCode,
      program.programName,
      programPlacements[program.id]?.organizationUnitName ?? PENDING_PROGRAM_PLACEMENT.organizationUnitName,
      programPlacements[program.id]?.siteName ?? PENDING_PROGRAM_PLACEMENT.siteName,
    ].join(' ')).includes(normalizedSearch))
  }, [programPlacements, programs, programSearch])
  function retryPrograms() {
    setProgramsState('loading')
    setProgramsError('')
    setProgramRetry((count) => count + 1)
  }

  function chooseProgram(programId: string) {
    setSelectedProgramId(programId)
    setSelectedCurriculum(null)
    setCurriculaState('loading')
    setCurriculaError('')
  }

  function retryCurricula() {
    setSelectedCurriculum(null)
    setCurriculaState('loading')
    setCurriculaError('')
    setPublicRefresh((count) => count + 1)
  }

  function refreshPublicCurricula() {
    setSelectedCurriculum(null)
    setCurriculaState('loading')
    setCurriculaError('')
    setPublicRefresh((count) => count + 1)
  }

  return (
    <div className="academic-catalog">
      <Suspense fallback={<div className="catalog-loading catalog-loading-directory" role="status">Cargando el directorio público de programas…</div>}>
        <PublicProgramDirectories />
      </Suspense>
      <section className="catalog-hero" aria-labelledby="catalog-title">
        <div className="catalog-hero-copy">
          <p className="catalog-eyebrow"><span aria-hidden="true" /> VIDA UNIVERSITARIA <span aria-hidden="true">/</span> MALLAS CURRICULARES</p>
          <h1 id="catalog-title">Mallas curriculares de <em>pregrado</em></h1>
          <p className="catalog-intro">Consulta las versiones cargadas en el catálogo curricular. El directorio público de programas es independiente de este catálogo y aparece arriba.</p>
          <div className="catalog-hero-meta">
            <span className="catalog-preview-badge"><span aria-hidden="true">◌</span> Entorno de desarrollo</span>
            <span>Catálogo curricular · Sin datos personales</span>
          </div>
        </div>
        <div className="catalog-hero-art" aria-hidden="true">
          <div className="catalog-art-orbit catalog-art-orbit-one" />
          <div className="catalog-art-orbit catalog-art-orbit-two" />
          <div className="catalog-art-disc"><span>U</span></div>
          <div className="catalog-art-spark catalog-art-spark-one">✳</div>
          <div className="catalog-art-spark catalog-art-spark-two">✦</div>
          <div className="catalog-art-caption">RUTA<br />ACADÉMICA</div>
        </div>
      </section>

      <div className="catalog-operation-note" role="note">
        <span className="catalog-note-icon" aria-hidden="true">i</span>
        <p><strong>Esta instancia aún no tiene mallas curriculares publicadas.</strong> La publicación institucional requiere validar fuentes y responsables con la UPTC.</p>
      </div>

      {programsState === 'loading' && <p className="catalog-loading" role="status">Cargando catálogo académico…</p>}

      {programsState === 'error' && (
        <div className="catalog-error" role="alert">
          <span className="catalog-error-icon" aria-hidden="true">!</span>
          <div><strong>No se pudo cargar el catálogo</strong><p>{programsError}</p></div>
          <button className="catalog-button catalog-button-secondary" type="button" onClick={retryPrograms}>Reintentar</button>
        </div>
      )}

      {programsState === 'ready' && programs.length === 0 && (
        <section className="catalog-empty" aria-labelledby="catalog-empty-title">
          <div className="catalog-empty-art" aria-hidden="true"><span>⌁</span><i /><b /></div>
          <p className="catalog-eyebrow">CATÁLOGO CURRICULAR</p>
          <h2 id="catalog-empty-title">No hay mallas publicadas en este catálogo</h2>
          <p>El directorio público de programas aparece arriba; su información no confirma que una malla esté cargada aquí.</p>
          <span className="catalog-empty-footnote"><span aria-hidden="true">◇</span> Este catálogo no usa registros de ejemplo.</span>
        </section>
      )}

      {programsState === 'ready' && programs.length > 0 && (
        <section className="catalog-browser" aria-label="Programas y planes de estudio">
          <div className="catalog-programs-panel">
            <div className="catalog-section-heading">
              <div><p className="catalog-eyebrow">EXPLORAR</p><h2>Programas</h2></div>
              <span className="catalog-count">{visiblePrograms.length.toString().padStart(2, '0')}</span>
            </div>
            <label className="catalog-program-search">
              <span>Buscar programa</span>
              <input
                aria-label="Buscar programa"
                onChange={(event) => setProgramSearch(event.target.value)}
                placeholder="Nombre, código o sede"
                type="search"
                value={programSearch}
              />
            </label>
            <div className="catalog-program-list" role="group" aria-label="Seleccionar programa">
              {visiblePrograms.map((program) => (
                <button
                  aria-pressed={selectedProgramId === program.id}
                  className={`catalog-program-option${selectedProgramId === program.id ? ' is-selected' : ''}`}
                  key={program.id}
                  onClick={() => chooseProgram(program.id)}
                  type="button"
                >
                  <span className="catalog-program-mark" aria-hidden="true">{program.programCode.slice(0, 1)}</span>
                  <span className="catalog-program-copy"><strong>{program.programName}</strong><small>{programPlacements[program.id]?.displayName ?? PENDING_PROGRAM_PLACEMENT.displayName}</small></span>
                  <span className="catalog-program-arrow" aria-hidden="true">↗</span>
                </button>
              ))}
              {visiblePrograms.length === 0 && (
                <p className="catalog-program-list-empty" role="status">Ningún programa coincide con esta búsqueda.</p>
              )}
            </div>
            {selectedProgram && programSearch.trim().length > 0
              && !visiblePrograms.some(({ id }) => id === selectedProgram.id) && (
                <p className="catalog-program-filter-context" role="status">
                  El plan mostrado corresponde a {selectedProgram.programName}. Selecciona un resultado para cambiarlo.
                </p>
              )}
          </div>

          <div className="catalog-curricula-panel">
            {selectedProgram && (
              <div className="catalog-section-heading catalog-curricula-heading">
                <div><p className="catalog-eyebrow">PLANES PUBLICADOS · {(programPlacements[selectedProgram.id]?.siteName ?? PENDING_PROGRAM_PLACEMENT.siteName).toLocaleUpperCase('es-CO')}</p><h2>{selectedProgram.programName}</h2></div>
                <span className="catalog-campus-tag">{selectedProgram.programCode}</span>
              </div>
            )}
            {curriculaState === 'loading' && <p className="catalog-loading" role="status">Cargando versiones publicadas…</p>}
            {curriculaState === 'error' && (
              <div className="catalog-error catalog-error-compact" role="alert">
                <p>{curriculaError}</p>
                <button className="catalog-button catalog-button-secondary" type="button" onClick={retryCurricula}>Reintentar</button>
              </div>
            )}
            {curriculaState === 'ready' && curricula.length === 0 && (
              <div className="catalog-no-curricula">
                <span className="catalog-no-curricula-icon" aria-hidden="true">▤</span>
                <div><h3>Sin planes publicados</h3><p>Este programa todavía no tiene una versión curricular pública disponible.</p></div>
              </div>
            )}
            {curriculaState === 'ready' && curricula.length > 0 && (
              <div className="catalog-curriculum-grid">
                {curricula.map((curriculum) => (
                  <CurriculumCard
                    curriculum={curriculum}
                    key={curriculum.id}
                    siteName={programPlacements[selectedProgramId]?.siteName ?? PENDING_PROGRAM_PLACEMENT.siteName}
                    onView={() => setSelectedCurriculum(curriculum)}
                  />
                ))}
              </div>
            )}
            {selectedCurriculum && curricula.some(({ id }) => id === selectedCurriculum.id) && (
              <PublishedCurriculumDetails
                key={selectedCurriculum.id}
                client={client}
                curriculum={selectedCurriculum}
                onClose={() => setSelectedCurriculum(null)}
              />
            )}
          </div>
        </section>
      )}

      {canReadDrafts && accessToken
        ? <CatalogAdministration
          key={accessToken}
          accessToken={accessToken}
          authorization={authorization!}
          client={client}
          onPublished={refreshPublicCurricula}
        />
        : <LockedCatalogAdministration />}
    </div>
  )
}

interface PublishedCurriculumDetailsProps {
  client: AcademicCatalogClient
  curriculum: AcademicCurriculum
  onClose: () => void
}

function PublishedCurriculumDetails({ client, curriculum, onClose }: PublishedCurriculumDetailsProps) {
  const [metadata, setMetadata] = useState<AcademicCurriculum | null>(null)
  const [entriesPage, setEntriesPage] = useState<AcademicCurriculumEntriesPage | null>(null)
  const [metadataState, setMetadataState] = useState<RequestState>('loading')
  const [entriesState, setEntriesState] = useState<RequestState>('loading')
  const [metadataError, setMetadataError] = useState('')
  const [entriesError, setEntriesError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [selectedSemester, setSelectedSemester] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearchTerm(searchTerm.trim()), 250)
    return () => window.clearTimeout(timeout)
  }, [searchTerm])

  useEffect(() => {
    const controller = new AbortController()

    client.getPublishedCurriculum(curriculum.id, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        if (result.status !== 'PUBLISHED'
          || result.id.toLocaleLowerCase('en-US') !== curriculum.id.toLocaleLowerCase('en-US')
          || result.programId.toLocaleLowerCase('en-US') !== curriculum.programId.toLocaleLowerCase('en-US')) {
          setMetadata(null)
          setMetadataError('La versión no está disponible para consulta pública.')
          setMetadataState('error')
          return
        }
        setMetadata(result)
        setMetadataState('ready')
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return
        const failure = asApiFailure(requestError)
        setMetadataError(failure.status === 404 || failure.code === 'curriculum_not_found'
          ? 'Esta versión ya no está publicada o no existe.'
          : 'No se pudo cargar la información de esta versión.')
        setMetadataState('error')
      })

    return () => controller.abort()
  }, [client, curriculum.id, curriculum.programId, retryCount])

  const searchPending = searchTerm.trim() !== debouncedSearchTerm
  const parsedSemester = selectedSemester === '' ? undefined : Number(selectedSemester)
  const invalidSemester = parsedSemester !== undefined
    && (!Number.isInteger(parsedSemester) || parsedSemester < 1 || parsedSemester > 32767)

  useEffect(() => {
    if (curriculum.entryCount === 0 || searchPending) return

    if (invalidSemester) {
      return
    }

    const controller = new AbortController()
    const query = {
      page: currentPage,
      pageSize: MAX_PUBLIC_CURRICULUM_PAGE_SIZE,
      search: debouncedSearchTerm,
      semester: parsedSemester,
    }
    client.listPublishedCurriculumEntries(curriculum.id, query, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        if (result.curriculumId.toLocaleLowerCase('en-US') !== curriculum.id.toLocaleLowerCase('en-US')
          || result.page !== query.page
          || result.pageSize !== query.pageSize
          || result.entries.length > MAX_PUBLIC_CURRICULUM_PAGE_SIZE
          || result.totalPages !== (result.totalItems === 0 ? 0 : Math.ceil(result.totalItems / query.pageSize))) {
          throw new Error('The published curriculum page response is inconsistent.')
        }
        if (result.totalPages > 0 && query.page > result.totalPages) {
          setCurrentPage(result.totalPages)
          return
        }
        if (result.totalPages === 0 && query.page > 1) {
          setCurrentPage(1)
          return
        }
        setEntriesPage(result)
        setEntriesState('ready')
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return
        const failure = asApiFailure(requestError)
        setEntriesError(failure.status === 404 || failure.code === 'curriculum_not_found'
          ? 'Esta versión ya no está publicada o no existe.'
          : 'No se pudieron cargar las asignaturas de esta versión.')
        setEntriesState('error')
      })

    return () => controller.abort()
  }, [client, curriculum.entryCount, curriculum.id, currentPage, debouncedSearchTerm, invalidSemester, parsedSemester, searchPending])

  function retryDetails() {
    setMetadata(null)
    setEntriesPage(null)
    setMetadataState('loading')
    setEntriesState('loading')
    setMetadataError('')
    setEntriesError('')
    setCurrentPage(1)
    setRetryCount((count) => count + 1)
  }

  function markEntriesLoading() {
    setEntriesPage(null)
    setEntriesError('')
    setEntriesState('loading')
  }

  const requestError = metadataState === 'error' ? metadataError : ''
  const totalPages = entriesPage?.totalPages ?? 0
  const totalItems = entriesPage?.totalItems ?? 0
  const firstVisibleEntry = totalItems === 0 ? 0 : (currentPage - 1) * MAX_PUBLIC_CURRICULUM_PAGE_SIZE + 1
  const lastVisibleEntry = entriesPage
    ? Math.min((currentPage - 1) * MAX_PUBLIC_CURRICULUM_PAGE_SIZE + entriesPage.entries.length, totalItems)
    : 0
  const hasActiveFilters = debouncedSearchTerm.length > 0 || selectedSemester !== ''

  return (
    <section className="catalog-public-curriculum-detail" aria-label={`Detalle de la versión ${curriculum.curriculumVersion}`}>
      <div className="catalog-public-detail-heading">
        <div>
          <p className="catalog-eyebrow">PLAN PUBLICADO · {cohortLabel(curriculum)}</p>
          <h3>Asignaturas <span>{curriculum.curriculumVersion}</span></h3>
        </div>
        <button
          aria-label={`Cerrar detalle de la versión ${curriculum.curriculumVersion}`}
          className="catalog-button catalog-button-secondary"
          onClick={onClose}
          type="button"
        >
          Cerrar
        </button>
      </div>

      {metadataState === 'loading' && <p className="catalog-loading" role="status">Cargando el plan publicado…</p>}
      {requestError && (
        <div className="catalog-error catalog-public-detail-error" role="alert">
          <p>{requestError}</p>
          <button className="catalog-button catalog-button-secondary" onClick={retryDetails} type="button">
            Reintentar
          </button>
        </div>
      )}
      {metadataState === 'ready' && metadata && metadata.entryCount === 0 && (
        <p className="catalog-public-detail-empty" role="status">Esta versión todavía no tiene asignaturas publicadas.</p>
      )}
      {metadataState === 'ready' && metadata && metadata.entryCount > 0 && !requestError && (
        <>
          <div className="catalog-curriculum-filters">
            <label>
              <span>Buscar asignatura</span>
              <input
                onChange={(event) => {
                  setSearchTerm(event.target.value)
                  setCurrentPage(1)
                  markEntriesLoading()
                }}
                maxLength={MAX_PUBLIC_CURRICULUM_SEARCH_CODE_POINTS}
                placeholder="Código o nombre"
                type="search"
                value={searchTerm}
              />
            </label>
            <label>
              <span>Semestre</span>
              <input
                max={32767}
                min={1}
                onChange={(event) => {
                  setSelectedSemester(event.target.value)
                  setCurrentPage(1)
                  markEntriesLoading()
                }}
                placeholder="Todos"
                step={1}
                type="number"
                value={selectedSemester}
              />
            </label>
            <p className="catalog-curriculum-filter-count">
              {entriesPage ? `${entriesPage.entries.length} de ${entriesPage.totalItems} asignaturas` : 'Consulta del catálogo publicado'}
            </p>
          </div>
          {invalidSemester && <p className="catalog-curriculum-filter-empty" role="alert">El semestre debe ser un número entero entre 1 y 32767.</p>}
          {!invalidSemester && entriesState === 'error' && (
            <div className="catalog-error catalog-public-detail-error" role="alert">
              <p>{entriesError}</p>
              <button className="catalog-button catalog-button-secondary" onClick={retryDetails} type="button">
                Reintentar
              </button>
            </div>
          )}
          {searchPending && <p className="catalog-loading" role="status">Actualizando filtros…</p>}
          {!invalidSemester && !searchPending && entriesState === 'loading' && <p className="catalog-loading" role="status">Cargando asignaturas…</p>}
          {!invalidSemester && !searchPending && entriesState === 'ready' && entriesPage && entriesPage.totalItems === 0 && (
            <p className="catalog-curriculum-filter-empty" role="status">
              {hasActiveFilters ? 'Ninguna asignatura coincide con estos filtros.' : 'Esta versión todavía no tiene asignaturas publicadas.'}
            </p>
          )}
          {!invalidSemester && !searchPending && entriesState === 'ready' && entriesPage && entriesPage.entries.length > 0 && (
            <>
              <div className="catalog-review-table-wrap">
                <table className="catalog-review-table">
                  <caption>Asignaturas de la versión {metadata.curriculumVersion}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Semestre</th>
                      <th scope="col">Código</th>
                      <th scope="col">Asignatura</th>
                      <th scope="col">Créditos</th>
                      <th scope="col">Espacio de formación</th>
                      <th scope="col">Componente</th>
                      <th scope="col">Grupo de elección</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entriesPage.entries.map((entry) => (
                      <tr key={`${entry.subjectRevisionId}-${entry.rowOrder}`}>
                        <td>{entry.semester}</td>
                        <td>{entry.subjectCode}</td>
                        <td>{entry.subjectName}</td>
                        <td>{entry.credits}</td>
                        <td>{entry.formationSpace}</td>
                        <td>{entry.component}</td>
                        <td>{entry.choiceGroup ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {!invalidSemester && !searchPending && entriesState === 'ready' && totalPages > 1 && (
            <nav className="catalog-curriculum-pagination" aria-label="Paginación de asignaturas">
              <span>Mostrando {firstVisibleEntry}–{lastVisibleEntry} de {totalItems}</span>
              <div>
                <button
                  aria-label="Página anterior"
                  className="catalog-button catalog-button-secondary"
                  disabled={currentPage === 1}
                  onClick={() => {
                    markEntriesLoading()
                    setCurrentPage((page) => Math.max(1, page - 1))
                  }}
                  type="button"
                >
                  Anterior
                </button>
                <span aria-live="polite">Página {currentPage} de {totalPages}</span>
                <button
                  aria-label="Página siguiente"
                  className="catalog-button catalog-button-secondary"
                  disabled={currentPage === totalPages}
                  onClick={() => {
                    markEntriesLoading()
                    setCurrentPage((page) => Math.min(totalPages, page + 1))
                  }}
                  type="button"
                >
                  Siguiente
                </button>
              </div>
            </nav>
          )}
        </>
      )}
    </section>
  )
}

interface CatalogAdministrationProps {
  accessToken: string
  authorization: CatalogAuthorization
  client: AcademicCatalogClient
  onPublished: () => void
}

function CatalogAdministration({ accessToken, authorization, client, onPublished }: CatalogAdministrationProps) {
  const canWriteCatalog = authorization.permissions.includes('academic:catalog:write')
  const [drafts, setDrafts] = useState<AcademicCurriculum[]>([])
  const [draftsPageData, setDraftsPageData] = useState<AcademicCurriculumDraftsPage | null>(null)
  const [draftPage, setDraftPage] = useState(1)
  const [draftCursors, setDraftCursors] = useState<Array<string | null>>([null])
  const [draftsState, setDraftsState] = useState<RequestState>('loading')
  const [draftsError, setDraftsError] = useState('')
  const [draftRefresh, setDraftRefresh] = useState(0)
  const [selectedDraft, setSelectedDraft] = useState<AcademicCurriculumDetails | null>(null)
  const [reviewingDraftId, setReviewingDraftId] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const selectedFileRef = useRef<File | null>(null)
  const [filePreview, setFilePreview] = useState<{ file: File; preview: CurriculumImportPreview } | null>(null)
  const previewControllerRef = useRef<AbortController | null>(null)
  const canWriteCatalogRef = useRef(canWriteCatalog)
  const [previewPending, setPreviewPending] = useState(false)
  const [actionPending, setActionPending] = useState(false)
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState<ApiFailure | null>(null)

  useEffect(() => () => {
    previewControllerRef.current?.abort()
    previewControllerRef.current = null
  }, [])

  useEffect(() => {
    const lostWritePermission = canWriteCatalogRef.current && !canWriteCatalog
    canWriteCatalogRef.current = canWriteCatalog
    if (!lostWritePermission) return

    previewControllerRef.current?.abort()
    previewControllerRef.current = null
    selectedFileRef.current = null
    setSelectedFile(null)
    setFilePreview(null)
    setPreviewPending(false)
    setActionError(null)
  }, [canWriteCatalog])

  useEffect(() => {
    const controller = new AbortController()
    const after = draftCursors[draftPage - 1]
    const query = {
      pageSize: DEFAULT_ADMIN_DRAFT_PAGE_SIZE,
      ...(after ? { after } : {}),
    }
    client.listDrafts(accessToken, query, controller.signal)
      .then((result) => {
        if (result.drafts.length === 0 && draftPage > 1) {
          setDraftCursors([null])
          setDraftPage(1)
          return
        }
        setDraftsPageData(result)
        setDrafts(result.drafts)
        setDraftsState('ready')
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setDraftsError('No se pudieron cargar los borradores administrativos.')
        setDraftsState('error')
      })
    return () => controller.abort()
  }, [client, accessToken, draftCursors, draftPage, draftRefresh])

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null
    event.currentTarget.value = ''
    previewControllerRef.current?.abort()
    previewControllerRef.current = null
    selectedFileRef.current = file
    setSelectedFile(file)
    setFilePreview(null)
    setPreviewPending(false)
    setActionMessage('')
    setActionError(null)
    if (!file) return

    const fileError = validateCurriculumCsvFile(file)
    if (fileError) setActionError(clientFailure(fileError.status, fileError.code, fileError.message))
  }

  async function previewCurriculum() {
    const file = selectedFile
    if (!canWriteCatalog || !file || actionError) return
    const controller = new AbortController()
    previewControllerRef.current = controller
    setPreviewPending(true)
    setActionMessage('')
    setActionError(null)
    try {
      const preview = await client.previewCsv(file, accessToken, controller.signal)
      if (previewControllerRef.current === controller && selectedFileRef.current === file) {
        setFilePreview({ file, preview })
      }
    } catch (error) {
      if (!controller.signal.aborted
        && previewControllerRef.current === controller
        && selectedFileRef.current === file) {
        setActionError(asApiFailure(error))
      }
    } finally {
      if (previewControllerRef.current === controller) {
        previewControllerRef.current = null
        setPreviewPending(false)
      }
    }
  }

  async function importCurriculum() {
    if (!canWriteCatalog || !selectedFile || filePreview?.file !== selectedFile || actionError) return
    setActionPending(true)
    setActionMessage('')
    setActionError(null)
    try {
      const created = await client.importCsv(selectedFile, accessToken)
      selectedFileRef.current = null
      setSelectedFile(null)
      setFilePreview(null)
      setActionMessage(`Borrador creado: versión ${created.curriculumVersion}.`)
      setSelectedDraft(null)
      setDraftsError('')
      setDraftsState('loading')
      setDraftCursors([null])
      setDraftPage(1)
      setDraftRefresh((current) => current + 1)
    } catch (error) {
      setActionError(asApiFailure(error))
    } finally {
      setActionPending(false)
    }
  }

  async function reviewCurriculum(curriculumId: string) {
    setReviewingDraftId(curriculumId)
    setSelectedDraft(null)
    setActionMessage('')
    setActionError(null)
    try {
      setSelectedDraft(await client.getCurriculum(curriculumId, accessToken))
    } catch (error) {
      setActionError(asApiFailure(error))
    } finally {
      setReviewingDraftId('')
    }
  }

  async function publishCurriculum(curriculumId: string) {
    if (!canWriteCatalog) return
    setActionPending(true)
    setActionMessage('')
    setActionError(null)
    try {
      const published = await client.publishCurriculum(curriculumId, accessToken)
      setSelectedDraft(null)
      setActionMessage(`Currículo publicado: versión ${published.curriculum.curriculumVersion}.`)
      setDraftsState('loading')
      setDraftRefresh((current) => current + 1)
      onPublished()
    } catch (error) {
      setActionError(asApiFailure(error))
    } finally {
      setActionPending(false)
    }
  }

  function retryDrafts() {
    setDraftsState('loading')
    setDraftsError('')
    setDraftRefresh((count) => count + 1)
  }

  function changeDraftPage(nextPage: number) {
    if (nextPage > draftPage) {
      const nextCursor = draftsPageData?.nextCursor
      if (!nextCursor) return
      setDraftCursors((current) => [...current.slice(0, draftPage), nextCursor])
    }
    setDraftsState('loading')
    setDraftsError('')
    setDraftPage(Math.max(1, nextPage))
  }

  const draftTotalItems = draftsPageData?.totalItems ?? 0

  return (
    <section className="catalog-admin" aria-labelledby="catalog-admin-title">
      <CatalogAdminHeading />
      <CurriculumTemplateDownload />
      <div className="catalog-admin-grid">
        {canWriteCatalog && (
          <section className="catalog-upload-card" aria-labelledby="catalog-upload-title">
            <p className="catalog-eyebrow">IMPORTAR PLAN</p>
            <h3 id="catalog-upload-title">Crear borrador desde CSV</h3>
            <p>El archivo completo se valida antes de guardarse. Límite: 2 MiB.</p>
            <label className="catalog-file-picker" htmlFor="catalog-csv-file">
              <span className="catalog-file-icon" aria-hidden="true">↑</span>
              <span><strong>{selectedFile?.name ?? 'Seleccionar archivo CSV'}</strong><small>UTF-8 · máximo 2 MiB</small></span>
              <span className="catalog-file-action">Elegir</span>
            </label>
            <input
              accept=".csv,text/csv,application/vnd.ms-excel"
              className="catalog-file-input"
              disabled={actionPending || previewPending}
              id="catalog-csv-file"
              onChange={chooseFile}
              type="file"
            />
            <button
              className="catalog-button catalog-button-primary"
              disabled={!selectedFile || Boolean(actionError) || actionPending || previewPending}
              onClick={filePreview?.file === selectedFile ? importCurriculum : previewCurriculum}
              type="button"
            >
              {previewPending ? 'Validando…' : actionPending ? 'Procesando…' : filePreview?.file === selectedFile ? 'Crear borrador' : 'Validar CSV'} <span aria-hidden="true">→</span>
            </button>
          </section>
        )}

        <section className="catalog-drafts-card" aria-labelledby="catalog-drafts-title">
          <div className="catalog-drafts-heading"><div><p className="catalog-eyebrow">REVISIÓN</p><h3 id="catalog-drafts-title">Borradores</h3></div><span className="catalog-count">{draftTotalItems.toLocaleString('es-CO').padStart(2, '0')}</span></div>
          {draftsState === 'loading' && <p className="catalog-loading" role="status">Cargando borradores…</p>}
          {draftsState === 'error' && <div className="catalog-inline-error" role="alert"><p>{draftsError}</p><button className="catalog-button catalog-button-secondary" onClick={retryDrafts} type="button">Reintentar</button></div>}
          {draftsState === 'ready' && draftTotalItems === 0 && <p className="catalog-drafts-empty">No hay borradores pendientes de revisión.</p>}
          {draftsState === 'ready' && drafts.length > 0 && (
            <ul className="catalog-draft-list">
              {drafts.map((draft) => (
                <li className="catalog-draft-row" key={draft.id}>
                  <span className="catalog-draft-status" aria-hidden="true">●</span>
                  <span className="catalog-draft-copy"><strong>{draft.programName}</strong><small>Versión {draft.curriculumVersion} · cohorte {draft.cohortFrom}</small></span>
                  <button className="catalog-button catalog-button-secondary" disabled={reviewingDraftId === draft.id} onClick={() => reviewCurriculum(draft.id)} type="button">
                    {reviewingDraftId === draft.id ? 'Abriendo…' : `Revisar ${draft.curriculumVersion}`}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {draftsState === 'ready' && draftsPageData
            && (draftPage > 1 || Boolean(draftsPageData.nextCursor)) && (
              <nav className="catalog-curriculum-pagination" aria-label="Paginación de borradores">
                <span>
                  Página {draftPage} · {drafts.length} {drafts.length === 1 ? 'visible' : 'visibles'}
                  {' · '}{draftTotalItems} pendientes
                </span>
                <div>
                  <button
                    aria-label="Página anterior de borradores"
                    className="catalog-button catalog-button-secondary"
                    disabled={draftPage === 1}
                    onClick={() => changeDraftPage(draftPage - 1)}
                    type="button"
                  >
                    Anterior
                  </button>
                  <span aria-live="polite">Página {draftPage}</span>
                  <button
                    aria-label="Página siguiente de borradores"
                    className="catalog-button catalog-button-secondary"
                    disabled={!draftsPageData.nextCursor}
                    onClick={() => changeDraftPage(draftPage + 1)}
                    type="button"
                  >
                    Siguiente
                  </button>
                </div>
              </nav>
            )}
        </section>
      </div>

      {filePreview?.file === selectedFile && <CurriculumImportPreviewPanel preview={filePreview.preview} />}

      {selectedDraft && (
        <section className="catalog-review-card" aria-labelledby="catalog-review-title">
          <div className="catalog-review-heading"><div><p className="catalog-eyebrow">REVISIÓN DEL BORRADOR</p><h3 id="catalog-review-title">{selectedDraft.curriculum.programName} · {selectedDraft.curriculum.curriculumVersion}</h3><p>Cohorte {cohortLabel(selectedDraft.curriculum)}</p></div>
            {canWriteCatalog && <button className="catalog-button catalog-button-primary" disabled={actionPending} onClick={() => publishCurriculum(selectedDraft.curriculum.id)} type="button">{actionPending ? 'Publicando…' : `Publicar ${selectedDraft.curriculum.curriculumVersion}`}</button>}
          </div>
          <div className="catalog-review-table-wrap">
            <table className="catalog-review-table"><caption>Actividades curriculares del plan en revisión</caption>
              <thead><tr><th scope="col">Semestre</th><th scope="col">Código</th><th scope="col">Asignatura</th><th scope="col">Créditos</th><th scope="col">Espacio</th><th scope="col">Componente</th></tr></thead>
              <tbody>{selectedDraft.entries.map((entry) => <tr key={`${entry.subjectRevisionId}-${entry.rowOrder}`}><td>{entry.semester}</td><td>{entry.subjectCode}</td><td>{entry.subjectName}</td><td>{entry.credits}</td><td>{entry.formationSpace}</td><td>{entry.component}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}

      {actionMessage && <p className="catalog-action-success" role="status">{actionMessage}</p>}
      {actionError && <ActionError error={actionError} />}
    </section>
  )
}

function CurriculumImportPreviewPanel({ preview }: { preview: CurriculumImportPreview }) {
  const numberFormat = new Intl.NumberFormat('es-CO')
  return (
    <section className="catalog-import-preview" aria-labelledby="catalog-import-preview-title">
      <div className="catalog-import-preview-heading">
        <div><p className="catalog-eyebrow">VALIDACIÓN SIN GUARDAR</p><h3 id="catalog-import-preview-title">{preview.programName} · versión {preview.curriculumVersion}</h3></div>
        <span className="catalog-preview-valid"><span aria-hidden="true">✓</span> CSV válido</span>
      </div>
      <dl className="catalog-import-preview-meta">
        <div><dt>Programa</dt><dd>{preview.programCode}</dd></div>
        <div><dt>Código SNIES</dt><dd>{preview.sniesCode ?? 'Sin código'}</dd></div>
        <div><dt>Facultad declarada en el archivo</dt><dd>{preview.faculty}</dd></div>
        <div><dt>Sede declarada en el archivo</dt><dd>{preview.campusName} · {preview.campusCode}</dd></div>
        <div><dt>Cohortes</dt><dd>{preview.cohortFrom} a {preview.cohortThrough ?? 'sin fecha final'}</dd></div>
        <div><dt>Referencia</dt><dd>{preview.approvalReference}</dd></div>
        <div><dt>Semestres</dt><dd>{preview.semesters.join(', ')}</dd></div>
      </dl>
      <p className="catalog-import-preview-note">Facultad y sede se conservan como datos del archivo de origen; la adscripción vigente se administra en estructura académica.</p>
      <p className="catalog-import-preview-count">{numberFormat.format(preview.entryCount)} asignaturas · {numberFormat.format(preview.semesters.length)} {preview.semesters.length === 1 ? 'semestre' : 'semestres'}</p>
      {preview.comparison && (
        <Suspense fallback={<p className="catalog-import-preview-note" role="status">Cargando comparación…</p>}>
          <CurriculumVersionComparisonPanel comparison={preview.comparison} />
        </Suspense>
      )}
      <div className="catalog-review-table-wrap">
        <table className="catalog-review-table">
          <caption>Muestra de hasta 10 asignaturas de la carga</caption>
          <thead><tr><th scope="col">Fila</th><th scope="col">Semestre</th><th scope="col">Código</th><th scope="col">Asignatura</th><th scope="col">Créditos</th><th scope="col">Espacio</th><th scope="col">Componente</th><th scope="col">Grupo de opción</th></tr></thead>
          <tbody>{preview.sampleEntries.map((entry) => (
            <tr key={`${entry.sourceRowNumber}-${entry.rowOrder}`}>
              <td>{entry.sourceRowNumber}</td><td>{entry.semester}</td><td>{entry.subjectCode}</td><td>{entry.subjectName}</td><td>{entry.credits}</td><td>{entry.formationSpace}</td><td>{entry.component}</td><td>{entry.choiceGroup ?? '—'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p className="catalog-import-preview-note">Al crear el borrador, el servidor volverá a validar el archivo completo antes de guardarlo.</p>
    </section>
  )
}

function LockedCatalogAdministration() {
  return (
    <section className="catalog-admin" aria-labelledby="catalog-admin-title">
      <CatalogAdminHeading />
      <div className="catalog-admin-locked" role="status">
        <span aria-hidden="true">◌</span>
        <div><strong>Funciones administrativas cerradas</strong><p>La revisión de borradores y las acciones de publicación requieren acceso y permisos institucionales.</p></div>
        <span className="catalog-locked-tag">Sin sesión institucional</span>
      </div>
      <CurriculumTemplateDownload />
    </section>
  )
}

function CurriculumTemplateDownload() {
  return (
    <a
      className="catalog-button catalog-button-secondary catalog-template-download"
      href="/api/v1/academic-catalog/curriculum-template"
      download="academic-curriculum-template.csv"
    >
      Descargar plantilla CSV
    </a>
  )
}

function CatalogAdminHeading() {
  return (
    <div className="catalog-admin-heading">
      <div className="catalog-admin-mark" aria-hidden="true">⌘</div>
      <div><p className="catalog-eyebrow">GESTIÓN ACADÉMICA</p><h2 id="catalog-admin-title">Administración del catálogo</h2></div>
      <span className="catalog-admin-lock">◈ <span>Acceso controlado</span></span>
    </div>
  )
}

function CurriculumCard({ curriculum, siteName, onView }: { curriculum: AcademicCurriculum; siteName: string; onView: () => void }) {
  return (
    <article className="catalog-curriculum-card" aria-label={`Versión ${curriculum.curriculumVersion}`}>
      <div className="catalog-curriculum-card-top"><span className="catalog-version-label">VERSIÓN</span><span className="catalog-published-indicator"><i aria-hidden="true" /> Publicado</span></div>
      <h3>{curriculum.curriculumVersion}</h3>
      <div className="catalog-cohort-band"><span aria-hidden="true">◷</span><span><small>COHORTE</small><strong>{cohortLabel(curriculum)}</strong></span><span className="catalog-card-arrow" aria-hidden="true">↗</span></div>
      <div className="catalog-curriculum-card-bottom"><span>{curriculum.entryCount} actividades</span><span>{siteName}</span></div>
      <button
        aria-label={`Ver asignaturas de la versión ${curriculum.curriculumVersion}`}
        className="catalog-button catalog-button-secondary catalog-curriculum-view"
        onClick={onView}
        type="button"
      >
        Ver asignaturas <span aria-hidden="true">↗</span>
      </button>
    </article>
  )
}

function ActionError({ error }: { error: ApiFailure }) {
  const title = error.status === 403 || error.code === 'forbidden'
    ? 'No tienes permiso para esta acción.'
    : error.status === 401 || error.code === 'unauthorized'
      ? 'Tu acceso institucional no está autenticado.'
      : error.status === 409 || error.code === 'curriculum_conflict'
        ? 'El borrador ya cambió de estado. Actualiza la lista y revisa su versión actual.'
        : error.code === 'file_too_large' || error.status === 413
          ? 'El archivo supera el límite de 2 MiB.'
          : error.code === 'unsupported_file_type'
            ? 'Selecciona un archivo con formato CSV.'
            : error.message || 'No se pudo completar la acción.'

  return (
    <div className="catalog-action-error" role="alert">
      <strong>{title}</strong>
      {error.issues && error.issues.length > 0 && (
        <ul>{error.issues.map((issue, index) => <li key={`${issue.rowNumber}-${issue.column}-${index}`}>{issue.rowNumber ? `Fila ${issue.rowNumber}` : 'Archivo'}{issue.column ? ` · ${issue.column}` : ''} · {issue.code}</li>)}</ul>
      )}
    </div>
  )
}

function cohortLabel(curriculum: AcademicCurriculum): string {
  return `${curriculum.cohortFrom}${curriculum.cohortThrough ? ` — ${curriculum.cohortThrough}` : ' — sin término definido'}`
}


function resolveProgramPlacements(
  programs: readonly AcademicProgram[],
  structure: AcademicStructureSnapshot,
): Record<string, ProgramPlacement> {
  const unitsById = new Map(structure.units.map((unit) => [unit.id, unit.displayName]))
  const sitesById = new Map(structure.sites.map((site) => [site.id, site.displayName]))
  const affiliationsByProgramId = new Map<string, typeof structure.programAffiliations>()
  for (const affiliation of structure.programAffiliations) {
    const affiliations = affiliationsByProgramId.get(affiliation.programId) ?? []
    affiliations.push(affiliation)
    affiliationsByProgramId.set(affiliation.programId, affiliations)
  }

  return Object.fromEntries(programs.map((program) => {
    const affiliations = affiliationsByProgramId.get(program.id) ?? []
    if (affiliations.length !== 1) return [program.id, PENDING_PROGRAM_PLACEMENT]

    const affiliation = affiliations[0]
    const organizationUnitName = unitsById.get(affiliation.organizationUnitId)
    const siteName = sitesById.get(affiliation.siteId)
    if (!organizationUnitName || !siteName) return [program.id, PENDING_PROGRAM_PLACEMENT]

    return [program.id, {
      organizationUnitName,
      siteName,
      displayName: `${organizationUnitName} · ${siteName}`,
    }]
  }))
}

function clientFailure(status: number, code: string, message: string): ApiFailure {
  return Object.assign(new Error(message), { status, code, issues: [] as readonly AcademicCatalogIssue[] })
}

function asApiFailure(error: unknown): ApiFailure {
  if (error instanceof Error) {
    const candidate = error as ApiFailure
    return {
      message: candidate.message,
      name: candidate.name,
      status: candidate.status,
      code: candidate.code,
      issues: Array.isArray(candidate.issues) ? candidate.issues : [],
    }
  }
  return clientFailure(0, 'request_failed', 'No se pudo completar la solicitud. Comprueba la conexión e inténtalo de nuevo.')
}
