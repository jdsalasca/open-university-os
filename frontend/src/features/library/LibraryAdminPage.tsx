import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { LibraryApiError, LIST_LIMIT } from './libraryClient'
import { libraryClient as defaultLibraryClient } from './libraryClient'
import type { LibraryClient } from './libraryClient'
import type {
  LibraryAuthorization,
  LibraryCopy,
  LibraryLoan,
  LibraryTitle,
} from './libraryContracts'
import './LibraryAdminPage.scss'

interface LibraryAdminPageProps {
  client?: LibraryClient
  authorization: LibraryAuthorization | null
  onAuthorizationRejected?: (accessToken: string) => Promise<void>
}

const LOAD_ERROR = 'No fue posible consultar la biblioteca. Verifica tu sesión y vuelve a intentarlo.'
const ACTION_ERROR = 'No fue posible completar la operación. Revisa los datos e inténtalo de nuevo.'
const REFRESH_ERROR = 'La operación se aplicó, pero no fue posible actualizar la vista. Vuelve a consultar.'
const REJECTED_ERROR = 'El servidor rechazó la sesión y no fue posible revalidarla. Inicia sesión de nuevo.'

export function LibraryAdminPage({ client = defaultLibraryClient, authorization, onAuthorizationRejected }: LibraryAdminPageProps) {
  if (!authorization?.canRead) return null
  return <LibraryAdminPageContent
    key={authorization.accessToken}
    client={client}
    authorization={authorization}
    onAuthorizationRejected={onAuthorizationRejected}
  />
}

