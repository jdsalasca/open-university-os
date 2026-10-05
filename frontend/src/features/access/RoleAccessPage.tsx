import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { roleAccessClient, RoleAccessApiError } from './roleAccessClient'
import type {
  CreateRoleAssignmentCommand,
  IdentityDirectoryEntry,
  RoleAccessClient,
  RoleAssignment,
  RoleProfile,
  RoleProfileKey,
  RoleScopeKind,
} from './roleAccessContracts'
import { ROLE_SCOPE_KINDS } from './roleAccessContracts'
import './RoleAccessPage.scss'

export interface RoleAccessAuthorization {
  accessToken: string
  canRead: boolean
  canWrite: boolean
}

export interface RoleAccessScopeOption {
  reference: string
  label: string
}

type ScopeOptionLoader = (kind: RoleScopeKind, signal?: AbortSignal) => Promise<RoleAccessScopeOption[]>
type Feedback = { kind: 'success' | 'info' | 'error'; text: string } | null
type ProfileCatalogResult = { accessToken: string; attempt: number; profiles: RoleProfile[]; failed: boolean }
type ScopeOptionsResult = { key: string; options: RoleAccessScopeOption[]; failed: boolean }
const EMPTY_ROLE_PROFILES: RoleProfile[] = []

/** The server caps an identity search at 100; asking for less hides matches without telling the operator. */
const IDENTITY_SEARCH_LIMIT = 100

interface RoleAccessPageProps {
  client?: RoleAccessClient
  authorization: RoleAccessAuthorization | null
  loadScopeOptions?: ScopeOptionLoader
  onAuthorizationRejected?: (accessToken: string) => Promise<void>
}

