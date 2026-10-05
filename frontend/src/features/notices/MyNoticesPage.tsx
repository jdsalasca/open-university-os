import { useCallback, useEffect, useRef, useState } from 'react'
import { noticesClient as defaultNoticesClient } from './noticesClient'
import type { NoticesClient } from './noticesClient'
import type { NoticeAudienceKind, VisibleNotice } from './noticesContracts'
import './MyNoticesPage.scss'

interface MyNoticesPageProps {
  client?: NoticesClient
  accessToken: string | null
}

const LOAD_ERROR = 'No fue posible consultar los avisos. Verifica tu sesión y vuelve a intentarlo.'

const AUDIENCE_LABELS: Record<NoticeAudienceKind, string> = {
  UNIVERSITY: 'Toda la universidad',
  SITE: 'Sede',
  FACULTY: 'Facultad',
  PROGRAM: 'Programa',
}

export function MyNoticesPage({ client = defaultNoticesClient, accessToken }: MyNoticesPageProps) {
  if (!accessToken) return null
  return <MyNoticesPageContent key={accessToken} client={client} accessToken={accessToken} />
}

function MyNoticesPageContent({ client, accessToken }: { client: NoticesClient; accessToken: string }) {
  const [notices, setNotices] = useState<VisibleNotice[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const requestControllerRef = useRef<AbortController | null>(null)

  const fetchNotices = useCallback(async (signal: AbortSignal) => {
    try {
      const visible = await client.getMyNotices(accessToken, signal)
      if (signal.aborted) return
      setNotices(visible)
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

  return (
    <section className="my-notices" aria-labelledby="my-notices-title">
      <header className="my-notices-heading">
        <p className="my-notices-kicker">COMUNICACIONES INSTITUCIONALES</p>
        <h2 id="my-notices-title">Mis avisos</h2>
        <p>Avisos cuya audiencia corresponde a tus ámbitos institucionales vigentes. El servidor decide qué puedes leer.</p>
      </header>

      {loadState === 'loading' && <p className="my-notices-status" role="status">Consultando tus avisos…</p>}
      {loadState === 'error' && <div className="my-notices-error" role="alert">
        <p>{loadError}</p>
        <button type="button" onClick={reload}>Reintentar avisos</button>
      </div>}

      {loadState === 'ready' && (notices.length === 0
        ? <p className="my-notices-empty">No tienes avisos disponibles.</p>
        : <ul className="my-notices-list">
          {notices.map((notice) => (
            <li key={notice.noticeId} className="my-notices-item">
              <div className="my-notices-item-heading">
                <h3>{notice.title}</h3>
                <span className="my-notices-window">
                  <time dateTime={notice.publishedFrom}>{notice.publishedFrom}</time>
                  {' – '}
                  <time dateTime={notice.publishedThrough}>{notice.publishedThrough}</time>
                </span>
              </div>
              <p className="my-notices-body">{notice.body}</p>
              <p className="my-notices-audiences">
                {notice.audiences.map((audience) => (
                  <span key={`${audience.kind}:${audience.reference ?? ''}`} className="my-notices-audience">
                    {AUDIENCE_LABELS[audience.kind]}
                  </span>
                ))}
              </p>
            </li>
          ))}
        </ul>)}
    </section>
  )
}
