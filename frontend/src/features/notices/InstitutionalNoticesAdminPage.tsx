import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { noticesAdminClient as defaultClient } from './noticesAdminClient'
import type { NoticesAdminClient } from './noticesAdminClient'
import type { AdminNotice, NoticesAdminAuthorization, PublishNoticeInput } from './noticesAdminContracts'
import type { NoticeAudience, NoticeAudienceKind } from './noticesContracts'
import './InstitutionalNoticesAdminPage.scss'

interface InstitutionalNoticesAdminPageProps {
  client?: NoticesAdminClient
  authorization: NoticesAdminAuthorization | null
}

const LOAD_ERROR = 'No fue posible consultar los avisos administrados. Verifica tu sesión e inténtalo de nuevo.'
const ACTION_ERROR = 'No fue posible publicar el aviso. Revisa los datos e inténtalo de nuevo.'

const AUDIENCE_KINDS: NoticeAudienceKind[] = ['UNIVERSITY', 'SITE', 'FACULTY', 'PROGRAM']

const AUDIENCE_LABELS: Record<NoticeAudienceKind, string> = {
  UNIVERSITY: 'Toda la universidad',
  SITE: 'Sede',
  FACULTY: 'Facultad',
  PROGRAM: 'Programa',
}

interface AudienceDraft {
  kind: NoticeAudienceKind
  reference: string
}

export function InstitutionalNoticesAdminPage({
  client = defaultClient,
  authorization,
}: InstitutionalNoticesAdminPageProps) {
  if (!authorization?.canRead) return null
  return <InstitutionalNoticesAdminPageContent
    key={authorization.accessToken}
    client={client}
    authorization={authorization}
  />
}