function LibraryAdminPageContent({
  client,
  authorization,
  onAuthorizationRejected,
}: {
  client: LibraryClient
  authorization: LibraryAuthorization
  onAuthorizationRejected?: (accessToken: string) => Promise<void>
}) {
  const { accessToken, canWrite } = authorization
  const [openLoans, setOpenLoans] = useState<LibraryLoan[]>([])
  const [titles, setTitles] = useState<LibraryTitle[]>([])
  const [copies, setCopies] = useState<LibraryCopy[]>([])
  const [selectedTitleId, setSelectedTitleId] = useState('')
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [copiesFailed, setCopiesFailed] = useState(false)
  const [withdrawReference, setWithdrawReference] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)
  const [returnReference, setReturnReference] = useState('')
  const [returning, setReturning] = useState(false)
  const [titleQueryInput, setTitleQueryInput] = useState('')
  const [titleQuery, setTitleQuery] = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [foundCopy, setFoundCopy] = useState<LibraryCopy | null>(null)
  const [barcodeError, setBarcodeError] = useState<string | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const copiesReadController = useRef<AbortController | null>(null)

  /** A refused bearer means the cached permissions are stale, so the institutional session is revalidated. */
  const reportAuthorizationRejection = useCallback(async (error: unknown) => {
    if (error instanceof LibraryApiError && (error.status === 401 || error.status === 403)) {
      try {
        await onAuthorizationRejected?.(accessToken)
      } catch {
        setLoadError(REJECTED_ERROR)
      }
    }
  }, [accessToken, onAuthorizationRejected])

  const fetchCatalogue = useCallback(async (query: string, signal: AbortSignal) => {
    try {
      const [loans, catalogue] = await Promise.all([
        client.getOpenLoans(accessToken, signal),
        client.getTitles(query, accessToken, signal),
      ])
      if (signal.aborted) return
      setOpenLoans(loans)
      setTitles(catalogue)
      setLoadError(null)
      setLoadState('ready')
    } catch (error) {
      if (signal.aborted) return
      setLoadError(error instanceof LibraryApiError && error.status === 401
        ? 'La sesión no autoriza la lectura de la biblioteca.'
        : LOAD_ERROR)
      setLoadState('error')
      await reportAuthorizationRejection(error)
    }
  }, [accessToken, client, reportAuthorizationRejection])

  useEffect(() => {
    const controller = new AbortController()
    // Deferred so the initial load is not a synchronous setState inside the effect.
    const handle = setTimeout(() => { void fetchCatalogue('', controller.signal) }, 0)
    return () => {
      clearTimeout(handle)
      controller.abort()
    }
  }, [fetchCatalogue])

  useEffect(() => () => copiesReadController.current?.abort(), [])

  function reload() {
    setLoadState('loading')
    setLoadError(null)
    void fetchCatalogue(titleQuery, new AbortController().signal)
  }

  const selectTitle = useCallback(async (titleId: string) => {
    copiesReadController.current?.abort()
    copiesReadController.current = null
    setSelectedTitleId(titleId)
    setCopies([])
    setActionError(null)
    setCopiesFailed(false)
    if (!titleId) return
    const controller = new AbortController()
    copiesReadController.current = controller
    try {
      const nextCopies = await client.getCopies(titleId, accessToken, controller.signal)
      if (controller.signal.aborted) return
      setCopies(nextCopies)
    } catch (error) {
      if (controller.signal.aborted) return
      // An unreadable shelf is not an empty shelf: the list must not claim there are no copies.
      setCopiesFailed(true)
      setActionError(LOAD_ERROR)
      await reportAuthorizationRejection(error)
    } finally {
      if (copiesReadController.current === controller) copiesReadController.current = null
    }
  }, [accessToken, client, reportAuthorizationRejection])

  async function registerReturn(loanId: string) {
    if (!canWrite || returnReference.trim().length === 0) return
    setActionError(null)
    setReturning(true)
    try {
      await client.returnLoan(loanId, returnReference.trim(), accessToken)
      setReturnReference('')
      await fetchCatalogue(titleQuery, new AbortController().signal)
    } catch (error) {
      setActionError(ACTION_ERROR)
      await reportAuthorizationRejection(error)
    } finally {
      setReturning(false)
    }
  }

  /** A withdrawal is shared by the title list and the barcode lookup; each caller refreshes its own view. */
  async function performWithdraw(copyId: string): Promise<boolean> {
    if (!canWrite || withdrawReference.trim().length === 0) return false
    setActionError(null)
    setWithdrawing(true)
    try {
      await client.withdrawCopy(copyId, withdrawReference.trim(), accessToken)
      setWithdrawReference('')
      return true
    } catch (error) {
      setActionError(ACTION_ERROR)
      await reportAuthorizationRejection(error)
      return false
    } finally {
      setWithdrawing(false)
    }
  }

  /** A write that succeeded but whose follow-up read failed must say so instead of leaving a stale view. */
  async function refreshAfterWrite(reread: () => Promise<void>) {
    try {
      await reread()
    } catch (error) {
      setActionError(REFRESH_ERROR)
      await reportAuthorizationRejection(error)
    }
  }

  async function withdraw(copyId: string) {
    if (await performWithdraw(copyId)) {
      await refreshAfterWrite(async () => { setCopies(await client.getCopies(selectedTitleId, accessToken)) })
    }
  }

  async function lookUpBarcode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const barcode = barcodeInput.trim()
    if (barcode.length === 0) return
    setBarcodeError(null)
    setFoundCopy(null)
    setLookingUp(true)
    try {
      setFoundCopy(await client.copyOfBarcode(barcode, accessToken))
    } catch (error) {
      setBarcodeError(error instanceof LibraryApiError && error.status === 404
        ? 'No hay ningún ejemplar con ese código de barras.'
        : LOAD_ERROR)
      await reportAuthorizationRejection(error)
    } finally {
      setLookingUp(false)
    }
  }

  async function withdrawFoundCopy() {
    if (!foundCopy) return
    const barcode = foundCopy.barcode
    if (await performWithdraw(foundCopy.copyId)) {
      await refreshAfterWrite(async () => { setFoundCopy(await client.copyOfBarcode(barcode, accessToken)) })
    }
  }

  async function registerTitle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canWrite) return
    // React nulls currentTarget after the handler returns, so the element is captured before any await.
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    setActionError(null)
    try {
      await client.registerTitle({
        title: String(form.get('title') ?? '').trim(),
        authors: [String(form.get('author') ?? '').trim()].filter((author) => author.length > 0),
        edition: String(form.get('edition') ?? '').trim(),
        publicationYear: form.get('publicationYear') ? Number(form.get('publicationYear')) : null,
        sourceReference: String(form.get('reference') ?? '').trim(),
      }, accessToken)
    } catch (error) {
      setActionError(ACTION_ERROR)
      await reportAuthorizationRejection(error)
      return
    }
    // The write succeeded; a later refresh failure must not be reported as a failed registration.
    formElement.reset()
    await fetchCatalogue(titleQuery, new AbortController().signal)
  }

  async function registerCopy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canWrite || !selectedTitleId) return
    // React nulls currentTarget after the handler returns, so the element is captured before any await.
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    setActionError(null)
    try {
      await client.registerCopy(selectedTitleId, {
        barcode: String(form.get('barcode') ?? '').trim(),
        location: String(form.get('location') ?? '').trim(),
        sourceReference: String(form.get('reference') ?? '').trim(),
      }, accessToken)
    } catch (error) {
      setActionError(ACTION_ERROR)
      await reportAuthorizationRejection(error)
      return
    }
    // The write succeeded; a later refresh failure must not be reported as a failed registration.
    formElement.reset()
    await selectTitle(selectedTitleId)
  }

  // The desk already receives the overdue flag per loan, so narrowing is a local view concern.
  const visibleLoans = overdueOnly ? openLoans.filter((loan) => loan.overdue) : openLoans

  return (
    <section className="library-admin" aria-labelledby="library-admin-title">
      <header className="library-admin-heading">
        <p className="library-admin-kicker">SERVICIOS BIBLIOGRÁFICOS</p>
        <h1 id="library-admin-title">Biblioteca</h1>
        <p>Catálogo, ejemplares en circulación y préstamos pendientes. No registra datos personales de lectores.</p>
      </header>

      {loadState === 'loading' && <p className="library-status" role="status">Consultando la biblioteca…</p>}
      {loadState === 'error' && <div className="library-error" role="alert">
        <p>{loadError}</p>
        <button type="button" onClick={reload}>Reintentar</button>
      </div>}
      {actionError && <p className="library-error" role="alert">{actionError}</p>}

      {loadState === 'ready' && <>
        <section className="library-section" aria-labelledby="library-open-loans-title">
          <h2 id="library-open-loans-title">Préstamos pendientes</h2>
          {openLoans.length > 0 && (
            <label className="library-field library-overdue-filter">
              <input
                type="checkbox"
                aria-label="Solo vencidos"
                checked={overdueOnly}
                onChange={(event) => setOverdueOnly(event.currentTarget.checked)}
              />
              <span>Solo vencidos</span>
            </label>
          )}
          {openLoans.length === 0
            ? <p className="library-empty">No hay ejemplares pendientes de devolución.</p>
            : visibleLoans.length === 0
              ? <p className="library-empty">No hay préstamos vencidos.</p>
              : <ul className="library-loans">
                {visibleLoans.map((loan) => (
                  <li key={loan.loanId} className="library-loan">
                    <span className="library-loan-due">
                      <span className="library-loan-caption">Vence</span>
                      <time dateTime={loan.dueOn}>{loan.dueOn}</time>
                    </span>
                    {loan.overdue && <span className="library-loan-overdue">Vencido</span>}
                    <span className="library-loan-reference">{loan.sourceReference}</span>
                    {canWrite && (
                      <button
                        type="button"
                        disabled={returning || returnReference.trim().length === 0}
                        onClick={() => void registerReturn(loan.loanId)}
                      >
                        Registrar devolución
                      </button>
                    )}
                  </li>
                ))}
              </ul>}
          {openLoans.length >= LIST_LIMIT && (
            <p className="library-hint">Mostrando los primeros {LIST_LIMIT} préstamos pendientes.</p>
          )}
          {canWrite && visibleLoans.length > 0 && (
            <label className="library-field">
              <span>Referencia institucional de la devolución</span>
              <input
                aria-label="Referencia institucional de la devolución"
                value={returnReference}
                maxLength={240}
                onChange={(event) => setReturnReference(event.currentTarget.value)}
              />
            </label>
          )}
        </section>

        <section className="library-section" aria-labelledby="library-catalogue-title">
          <h2 id="library-catalogue-title">Catálogo</h2>
          <form className="library-form" onSubmit={(event) => {
            event.preventDefault()
            setLoadState('loading')
            const nextQuery = titleQueryInput.trim()
            setTitleQuery(nextQuery)
            // Fetch explicitly so re-submitting the same text still refreshes instead of hanging on loading.
            void fetchCatalogue(nextQuery, new AbortController().signal)
          }}>
            <label className="library-field">
              <span>Buscar título</span>
              <input
                aria-label="Buscar título"
                value={titleQueryInput}
                maxLength={240}
                onChange={(event) => setTitleQueryInput(event.currentTarget.value)}
              />
            </label>
            <button type="submit">Buscar</button>
          </form>

          <form className="library-form" onSubmit={(event) => void lookUpBarcode(event)}>
            <h3>Buscar ejemplar por código de barras</h3>
            <label className="library-field">
              <span>Código de barras del ejemplar</span>
              <input
                aria-label="Código de barras del ejemplar"
                value={barcodeInput}
                maxLength={48}
                onChange={(event) => setBarcodeInput(event.currentTarget.value)}
              />
            </label>
            <button type="submit" disabled={lookingUp}>Buscar ejemplar</button>
            {barcodeError && <p className="library-error" role="alert">{barcodeError}</p>}
            {foundCopy && (
              <ul className="library-copies">
                <li className="library-copy">
                  <span className="library-copy-barcode">{foundCopy.barcode}</span>
                  <span className="library-copy-location">{foundCopy.location}</span>
                  <span className={foundCopy.active ? 'library-copy-active' : 'library-copy-inactive'}>
                    {foundCopy.active
                      ? 'En circulación'
                      : foundCopy.withdrawnReference
                        ? `Retirado · ${foundCopy.withdrawnReference}`
                        : 'Retirado'}
                  </span>
                  {canWrite && foundCopy.active && (
                    <button
                      type="button"
                      disabled={withdrawing || withdrawReference.trim().length === 0}
                      onClick={() => void withdrawFoundCopy()}
                    >
                      Retirar
                    </button>
                  )}
                </li>
              </ul>
            )}
          </form>
          {titles.length === 0
            ? <p className="library-empty">{titleQuery
              ? 'No hay títulos que coincidan con la búsqueda.'
              : 'Todavía no hay títulos registrados.'}</p>
            : <>
              {titles.length >= LIST_LIMIT && (
                <p className="library-hint">Mostrando los primeros {LIST_LIMIT} títulos del catálogo.</p>
              )}
              <label className="library-field">
                <span>Seleccionar título</span>
                <select
                  aria-label="Seleccionar título"
                  value={selectedTitleId}
                  onChange={(event) => void selectTitle(event.currentTarget.value)}
                >
                  <option value="">Selecciona un título</option>
                  {titles.map((title) => (
                    <option key={title.titleId} value={title.titleId}>
                      {title.title}{title.edition ? ` · ${title.edition}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              {selectedTitleId && (!copiesFailed && (copies.length === 0
                ? <p className="library-empty">Este título no tiene ejemplares registrados.</p>
                : <ul className="library-copies">
                  {copies.map((copy) => (
                    <li key={copy.copyId} className="library-copy">
                      <span className="library-copy-barcode">{copy.barcode}</span>
                      <span className="library-copy-location">{copy.location}</span>
                      <span className={copy.active ? 'library-copy-active' : 'library-copy-inactive'}>
                        {copy.active
                          ? 'En circulación'
                          : copy.withdrawnReference
                            ? `Retirado · ${copy.withdrawnReference}`
                            : 'Retirado'}
                      </span>
                      {canWrite && copy.active && (
                        <button
                          type="button"
                          disabled={withdrawing || withdrawReference.trim().length === 0}
                          onClick={() => void withdraw(copy.copyId)}
                        >
                          Retirar
                        </button>
                      )}
                    </li>
                  ))}
                </ul>))}
            </>}
        </section>
      </>}

      {canWrite && (
        <section className="library-section" aria-labelledby="library-register-title">
          <h2 id="library-register-title">Registrar</h2>

          <form className="library-form" onSubmit={(event) => void registerTitle(event)}>
            <h3>Nuevo título</h3>
            <label className="library-field"><span>Título de la obra</span>
              <input name="title" required maxLength={240} /></label>
            <label className="library-field"><span>Autor</span>
              <input name="author" required maxLength={160} /></label>
            <label className="library-field"><span>Edición</span>
              <input name="edition" required maxLength={80} /></label>
            <label className="library-field"><span>Año</span>
              <input name="publicationYear" type="number" min={1450} max={2200} /></label>
            <label className="library-field"><span>Referencia institucional</span>
              <input name="reference" required maxLength={240} /></label>
            <button type="submit">Registrar título</button>
          </form>

          {selectedTitleId && (
            <form className="library-form" onSubmit={(event) => void registerCopy(event)}>
              <h3>Nuevo ejemplar</h3>
              <label className="library-field"><span>Código de barras</span>
                <input name="barcode" required maxLength={48} /></label>
              <label className="library-field"><span>Ubicación</span>
                <input name="location" required maxLength={120} /></label>
              <label className="library-field"><span>Referencia institucional del ejemplar</span>
                <input name="reference" required maxLength={240} /></label>
              <button type="submit">Registrar ejemplar</button>
            </form>
          )}

          <label className="library-field">
            <span>Referencia institucional del retiro</span>
            <input
              aria-label="Referencia institucional del retiro"
              value={withdrawReference}
              maxLength={240}
              onChange={(event) => setWithdrawReference(event.currentTarget.value)}
            />
          </label>
          <p className="library-hint">La referencia es obligatoria para retirar un ejemplar de circulación.</p>
        </section>
      )}
    </section>
  )
}