export function RoleAccessPage({
  client = roleAccessClient,
  authorization,
  loadScopeOptions = async () => [],
  onAuthorizationRejected,
}: RoleAccessPageProps) {
  const [profileCatalogResult, setProfileCatalogResult] = useState<ProfileCatalogResult | null>(null)
  const [catalogRetry, setCatalogRetry] = useState(0)
  const [searchPrefix, setSearchPrefix] = useState('')
  const [searchResults, setSearchResults] = useState<IdentityDirectoryEntry[]>([])
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [selectedIdentity, setSelectedIdentity] = useState<IdentityDirectoryEntry | null>(null)
  const [assignments, setAssignments] = useState<RoleAssignment[]>([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(false)
  const [profileKey, setProfileKey] = useState<RoleProfileKey>('TEACHER')
  const [scopeKind, setScopeKind] = useState<RoleScopeKind>('UNIVERSITY')
  const [scopeReference, setScopeReference] = useState('')
  const [scopeOptionsResult, setScopeOptionsResult] = useState<ScopeOptionsResult | null>(null)
  const [validFrom, setValidFrom] = useState(todayInBogota())
  const [validThrough, setValidThrough] = useState('')
  const [sourceReference, setSourceReference] = useState('')
  const [revokeReference, setRevokeReference] = useState('')
  const [pendingRevokeId, setPendingRevokeId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const activeRequestRef = useRef<AbortController | null>(null)
  const scopeLoaderRef = useRef(loadScopeOptions)
  const currentToken = authorization?.accessToken
  const canRead = authorization?.canRead === true
  const canWrite = canRead && authorization?.canWrite === true
  const currentCatalogResult = profileCatalogResult !== null
    && profileCatalogResult.accessToken === currentToken
    && profileCatalogResult.attempt === catalogRetry
    ? profileCatalogResult
    : null
  const profiles = currentCatalogResult?.failed === false ? currentCatalogResult.profiles : EMPTY_ROLE_PROFILES
  const catalogState = currentCatalogResult === null ? 'loading' : currentCatalogResult.failed ? 'error' : 'ready'
  const assignableProfiles = useMemo(() => profiles.filter((profile) => profile.manuallyAssignable), [profiles])
  const selectedProfile = assignableProfiles.find((profile) => profile.key === profileKey) ?? assignableProfiles[0]
  const selectedScopeKind = selectedProfile?.allowedScopeKinds.includes(scopeKind)
    ? scopeKind
    : selectedProfile?.allowedScopeKinds[0] ?? 'UNIVERSITY'
  const scopeOptionsKey = `${selectedProfile?.key ?? ''}:${selectedScopeKind}`
  const needsScopeOptions = selectedProfile !== undefined
    && selectedScopeKind !== 'UNIVERSITY' && selectedScopeKind !== 'JOB_APPOINTMENT'
  const currentScopeOptionsResult = scopeOptionsResult?.key === scopeOptionsKey ? scopeOptionsResult : null
  const scopeOptions = currentScopeOptionsResult?.options ?? []
  const scopeOptionsLoading = needsScopeOptions && currentScopeOptionsResult === null
  const scopeOptionsFailed = currentScopeOptionsResult?.failed === true

  useEffect(() => {
    scopeLoaderRef.current = loadScopeOptions
  }, [loadScopeOptions])

  useEffect(() => () => activeRequestRef.current?.abort(), [])

  useEffect(() => {
    if (!canRead || !currentToken) return
    const controller = new AbortController()
    client.roleProfiles(currentToken, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        setProfileCatalogResult({ accessToken: currentToken, attempt: catalogRetry, profiles: result, failed: false })
        setFeedback(null)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        handleRequestError(error, currentToken, onAuthorizationRejected, setFeedback)
        setProfileCatalogResult({ accessToken: currentToken, attempt: catalogRetry, profiles: [], failed: true })
      })
    return () => controller.abort()
  }, [canRead, client, currentToken, catalogRetry, onAuthorizationRejected])

  useEffect(() => {
    if (!needsScopeOptions) return
    const controller = new AbortController()
    scopeLoaderRef.current(selectedScopeKind, controller.signal)
      .then((options) => {
        if (!controller.signal.aborted) setScopeOptionsResult({ key: scopeOptionsKey, options, failed: false })
      })
      .catch(() => {
        if (!controller.signal.aborted) setScopeOptionsResult({ key: scopeOptionsKey, options: [], failed: true })
      })
    return () => controller.abort()
  }, [needsScopeOptions, selectedScopeKind, scopeOptionsKey])

  async function searchIdentities(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!currentToken || !canRead || !searchPrefix.trim()) return
    const controller = startActionRequest(activeRequestRef)
    setSearchState('loading')
    setFeedback(null)
    setSelectedIdentity(null)
    setAssignments([])
    try {
      const results = await client.searchIdentities(searchPrefix, IDENTITY_SEARCH_LIMIT, currentToken, controller.signal)
      if (controller.signal.aborted) return
      setSearchResults(results)
      setSearchState('ready')
    } catch (error) {
      if (controller.signal.aborted) return
      setSearchState('error')
      handleRequestError(error, currentToken, onAuthorizationRejected, setFeedback)
    }
  }

  async function chooseIdentity(identity: IdentityDirectoryEntry) {
    if (!currentToken || !canRead) return
    setSelectedIdentity(identity)
    setAssignments([])
    setPendingRevokeId(null)
    setFeedback(null)
    const controller = startActionRequest(activeRequestRef)
    await refreshAssignments(identity, currentToken, controller.signal)
  }

  async function refreshAssignments(
    identity: IdentityDirectoryEntry,
    accessToken: string,
    signal?: AbortSignal,
  ) {
    setAssignmentsLoading(true)
    try {
      const result = await client.assignments(identity.userId, accessToken, signal)
      if (signal?.aborted) return
      setAssignments(result)
    } catch (error) {
      if (signal?.aborted) return
      handleRequestError(error, accessToken, onAuthorizationRejected, setFeedback)
    } finally {
      if (!signal?.aborted) setAssignmentsLoading(false)
    }
  }

  async function assignProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!currentToken || !canWrite || !selectedIdentity || !selectedProfile) return
    const reference = selectedScopeKind === 'UNIVERSITY' ? null : scopeReference
    const command: CreateRoleAssignmentCommand = {
      targetUserId: selectedIdentity.userId,
      profileKey: selectedProfile.key,
      scopes: [{ kind: selectedScopeKind, reference }],
      validFrom,
      validThrough: validThrough || null,
      sourceReference,
    }
    const controller = startActionRequest(activeRequestRef)
    setBusy(true)
    setFeedback(null)
    try {
      await client.assign(command, currentToken, controller.signal)
      if (controller.signal.aborted) return
      setFeedback({ kind: 'success', text: 'Perfil asignado y registrado en auditoría.' })
      setSourceReference('')
      await refreshAssignments(selectedIdentity, currentToken, controller.signal)
    } catch (error) {
      if (controller.signal.aborted) return
      handleRequestError(error, currentToken, onAuthorizationRejected, setFeedback)
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  async function revokeAssignment(event: FormEvent<HTMLFormElement>, assignment: RoleAssignment) {
    event.preventDefault()
    if (!currentToken || !canWrite || !selectedIdentity) return
    const controller = startActionRequest(activeRequestRef)
    setBusy(true)
    setFeedback(null)
    try {
      await client.revoke(assignment.assignmentId, {
        expectedVersion: assignment.version,
        sourceReference: revokeReference,
      }, currentToken, controller.signal)
      if (controller.signal.aborted) return
      setPendingRevokeId(null)
      setRevokeReference('')
      setFeedback({ kind: 'success', text: 'Perfil revocado; se conservó su historial de auditoría.' })
      await refreshAssignments(selectedIdentity, currentToken, controller.signal)
    } catch (error) {
      if (controller.signal.aborted) return
      if (error instanceof RoleAccessApiError && error.status === 409) {
        setPendingRevokeId(null)
        setFeedback({ kind: 'info', text: 'La asignación cambió en otra sesión. Se actualizó el listado; revisa la nueva versión antes de volver a confirmar.' })
        await refreshAssignments(selectedIdentity, currentToken, controller.signal)
      } else {
        handleRequestError(error, currentToken, onAuthorizationRejected, setFeedback)
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  if (!canRead || !currentToken) {
    return (
      <section className="role-access" aria-labelledby="role-access-title">
        <div className="role-access-hero">
          <p className="role-access-kicker">IDENTIDAD · CONTROL DE ACCESO</p>
          <h1 id="role-access-title">Accesos y perfiles</h1>
          <p>Administra perfiles institucionales con alcance, vigencias y registro de auditoría.</p>
        </div>
        <p className="role-access-locked" role="status">
          Esta consola requiere el permiso identity:roles:read en una sesión institucional configurada.
        </p>
      </section>
    )
  }

  return (
    <section className="role-access" aria-labelledby="role-access-title">
      <header className="role-access-hero">
        <div>
          <p className="role-access-kicker">IDENTIDAD · CONTROL DE ACCESO</p>
          <h1 id="role-access-title">Accesos y perfiles</h1>
          <p>Asigna perfiles por alcance y vigencia. Cada cambio queda ligado a una referencia institucional.</p>
        </div>
        <div className="role-access-hero-mark" aria-hidden="true"><span>◎</span><i /><i /></div>
        <div className="role-access-hero-meta">
          <span>{profiles.length || '—'} perfiles catalogados</span>
          <span>Autorización de servidor</span>
        </div>
      </header>

      {feedback && <p className={`role-access-feedback is-${feedback.kind}`} role="status">{feedback.text}</p>}

      {catalogState === 'loading' && <p className="role-access-loading" role="status">Cargando perfiles institucionales…</p>}
      {catalogState === 'error' && (
        <div className="role-access-error" role="alert">
          <p>No fue posible cargar los perfiles de acceso.</p>
          <button type="button" onClick={() => {
            setFeedback(null)
            setCatalogRetry((value) => value + 1)
          }}>Reintentar</button>
        </div>
      )}

      {catalogState === 'ready' && (
        <div className="role-access-grid">
          <section className="role-access-card" aria-labelledby="role-access-search-title">
            <div className="role-access-card-heading">
              <span className="role-access-step">01</span>
              <div><p>DIRECTORIO INSTITUCIONAL</p><h2 id="role-access-search-title">Busca una identidad</h2></div>
            </div>
            <form className="role-access-search" onSubmit={(event) => void searchIdentities(event)}>
              <label htmlFor="role-access-subject-prefix">Prefijo del identificador</label>
              <div className="role-access-search-row">
                <input
                  id="role-access-subject-prefix"
                  type="search"
                  autoComplete="off"
                  maxLength={255}
                  value={searchPrefix}
                  onChange={(event) => setSearchPrefix(event.target.value)}
                  placeholder="Identificador opaco del proveedor"
                  required
                />
                <button type="submit" disabled={searchState === 'loading' || !searchPrefix.trim()}>
                  {searchState === 'loading' ? 'Buscando…' : 'Buscar identidad'}
                </button>
              </div>
              <small>Solo aparecen identidades que ya iniciaron sesión. No se consulta correo ni perfil personal.</small>
            </form>

            {searchState === 'ready' && searchResults.length === 0 && (
              <p className="role-access-empty">No hay identidades registradas que coincidan con ese prefijo.</p>
            )}
            {searchState === 'ready' && searchResults.length >= IDENTITY_SEARCH_LIMIT && (
              <p className="role-access-hint">
                Mostrando las primeras {IDENTITY_SEARCH_LIMIT} identidades. Afina el prefijo para acotar la búsqueda.
              </p>
            )}
            {searchState === 'error' && <p className="role-access-inline-error">No se pudo completar la búsqueda. Revisa el acceso e inténtalo de nuevo.</p>}
            {searchResults.length > 0 && (
              <ul className="role-access-identity-results" aria-label="Resultados de identidad">
                {searchResults.map((identity) => {
                  const selected = selectedIdentity?.userId.toLowerCase() === identity.userId.toLowerCase()
                  return (
                    <li key={identity.userId.toLowerCase()}>
                      <button
                        type="button"
                        className={selected ? 'is-selected' : ''}
                        aria-pressed={selected}
                        onClick={() => void chooseIdentity(identity)}
                      >
                        <span className="role-access-identity-mark" aria-hidden="true">◎</span>
                        <span><strong>{identity.subject}</strong><small>{identity.issuer}</small></span>
                        <span className="role-access-select-arrow" aria-hidden="true">↗</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            {selectedIdentity && (
              <div className="role-access-assignment-list">
                <div className="role-access-subheading">
                  <h3>Perfiles asignados</h3>
                  {assignmentsLoading && <span role="status">Actualizando…</span>}
                </div>
                {assignments.length === 0 && !assignmentsLoading
                  ? <p className="role-access-empty">Esta identidad todavía no tiene perfiles asignados.</p>
                  : <ul>
                    {assignments.map((assignment) => (
                      <li key={assignment.assignmentId}>
                        <div className="role-access-assignment-copy">
                          <strong>{profiles.find((profile) => profile.key === assignment.profileKey)?.displayName ?? assignment.profileKey}</strong>
                          <span>{assignment.scopes.map((scope) => scope.stableReference ?? 'Universidad').join(' · ')}</span>
                          <small>{assignment.status === 'ACTIVE' ? 'Vigente' : 'Revocado'} · versión {assignment.version}</small>
                        </div>
                        <span className={`role-access-state is-${assignment.status.toLowerCase()}`}>
                          {assignment.status === 'ACTIVE' ? 'Activo' : 'Revocado'}
                        </span>
                        {canWrite && assignment.status === 'ACTIVE' && (
                          <button className="role-access-revoke-button" type="button" disabled={busy}
                            onClick={() => { setPendingRevokeId(assignment.assignmentId); setFeedback(null) }}>
                            Revocar
                          </button>
                        )}
                        {pendingRevokeId === assignment.assignmentId && (
                          <form className="role-access-revoke-confirmation" onSubmit={(event) => void revokeAssignment(event, assignment)}>
                            <p>La revocación es inmediata y se conserva en auditoría.</p>
                            <label htmlFor={`revoke-reference-${assignment.assignmentId}`}>Referencia de revocación</label>
                            <input id={`revoke-reference-${assignment.assignmentId}`} value={revokeReference}
                              onChange={(event) => setRevokeReference(event.target.value)} maxLength={512} required />
                            <div>
                              <button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Confirmar revocación'}</button>
                              <button type="button" className="secondary" disabled={busy} onClick={() => setPendingRevokeId(null)}>Cancelar</button>
                            </div>
                          </form>
                        )}
                      </li>
                    ))}
                  </ul>}
              </div>
            )}
          </section>

          <section className="role-access-card role-access-grant-card" aria-labelledby="role-access-grant-title">
            <div className="role-access-card-heading">
              <span className="role-access-step">02</span>
              <div><p>ASIGNACIÓN AUDITADA</p><h2 id="role-access-grant-title">Otorga un perfil</h2></div>
            </div>
            {!selectedIdentity && <p className="role-access-form-placeholder">Primero selecciona una identidad registrada para habilitar la asignación.</p>}
            {!canWrite && <p className="role-access-readonly-note">Tu sesión tiene permiso de lectura. Las asignaciones requieren identity:roles:write.</p>}
            {selectedIdentity && canWrite && (
              <form className="role-access-grant-form" onSubmit={(event) => void assignProfile(event)}>
                <div className="role-access-selected-target">
                  <span className="role-access-identity-mark" aria-hidden="true">◎</span>
                  <span><small>IDENTIDAD SELECCIONADA</small><strong>{selectedIdentity.subject}</strong></span>
                </div>
                <label htmlFor="role-access-profile">Perfil institucional</label>
                <select id="role-access-profile" value={selectedProfile?.key ?? profileKey} onChange={(event) => {
                  const nextProfileKey = event.target.value as RoleProfileKey
                  const nextProfile = assignableProfiles.find((profile) => profile.key === nextProfileKey)
                  setProfileKey(nextProfileKey)
                  if (nextProfile && !nextProfile.allowedScopeKinds.includes(scopeKind)) {
                    setScopeKind(nextProfile.allowedScopeKinds[0] ?? 'UNIVERSITY')
                  }
                  setScopeReference('')
                  setFeedback(null)
                }} required>
                  {assignableProfiles.map((profile) => (
                    <option key={profile.key} value={profile.key}>{profile.displayName}</option>
                  ))}
                </select>
                {selectedProfile && selectedProfile.permissions.length === 0 && (
                  <p className="role-access-permission-note">Este perfil todavía no concede permisos de aplicación aprobados.</p>
                )}
                {selectedProfile && selectedProfile.permissions.length > 0 && (
                  <p className="role-access-permission-note">Permisos habilitados: {selectedProfile.permissions.join(', ')}.</p>
                )}
                <div className="role-access-form-row">
                  <label htmlFor="role-access-scope">Ámbito
                    <select id="role-access-scope" value={selectedScopeKind} onChange={(event) => {
                      setScopeKind(event.target.value as RoleScopeKind)
                      setScopeReference('')
                      setFeedback(null)
                    }}>
                      {ROLE_SCOPE_KINDS.filter((kind) => selectedProfile?.allowedScopeKinds.includes(kind))
                        .map((kind) => <option key={kind} value={kind}>{scopeLabel(kind)}</option>)}
                    </select>
                  </label>
                  <label htmlFor="role-access-valid-from">Válido desde
                    <input id="role-access-valid-from" type="date" value={validFrom}
                      onChange={(event) => setValidFrom(event.target.value)} required />
                  </label>
                </div>
                {selectedScopeKind !== 'UNIVERSITY' && (
                  <label htmlFor="role-access-scope-reference">Referencia del ámbito
                    {selectedScopeKind === 'JOB_APPOINTMENT'
                      ? <input id="role-access-scope-reference" value={scopeReference} maxLength={256} required
                        onChange={(event) => setScopeReference(event.target.value)} placeholder="Identificador externo opaco" />
                      : <select id="role-access-scope-reference" value={scopeReference} required
                        onChange={(event) => setScopeReference(event.target.value)} disabled={scopeOptionsLoading || scopeOptions.length === 0}>
                        <option value="">{scopeOptionsLoading ? 'Cargando opciones…' : 'Selecciona una referencia'}</option>
                        {scopeOptions.map((option) => <option value={option.reference} key={option.reference}>{option.label}</option>)}
                      </select>}
                    <small>{scopeOptionsFailed
                      ? 'No se pudo consultar la estructura institucional. Reintenta antes de guardar.'
                      : selectedScopeKind === 'JOB_APPOINTMENT'
                        ? 'Identificador externo; no se registra información personal del vínculo.'
                        : scopeOptions.length === 0 && !scopeOptionsLoading
                          ? 'No hay referencias publicadas para este ámbito. No uses códigos inventados.'
                          : 'Elige una referencia del árbol académico vigente.'}</small>
                  </label>
                )}
                <div className="role-access-form-row">
                  <label htmlFor="role-access-valid-through">Válido hasta
                    <input id="role-access-valid-through" type="date" min={validFrom} value={validThrough}
                      onChange={(event) => setValidThrough(event.target.value)} />
                  </label>
                  <label htmlFor="role-access-source-reference">Referencia institucional
                    <input id="role-access-source-reference" value={sourceReference} maxLength={512} required
                      onChange={(event) => setSourceReference(event.target.value)} placeholder="Acta, resolución u orden" />
                  </label>
                </div>
                <button className="role-access-submit" type="submit" disabled={busy || !validFrom
                  || (selectedScopeKind !== 'UNIVERSITY' && !scopeReference.trim()) || !sourceReference.trim()}>
                  {busy ? 'Guardando cambio…' : 'Asignar perfil'}
                </button>
                <p className="role-access-form-footnote">La identidad no puede asignarse un perfil a sí misma. Aspirante, admitido y estudiante dependen de su fuente de ciclo verificada.</p>
              </form>
            )}
          </section>
        </div>
      )}
    </section>
  )
}

function startActionRequest(ref: { current: AbortController | null }): AbortController {
  ref.current?.abort()
  const controller = new AbortController()
  ref.current = controller
  return controller
}

function handleRequestError(
  error: unknown,
  accessToken: string,
  onAuthorizationRejected: RoleAccessPageProps['onAuthorizationRejected'],
  setFeedback: (feedback: Feedback) => void,
) {
  if (error instanceof RoleAccessApiError && (error.status === 401 || error.status === 403)) {
    setFeedback({ kind: 'error', text: 'El acceso cambió. Se validará de nuevo tu sesión y no se repetirá la operación.' })
    void onAuthorizationRejected?.(accessToken)
    return
  }
  setFeedback({ kind: 'error', text: error instanceof RoleAccessApiError
    ? error.message
    : 'No fue posible completar la operación. Revisa los datos e inténtalo de nuevo.' })
}

function todayInBogota(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function scopeLabel(kind: RoleScopeKind): string {
  switch (kind) {
    case 'UNIVERSITY': return 'Universidad'
    case 'SITE': return 'Sede'
    case 'FACULTY': return 'Facultad'
    case 'PROGRAM': return 'Programa'
    case 'JOB_APPOINTMENT': return 'Vínculo laboral'
  }
}