function InstitutionalNoticesAdminPageContent({
  client,
  authorization,
}: {
  client: NoticesAdminClient
  authorization: NoticesAdminAuthorization
}) {
  const { accessToken, canWrite } = authorization
  const [notices, setNotices] = useState<AdminNotice[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [audiences, setAudiences] = useState<AudienceDraft[]>([{ kind: 'UNIVERSITY', reference: '' }])
  const requestControllerRef = useRef<AbortController | null>(null)

  const fetchNotices = useCallback(async (signal: AbortSignal) => {
    try {
      const recent = await client.getRecent(accessToken, signal)
      if (signal.aborted) return
      setNotices(recent)
      setLoadError(null)
      setLoadState('ready')
    } catch {
      if (signal.aborted) return
      setLoadError(LOAD_ERROR)
      setLoadState('error')
    }
  }, [accessToken, client])

  const loadNotices = useCallback(() => {
    requestControllerRef.current?.abort()
    const controller = new AbortController()
    requestControllerRef.current = controller
    return fetchNotices(controller.signal).finally(() => {
      if (requestControllerRef.current === controller) requestControllerRef.current = null
    })
  }, [fetchNotices])

  useEffect(() => {
    // Deferred so the initial load is not a synchronous setState inside the effect.
    const handle = setTimeout(() => { void loadNotices() }, 0)
    return () => {
      clearTimeout(handle)
      requestControllerRef.current?.abort()
      requestControllerRef.current = null
    }
  }, [loadNotices])

  function reload() {
    setLoadState('loading')
    setLoadError(null)
    void loadNotices()
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canWrite) return
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const input: PublishNoticeInput = {
      title: String(form.get('title') ?? '').trim(),
      body: String(form.get('body') ?? '').trim(),
      sourceReference: String(form.get('reference') ?? '').trim(),
      publishedFrom: String(form.get('publishedFrom') ?? ''),
      publishedThrough: String(form.get('publishedThrough') ?? ''),
      audiences: audiences.map((audience) => audienceOf(audience)),
    }
    setActionError(null)
    setActionMessage(null)
    setPublishing(true)
    try {
      await client.publish(input, accessToken)
    } catch {
      setActionError(ACTION_ERROR)
      setPublishing(false)
      return
    }
    setPublishing(false)
    formElement.reset()
    setAudiences([{ kind: 'UNIVERSITY', reference: '' }])
    setActionMessage('Aviso publicado. Queda inmutable; una corrección es otro aviso.')
    await loadNotices()
  }

  return (
    <section className="notices-admin" aria-labelledby="notices-admin-title">
      <header className="notices-admin-heading">
        <p className="notices-admin-kicker">COMUNICACIONES INSTITUCIONALES</p>
        <h1 id="notices-admin-title">Avisos institucionales</h1>
        <p>Cada aviso se publica completo y no se edita; una corrección es otro aviso. La audiencia decide quién puede leerlo.</p>
      </header>

      {loadState === 'loading' && <p className="notices-admin-status" role="status">Consultando avisos…</p>}
      {loadState === 'error' && <div className="notices-admin-error" role="alert">
        <p>{loadError}</p>
        <button type="button" onClick={reload}>Reintentar avisos</button>
      </div>}
      {actionError && <p className="notices-admin-error" role="alert">{actionError}</p>}
      {actionMessage && <p className="notices-admin-status" role="status">{actionMessage}</p>}

      {loadState === 'ready' && (notices.length === 0
        ? <p className="notices-admin-empty">Todavía no hay avisos publicados.</p>
        : <ul className="notices-admin-list">
          {notices.map((notice) => (
            <li key={notice.noticeId} className="notices-admin-item">
              <div className="notices-admin-item-heading">
                <h2>{notice.title}</h2>
                <span className="notices-admin-window">
                  <time dateTime={notice.publishedFrom}>{notice.publishedFrom}</time>
                  {' – '}
                  <time dateTime={notice.publishedThrough}>{notice.publishedThrough}</time>
                </span>
              </div>
              <p className="notices-admin-body">{notice.body}</p>
              <dl className="notices-admin-trail">
                <div><dt>Referencia</dt><dd>{notice.sourceReference}</dd></div>
                <div><dt>Publicó</dt><dd>{notice.publishedBy}</dd></div>
              </dl>
              <p className="notices-admin-audiences">
                {notice.audiences.map((audience) => (
                  <span key={`${audience.kind}:${audience.reference ?? ''}`} className="notices-admin-audience">
                    {AUDIENCE_LABELS[audience.kind]}
                  </span>
                ))}
              </p>
            </li>
          ))}
        </ul>)}

      {canWrite && (
        <form className="notices-admin-form" aria-label="Publicar aviso institucional" onSubmit={(event) => void publish(event)}>
          <h2>Publicar aviso</h2>
          <label className="notices-admin-field"><span>Título</span>
            <input name="title" required maxLength={160} /></label>
          <label className="notices-admin-field"><span>Cuerpo</span>
            <textarea name="body" required maxLength={2000} rows={4} /></label>
          <label className="notices-admin-field"><span>Referencia institucional</span>
            <input name="reference" required maxLength={240} /></label>
          <div className="notices-admin-dates">
            <label className="notices-admin-field"><span>Vigente desde</span>
              <input name="publishedFrom" type="date" required /></label>
            <label className="notices-admin-field"><span>Vigente hasta</span>
              <input name="publishedThrough" type="date" required /></label>
          </div>

          <fieldset className="notices-admin-audience-editor">
            <legend>Audiencias</legend>
            {audiences.map((audience, index) => (
              <div className="notices-admin-audience-row" key={`audience-${index}`}>
                <label className="notices-admin-field"><span>{`Audiencia ${index + 1}`}</span>
                  <select
                    aria-label={`Audiencia ${index + 1}`}
                    value={audience.kind}
                    onChange={(event) => {
                      // The state updater can run later, when currentTarget is already null.
                      const kind = event.currentTarget.value as NoticeAudienceKind
                      setAudiences((current) => current.map((item, position) => position === index
                        ? { kind, reference: '' }
                        : item))
                    }}
                  >
                    {AUDIENCE_KINDS.map((kind) => <option key={kind} value={kind}>{AUDIENCE_LABELS[kind]}</option>)}
                  </select>
                </label>
                {audience.kind !== 'UNIVERSITY' && (
                  <label className="notices-admin-field"><span>{`Referencia de la audiencia ${index + 1}`}</span>
                    <input
                      aria-label={`Referencia de la audiencia ${index + 1}`}
                      required
                      maxLength={64}
                      value={audience.reference}
                      onChange={(event) => {
                        // The state updater can run later, when currentTarget is already null.
                        const reference = event.currentTarget.value
                        setAudiences((current) => current.map((item, position) => position === index
                          ? { ...item, reference }
                          : item))
                      }}
                    /></label>
                )}
                {audiences.length > 1 && (
                  <button type="button" onClick={() => setAudiences((current) => current.filter((_, position) => position !== index))}>
                    Quitar audiencia
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setAudiences((current) => [...current, { kind: 'SITE', reference: '' }])}>
              Añadir audiencia
            </button>
          </fieldset>

          <button type="submit" disabled={publishing}>{publishing ? 'Publicando…' : 'Publicar aviso'}</button>
          <p className="notices-admin-hint">
            La audiencia «Toda la universidad» no lleva referencia. Un ámbito más estrecho exige la referencia estable
            publicada por estructura o catálogo; no escribas códigos inventados.
          </p>
        </form>
      )}
    </section>
  )
}

function audienceOf(audience: AudienceDraft): NoticeAudience {
  if (audience.kind === 'UNIVERSITY') return { kind: 'UNIVERSITY', reference: null }
  return { kind: audience.kind, reference: audience.reference.trim() }
}
