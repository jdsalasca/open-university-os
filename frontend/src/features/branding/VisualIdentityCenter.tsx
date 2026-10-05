import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { useBranding } from './useBranding'
import { DEFAULT_BRANDING, OFFICIAL_COLORS } from './contracts'
import type { BrandBanner, BrandColorKey, BrandModule, BrandModuleKey, PublicBranding } from './contracts'
import {
  brandingAdministrationClient,
  BrandingAdministrationError,
} from './api/brandingAdministrationClient'
import type {
  BrandingAdministrationClient,
  BrandingChangePayload,
} from './api/brandingAdministrationClient'
import type { ApplicationPermission } from '../identity/identityContracts'
import './VisualIdentityCenter.scss'

interface VisualIdentityCenterProps {
  accessToken: string | null
  permissions?: ApplicationPermission[]
  client?: BrandingAdministrationClient
  initialConfiguration?: PublicBranding
  onPublished?: (configuration: PublicBranding) => void
}

type AssetSlot = keyof PublicBranding['assets']
type PendingAssetKey = `asset:${AssetSlot}` | `banner:${string}`
type BannerPlacement = BrandBanner['placement']

interface EditableBanner extends Omit<BrandBanner, 'assetId'> {
  assetId: string | null
  needsSchedule: boolean
}

interface EditableBranding {
  institutionName: string
  colors: PublicBranding['colors']
  assets: PublicBranding['assets']
  modules: PublicBranding['modules']
  banners: EditableBanner[]
}

interface PendingFile {
  file: File
  previewUrl: string
}

const COLOR_FIELDS: ReadonlyArray<{ key: BrandColorKey; label: string }> = [
  { key: 'primary', label: 'Primario' },
  { key: 'ink', label: 'Tinta' },
  { key: 'surface', label: 'Superficie' },
  { key: 'text', label: 'Texto' },
  { key: 'accent', label: 'Acento' },
  { key: 'focus', label: 'Foco' },
]

const ASSET_FIELDS: ReadonlyArray<{ slot: AssetSlot; label: string; description: string }> = [
  { slot: 'logoLight', label: 'Logo principal', description: 'Se usa sobre superficies claras.' },
  { slot: 'logoDark', label: 'Logo alternativo para fondo oscuro', description: 'Se usa sobre superficies oscuras.' },
  { slot: 'favicon', label: 'Favicon institucional', description: 'Identifica las pestañas del navegador.' },
]

const TAB_NAMES = ['Colores', 'Activos', 'Módulos', 'Banners'] as const
type TabName = (typeof TAB_NAMES)[number]
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const HEX_COLOR = /^#[0-9a-f]{6}$/i

export function VisualIdentityCenter({
  accessToken,
  permissions = [],
  client = brandingAdministrationClient,
  initialConfiguration,
  onPublished,
}: VisualIdentityCenterProps) {
  const { refresh } = useBranding()
  const hasInitialConfiguration = initialConfiguration !== undefined
  const [baseline, setBaseline] = useState<PublicBranding>(initialConfiguration ?? DEFAULT_BRANDING)
  const [draft, setDraft] = useState<EditableBranding>(() => editableFrom(initialConfiguration ?? DEFAULT_BRANDING))
  const [pendingFiles, setPendingFiles] = useState<Record<string, PendingFile>>({})
  const [uploadedIds, setUploadedIds] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<TabName>('Colores')
  const [loadedAccessToken, setLoadedAccessToken] = useState<string | null>(null)
  const [failedAccessToken, setFailedAccessToken] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const objectUrls = useRef(new Set<string>())
  const isLoaded = hasInitialConfiguration || !accessToken || loadedAccessToken === accessToken
  const loadError = Boolean(accessToken && !hasInitialConfiguration && failedAccessToken === accessToken)
  const isLoading = Boolean(accessToken && !hasInitialConfiguration && !isLoaded && !loadError)
  const canWrite = accessToken !== null && permissions.includes('branding:write')

  useEffect(() => {
    if (hasInitialConfiguration || !accessToken) return

    let active = true
    client.getCurrentConfiguration(accessToken)
      .then((configuration) => {
        if (!active) return
        setBaseline(configuration)
        setDraft(editableFrom(configuration))
        setLoadedAccessToken(accessToken)
        setFailedAccessToken(null)
      })
      .catch(() => {
        if (!active) return
        setFailedAccessToken(accessToken)
      })
    return () => { active = false }
  }, [accessToken, client, hasInitialConfiguration, initialConfiguration, loadAttempt])

  useEffect(() => () => {
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url))
    objectUrls.current.clear()
  }, [])

  const validationErrors = useMemo(
    () => validateDraft(draft, pendingFiles),
    [draft, pendingFiles],
  )
  const isDirty = JSON.stringify(draft) !== JSON.stringify(editableFrom(baseline))
    || Object.keys(pendingFiles).length > 0
  const publishDisabled = !canWrite || !isLoaded || isLoading || isSaving
    || !isDirty || validationErrors.length > 0
  const logoPreview = pendingFiles['asset:logoLight']?.previewUrl
    || (draft.assets.logoLight ? `/assets/${draft.assets.logoLight}` : null)
  const previewBanner = [...draft.banners]
    .filter((banner) => banner.placement === 'home-hero')
    .sort((left, right) => left.order - right.order)[0]
  const bannerPreview = previewBanner
    ? pendingFiles[`banner:${previewBanner.id}`]?.previewUrl
      || (previewBanner.assetId ? `/assets/${previewBanner.assetId}` : null)
    : null

  function changeDraft(update: (current: EditableBranding) => EditableBranding) {
    setDraft(update)
    setRequestError(null)
    setStatusMessage('')
  }

  function updateColor(key: BrandColorKey, value: string) {
    changeDraft((current) => ({ ...current, colors: { ...current.colors, [key]: value } }))
  }

  function updateModule(key: BrandModuleKey, update: Partial<BrandModule>) {
    changeDraft((current) => ({
      ...current,
      modules: current.modules.map((module) => module.key === key ? { ...module, ...update } : module),
    }))
  }

  function revokePendingFile(key: string) {
    const url = pendingFiles[key]?.previewUrl
    if (url) {
      URL.revokeObjectURL(url)
      objectUrls.current.delete(url)
    }
    setPendingFiles((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
    setUploadedIds((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  function chooseFile(key: PendingAssetKey, file: File | undefined) {
    if (!file) return
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setMediaError('Usa una imagen PNG, JPEG o WebP.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setMediaError('La imagen no puede superar 5 MiB.')
      return
    }
    setMediaError(null)
    setRequestError(null)
    const oldUrl = pendingFiles[key]?.previewUrl
    if (oldUrl) {
      URL.revokeObjectURL(oldUrl)
      objectUrls.current.delete(oldUrl)
    }
    const previewUrl = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : ''
    if (previewUrl) objectUrls.current.add(previewUrl)
    setPendingFiles((current) => ({ ...current, [key]: { file, previewUrl } }))
    setUploadedIds((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
    setStatusMessage('')
  }

  function updateBanner(id: string, update: Partial<EditableBanner>) {
    changeDraft((current) => ({
      ...current,
      banners: current.banners.map((banner) => banner.id === id ? { ...banner, ...update } : banner),
    }))
  }

  function addBanner() {
    const id = newUuid()
    changeDraft((current) => ({
      ...current,
      banners: [...current.banners, {
        id,
        assetId: null,
        title: '',
        altText: '',
        placement: 'home-hero',
        order: current.banners.length + 1,
        startsAt: null,
        endsAt: null,
        needsSchedule: true,
      }],
    }))
  }

  function removeBanner(banner: EditableBanner) {
    const fileKey = `banner:${banner.id}`
    revokePendingFile(fileKey)
    changeDraft((current) => ({
      ...current,
      banners: current.banners
        .filter((item) => item.id !== banner.id)
        .map((item, index) => ({ ...item, order: index + 1 })),
    }))
  }

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % TAB_NAMES.length
    if (event.key === 'ArrowLeft') nextIndex = (index + TAB_NAMES.length - 1) % TAB_NAMES.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = TAB_NAMES.length - 1
    if (nextIndex === null) return
    event.preventDefault()
    setActiveTab(TAB_NAMES[nextIndex])
    tabRefs.current[nextIndex]?.focus()
  }

  async function publishChanges() {
    if (!accessToken || publishDisabled) return
    setIsSaving(true)
    setRequestError(null)
    setStatusMessage('')
    try {
      const assetIds = { ...uploadedIds }
      for (const [key, pending] of Object.entries(pendingFiles)) {
        if (!assetIds[key]) {
          const uploaded = await client.uploadAsset(pending.file, accessToken)
          assetIds[key] = uploaded.assetId
          setUploadedIds((current) => ({ ...current, [key]: uploaded.assetId }))
        }
      }
      const assets = { ...draft.assets }
      ASSET_FIELDS.forEach(({ slot }) => {
        const uploadedId = assetIds[`asset:${slot}`]
        if (uploadedId) assets[slot] = uploadedId
      })
      const banners: BrandBanner[] = draft.banners.map(({ needsSchedule: _needsSchedule, ...banner }) => ({
        ...banner,
        assetId: banner.assetId ?? assetIds[`banner:${banner.id}`] ?? '',
      }))
      const change: BrandingChangePayload = {
        expectedRevision: baseline.revision,
        institutionName: draft.institutionName.trim(),
        colors: normalizeColors(draft.colors),
        assets,
        modules: draft.modules.map((module) => ({ ...module, label: module.label.trim() })),
        banners,
      }
      const published = await client.publishConfiguration(change, accessToken)
      setBaseline(published)
      setDraft(editableFrom(published))
      releaseAllObjectUrls()
      setPendingFiles({})
      setUploadedIds({})
      setStatusMessage(`Cambios publicados en la revisión ${published.revision}`)
      refresh()
      onPublished?.(published)
    } catch (error) {
      setRequestError(messageForRequestError(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function restorePreviousRevision() {
    if (!accessToken || baseline.revision <= 1 || isSaving || isDirty) return
    setIsSaving(true)
    setRequestError(null)
    setStatusMessage('')
    try {
      const restored = await client.restoreRevision(baseline.revision - 1, baseline.revision, accessToken)
      setBaseline(restored)
      setDraft(editableFrom(restored))
      setRestoreDialogOpen(false)
      setStatusMessage(`Revisión ${restored.revision} publicada`)
      refresh()
      onPublished?.(restored)
    } catch (error) {
      setRequestError(messageForRequestError(error))
    } finally {
      setIsSaving(false)
    }
  }

  function discardDraft() {
    releaseAllObjectUrls()
    setPendingFiles({})
    setUploadedIds({})
    setDraft(editableFrom(baseline))
    setRequestError(null)
    setMediaError(null)
    setStatusMessage('Borrador descartado')
  }

  function releaseAllObjectUrls() {
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url))
    objectUrls.current.clear()
  }

  return (
    <div className="visual-identity-center">
      <header className="identity-center-header">
        <div>
          <p className="eyebrow">Administración institucional</p>
          <h1>Centro de identidad visual</h1>
          <p className="identity-center-intro">Gestiona colores, imágenes, nombres de módulos y banners desde un único lugar.</p>
        </div>
        <div className="identity-revision-chip" aria-label={`Revisión publicada ${baseline.revision}`}>
          <span className="revision-dot" /> Revisión {baseline.revision}
        </div>
      </header>

      {isLoading && <p className="identity-status" role="status" aria-busy="true">Cargando configuración institucional…</p>}
      {loadError && (
        <div className="identity-alert" role="alert">
          <span>No se pudo cargar la configuración administrativa.</span>
          <button type="button" className="button button-secondary" onClick={() => {
            setFailedAccessToken(null)
            setLoadAttempt((attempt) => attempt + 1)
          }}>
            Reintentar carga
          </button>
        </div>
      )}
      {!accessToken && (
        <p className="identity-status" role="status">
          Vista previa local. La publicación requiere acceso institucional.
        </p>
      )}
      {accessToken && !canWrite && (
        <p className="identity-status" role="status">
          Sesión institucional de consulta. Se requiere permiso de escritura para publicar o restaurar cambios.
        </p>
      )}
      {mediaError && <p className="identity-alert" role="alert">{mediaError}</p>}
      {requestError && <p className="identity-alert" role="alert">{requestError}</p>}
      {validationErrors.length > 0 && (
        <div className="identity-alert validation-alert" role="alert">
          <strong>Revisa estos campos antes de publicar:</strong>
          <ul>{validationErrors.map((error) => <li key={error}>{error}</li>)}</ul>
        </div>
      )}
      {statusMessage && <p className="identity-status" role="status">{statusMessage}</p>}

      <div className="identity-center-grid">
        <section className="identity-editor card" aria-label="Editor de identidad">
          <div className="editor-section-heading">
            <div>
              <p className="eyebrow">Configuración</p>
              <h2>Identidad institucional</h2>
            </div>
            <span className={`draft-indicator ${isDirty ? 'is-dirty' : ''}`}>
              {isDirty ? 'Borrador sin publicar' : 'Al día'}
            </span>
          </div>

          <label className="field-block institution-name-field">
            <span>Nombre de la institución</span>
            <input
              type="text"
              maxLength={240}
              value={draft.institutionName}
              onChange={(event) => changeDraft((current) => ({ ...current, institutionName: event.target.value }))}
            />
          </label>

          <div className="identity-tabs" role="tablist" aria-label="Secciones de identidad visual">
            {TAB_NAMES.map((name, index) => (
              <button
                key={name}
                ref={(element) => { tabRefs.current[index] = element }}
                type="button"
                role="tab"
                id={`identity-tab-${index}`}
                aria-controls={`identity-panel-${index}`}
                aria-selected={activeTab === name}
                tabIndex={activeTab === name ? 0 : -1}
                onClick={() => setActiveTab(name)}
                onKeyDown={(event) => handleTabKey(event, index)}
              >
                {name}
                {name === 'Activos' && Object.keys(pendingFiles).length > 0 && <span className="tab-change-dot" aria-label="Cambios pendientes" />}
              </button>
            ))}
          </div>

          {activeTab === 'Colores' && (
            <section className="identity-tab-panel" role="tabpanel" id="identity-panel-0" aria-labelledby="identity-tab-0" aria-label="Colores">
              <div className="identity-palette-grid">
                {COLOR_FIELDS.map(({ key, label }) => (
                  <label className="color-field" key={key}>
                    <span>{label}</span>
                    <span className="color-input-row">
                      <input
                        aria-label={`Muestra de color: ${label}`}
                        type="color"
                        value={safePreviewColor(draft.colors[key], key)}
                        onChange={(event) => updateColor(key, event.target.value.toUpperCase())}
                      />
                      <input
                        aria-label={`Color HEX: ${label}`}
                        type="text"
                        inputMode="text"
                        maxLength={7}
                        spellCheck={false}
                        value={draft.colors[key]}
                        onChange={(event) => updateColor(key, event.target.value)}
                      />
                    </span>
                    <small>{colorDescription(key)}</small>
                  </label>
                ))}
              </div>
              <p className="contrast-hint">El contraste del texto y del foco se comprueba antes de habilitar la publicación.</p>
            </section>
          )}

          {activeTab === 'Activos' && (
            <section className="identity-tab-panel" role="tabpanel" id="identity-panel-1" aria-labelledby="identity-tab-1" aria-label="Activos">
              <div className="asset-list">
                {ASSET_FIELDS.map(({ slot, label, description }) => {
                  const key: PendingAssetKey = `asset:${slot}`
                  const pending = pendingFiles[key]
                  return (
                    <article className="asset-editor-card" key={slot}>
                      <div className="asset-copy">
                        <h3>{label}</h3>
                        <p>{description}</p>
                        <label className="file-picker">
                          <span>Elegir imagen</span>
                          <input
                            aria-label={label}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={(event) => chooseFile(key, event.target.files?.[0])}
                          />
                        </label>
                        {(pending || draft.assets[slot]) && (
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => {
                              revokePendingFile(key)
                              changeDraft((current) => ({ ...current, assets: { ...current.assets, [slot]: null } }))
                            }}
                          >
                            Quitar {label.toLocaleLowerCase('es')}
                          </button>
                        )}
                      </div>
                      <div className={`asset-preview asset-preview-${slot}`} aria-label={`Vista previa: ${label}`}>
                        {pending?.previewUrl ? (
                          <img src={pending.previewUrl} alt={`Vista previa local de ${label}`} />
                        ) : draft.assets[slot] ? (
                          <img src={`/assets/${draft.assets[slot]}`} alt={`Imagen publicada de ${label}`} />
                        ) : (
                          <span>{slot === 'favicon' ? '16×16' : 'Sin imagen'}</span>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
              <p className="asset-security-note">Se aceptan PNG, JPEG y WebP de hasta 5 MiB. El servidor verifica el contenido real de cada archivo.</p>
            </section>
          )}

          {activeTab === 'Módulos' && (
            <section className="identity-tab-panel" role="tabpanel" id="identity-panel-2" aria-labelledby="identity-tab-2" aria-label="Módulos">
              <div className="module-editor-list">
                {draft.modules.map((module) => (
                  <article className="module-editor-row" key={module.key}>
                    <label className="field-block module-name-field">
                      <span>Nombre visible: {module.label}</span>
                      <input
                        type="text"
                        maxLength={100}
                        value={module.label}
                        onChange={(event) => updateModule(module.key, { label: event.target.value })}
                      />
                    </label>
                    <div className="module-state">
                      <span className={`module-state-pill ${module.available ? 'available' : ''}`}>
                        {module.available ? 'Disponible' : 'En preparación'}
                      </span>
                      <label className="visibility-toggle">
                        <input
                          type="checkbox"
                          checked={module.visible}
                          disabled={!module.available}
                          onChange={(event) => updateModule(module.key, { visible: event.target.checked })}
                        />
                        <span>Visible en navegación</span>
                      </label>
                    </div>
                  </article>
                ))}
              </div>
              <p className="module-security-note">Los nombres son editables. La disponibilidad real de cada módulo la controla el servidor.</p>
            </section>
          )}

          {activeTab === 'Banners' && (
            <section className="identity-tab-panel" role="tabpanel" id="identity-panel-3" aria-labelledby="identity-tab-3" aria-label="Banners">
              <div className="banner-heading">
                <div>
                  <h3>Banners institucionales</h3>
                  <p>Programa la vigencia y el lugar en que aparece cada pieza.</p>
                </div>
                <button type="button" className="button button-secondary" disabled={draft.banners.length >= 12} onClick={addBanner}>
                  Agregar banner
                </button>
              </div>
              <div className="banner-editor-list">
                {draft.banners.map((banner, index) => {
                  const key: PendingAssetKey = `banner:${banner.id}`
                  const pending = pendingFiles[key]
                  return (
                    <article className="banner-editor-card" key={banner.id}>
                      <div className="banner-card-topline">
                        <div>
                          <span className="banner-kind">Banner {index + 1}</span>
                          <strong>{banner.title || 'Sin título'}</strong>
                          <span className={`schedule-state ${scheduleState(banner)}`}>
                            {scheduleLabel(banner)}
                          </span>
                        </div>
                      </div>
                      <div className="banner-fields-grid">
                        <label className="field-block">
                          <span>{banner.needsSchedule ? 'Título del banner nuevo' : 'Título del banner'}</span>
                          <input type="text" maxLength={160} value={banner.title} onChange={(event) => updateBanner(banner.id, { title: event.target.value })} />
                        </label>
                        <label className="field-block">
                          <span>{banner.needsSchedule ? 'Texto alternativo del banner nuevo' : 'Texto alternativo del banner'}</span>
                          <input type="text" maxLength={300} value={banner.altText} onChange={(event) => updateBanner(banner.id, { altText: event.target.value })} />
                        </label>
                        <label className="field-block">
                          <span>Ubicación del banner</span>
                          <select value={banner.placement} onChange={(event) => updateBanner(banner.id, { placement: event.target.value as BannerPlacement })}>
                            <option value="home-hero">Portada principal</option>
                            <option value="login-banner">Inicio de sesión</option>
                            <option value="announcement-strip">Franja de anuncios</option>
                          </select>
                        </label>
                        <label className="field-block">
                          <span>{banner.needsSchedule ? 'Inicio de vigencia del banner nuevo' : 'Inicio de vigencia'}</span>
                          <input type="datetime-local" value={toLocalDateTime(banner.startsAt)} onChange={(event) => updateBanner(banner.id, { startsAt: toInstant(event.target.value) })} />
                        </label>
                        <label className="field-block">
                          <span>{banner.needsSchedule ? 'Fin de vigencia del banner nuevo' : 'Fin de vigencia'}</span>
                          <input type="datetime-local" value={toLocalDateTime(banner.endsAt)} onChange={(event) => updateBanner(banner.id, { endsAt: toInstant(event.target.value) })} />
                        </label>
                        <label className="file-picker banner-file-picker">
                          <span>Imagen del banner{banner.needsSchedule ? ' nuevo' : ''}</span>
                          <input aria-label={banner.needsSchedule ? 'Imagen del banner nuevo' : `Imagen del banner ${index + 1}`} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => chooseFile(key, event.target.files?.[0])} />
                        </label>
                      </div>
                      {(pending?.previewUrl || banner.assetId) && (
                        <div className="banner-image-preview">
                          <img
                            src={pending?.previewUrl || `/assets/${banner.assetId}`}
                            alt={banner.altText || 'Vista previa del banner'}
                          />
                        </div>
                      )}
                      <button type="button" className="text-button remove-banner" onClick={() => removeBanner(banner)}>
                        Eliminar banner
                      </button>
                    </article>
                  )
                })}
                {draft.banners.length === 0 && <p className="empty-banners">No hay banners configurados. Puedes agregar uno con fechas, ubicación y texto alternativo.</p>}
              </div>
            </section>
          )}

          <footer className="editor-actions">
            <div className="revision-actions">
              <button
                type="button"
                className="text-button"
                disabled={!canWrite || baseline.revision <= 1 || isDirty || isSaving || isLoading}
                onClick={() => setRestoreDialogOpen(true)}
              >
                Restaurar revisión anterior
              </button>
              <button type="button" className="text-button" disabled={!isDirty || isSaving} onClick={discardDraft}>
                Descartar borrador
              </button>
            </div>
            <button type="button" className="button button-primary" disabled={publishDisabled} onClick={publishChanges}>
              {isSaving ? 'Guardando…' : 'Publicar cambios'}
            </button>
          </footer>
        </section>

        <aside className="identity-preview-column">
          <div className="preview-heading">
            <div>
              <p className="eyebrow">En vivo</p>
              <h2>Vista previa</h2>
            </div>
            <span className="preview-local-badge">{isDirty ? 'Borrador' : 'Publicada'}</span>
          </div>
          <div
            className="identity-preview-surface"
            data-testid="preview-surface"
            style={{
              '--preview-primary': safePreviewColor(draft.colors.primary, 'primary'),
              '--preview-ink': safePreviewColor(draft.colors.ink, 'ink'),
              '--preview-surface': safePreviewColor(draft.colors.surface, 'surface'),
              '--preview-text': safePreviewColor(draft.colors.text, 'text'),
              '--preview-accent': safePreviewColor(draft.colors.accent, 'accent'),
              '--preview-focus': safePreviewColor(draft.colors.focus, 'focus'),
            } as CSSProperties}
          >
            <div className="preview-brand-bar">
              {logoPreview ? (
                <img className="preview-logo" data-testid="preview-logo" src={logoPreview} alt={`Logo institucional de ${draft.institutionName}`} />
              ) : (
                <span className="preview-brand-mark" aria-hidden="true">U</span>
              )}
              <span>{draft.institutionName}</span>
            </div>
            <nav className="preview-navigation" data-testid="preview-navigation" aria-label="Vista previa de navegación">
              {[...draft.modules].sort((a, b) => a.order - b.order).map((module) => (
                <span key={module.key} aria-disabled={!module.available || !module.visible || undefined}>
                  {module.label}
                  {!module.available && <small className="preview-module-note">Próximo</small>}
                </span>
              ))}
            </nav>
            <div className="preview-hero">
              <div>
                <span className="preview-kicker">UNIVERSIDAD · IDENTIDAD INSTITUCIONAL</span>
                <h3>Una experiencia coherente para toda la comunidad</h3>
                <p>Los cambios del borrador se muestran aquí antes de su publicación.</p>
                <button type="button" tabIndex={-1}>Conocer más</button>
              </div>
              {bannerPreview && previewBanner && (
                <img
                  className="preview-banner-image"
                  data-testid="preview-banner"
                  src={bannerPreview}
                  alt={previewBanner.altText}
                />
              )}
              <div className="preview-orbit" aria-hidden="true"><span /><i /></div>
            </div>
            <div className="preview-color-swatches" aria-label="Colores seleccionados">
              {COLOR_FIELDS.map(({ key, label }) => <span key={key} title={label} style={{ backgroundColor: safePreviewColor(draft.colors[key], key) }} />)}
            </div>
          </div>
          <div className="preview-summary card">
            <div><span className="summary-icon">Aa</span><span><strong>Contraste accesible</strong><small>Validación WCAG AA</small></span></div>
            <div><span className="summary-icon image-summary-icon">▧</span><span><strong>Activos controlados</strong><small>Imágenes revisadas por el servidor</small></span></div>
          </div>
          <p className="preview-footnote">La vista previa es local. Los cambios solo se hacen visibles para la institución después de publicar una revisión.</p>
        </aside>
      </div>

      {restoreDialogOpen && (
        <div className="dialog-backdrop">
          <section className="identity-confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="restore-dialog-title">
            <p className="eyebrow">Historial de identidad</p>
            <h2 id="restore-dialog-title">Restaurar revisión anterior</h2>
            <p>Se creará una nueva revisión con el contenido de la revisión {baseline.revision - 1}. La revisión actual permanecerá en el historial.</p>
            <div className="dialog-actions">
              <button type="button" className="button button-secondary" disabled={isSaving} onClick={() => setRestoreDialogOpen(false)}>Cancelar</button>
              <button type="button" className="button button-primary" disabled={isSaving} onClick={restorePreviousRevision}>Confirmar restauración</button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function editableFrom(configuration: PublicBranding): EditableBranding {
  return {
    institutionName: configuration.institutionName,
    colors: { ...configuration.colors },
    assets: { ...configuration.assets },
    modules: configuration.modules.map((module) => ({ ...module })),
    banners: configuration.banners.map((banner) => ({ ...banner, needsSchedule: false })),
  }
}

function validateDraft(draft: EditableBranding, pendingFiles: Record<string, PendingFile>): string[] {
  const errors: string[] = []
  if (!draft.institutionName.trim()) errors.push('El nombre de la institución es obligatorio')
  if (draft.institutionName.trim().length > 240) errors.push('El nombre de la institución no puede superar 240 caracteres')

  draft.modules.forEach((module) => {
    const label = module.label.trim()
    if (!label) errors.push(`El nombre visible de ${module.key === 'home' ? 'Inicio' : module.label || module.key} es obligatorio`)
    else if (label.length > 100) errors.push(`El nombre visible de ${label} no puede superar 100 caracteres`)
  })

  COLOR_FIELDS.forEach(({ key, label }) => {
    if (!HEX_COLOR.test(draft.colors[key])) errors.push(`${label}: usa un color hexadecimal #RRGGBB`)
  })
  if (COLOR_FIELDS.every(({ key }) => HEX_COLOR.test(draft.colors[key]))) {
    const contrastChecks: Array<[string, string, number, string]> = [
      ['text', 'surface', 4.5, 'Texto / Superficie'],
      ['ink', 'primary', 4.5, 'Tinta / Primario'],
      ['focus', 'surface', 3, 'Foco / Superficie'],
      ['focus', 'primary', 3, 'Foco / Primario'],
    ]
    contrastChecks.forEach(([first, second, minimum, label]) => {
      if (contrast(draft.colors[first as BrandColorKey], draft.colors[second as BrandColorKey]) < minimum) {
        errors.push(`Contraste insuficiente: ${label} (mínimo ${minimum}:1)`)
      }
    })
  }

  if (draft.banners.length > 12) errors.push('La institución puede mantener hasta 12 banners')
  draft.banners.forEach((banner) => {
    const title = banner.title.trim()
    const altText = banner.altText.trim()
    if (!title) errors.push(`El título del banner ${banner.order} es obligatorio`)
    else if (title.length > 160) errors.push(`El título del banner ${banner.order} no puede superar 160 caracteres`)
    if (!altText) errors.push(`El banner ${banner.order} requiere texto alternativo`)
    else if (altText.length > 300) errors.push(`El texto alternativo del banner ${banner.order} no puede superar 300 caracteres`)
    if (!banner.assetId && !pendingFiles[`banner:${banner.id}`]) errors.push(`El banner ${banner.order} requiere una imagen`)
    if (banner.needsSchedule && (!banner.startsAt || !banner.endsAt)) errors.push(`El banner ${banner.order} requiere fecha de inicio y fecha de fin`)
    if ((banner.startsAt && !Number.isFinite(Date.parse(banner.startsAt))) || (banner.endsAt && !Number.isFinite(Date.parse(banner.endsAt)))) {
      errors.push(`El banner ${banner.order} tiene una fecha inválida`)
    } else if (banner.startsAt && banner.endsAt && Date.parse(banner.endsAt) <= Date.parse(banner.startsAt)) {
      errors.push('La fecha de fin debe ser posterior a la fecha de inicio')
    }
  })
  return errors
}

function contrast(first: string, second: string): number {
  const luminance = (color: string) => {
    const channels = color.slice(1).match(/.{2}/g)?.map((channel) => parseInt(channel, 16) / 255) ?? [0, 0, 0]
    const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
  }
  const firstLuminance = luminance(first)
  const secondLuminance = luminance(second)
  return (Math.max(firstLuminance, secondLuminance) + 0.05) / (Math.min(firstLuminance, secondLuminance) + 0.05)
}

function safePreviewColor(value: string, key: BrandColorKey): string {
  return HEX_COLOR.test(value) ? value : OFFICIAL_COLORS[key]
}

function normalizeColors(colors: EditableBranding['colors']): PublicBranding['colors'] {
  return Object.fromEntries(COLOR_FIELDS.map(({ key }) => [key, colors[key].toUpperCase()])) as PublicBranding['colors']
}

function colorDescription(key: BrandColorKey): string {
  const descriptions: Record<BrandColorKey, string> = {
    primary: 'Acciones y énfasis principal.',
    ink: 'Texto de marca y elementos oscuros.',
    surface: 'Fondo de tarjetas y superficies.',
    text: 'Texto de lectura principal.',
    accent: 'Detalles secundarios de marca.',
    focus: 'Indicador visible de navegación.',
  }
  return descriptions[key]
}

function scheduleState(banner: EditableBanner): 'current' | 'expired' | 'scheduled' {
  const now = Date.now()
  if (banner.endsAt && Date.parse(banner.endsAt) < now) return 'expired'
  if (banner.startsAt && Date.parse(banner.startsAt) > now) return 'scheduled'
  return 'current'
}

function scheduleLabel(banner: EditableBanner): string {
  const state = scheduleState(banner)
  if (state === 'expired') return 'Vencido'
  if (state === 'scheduled') return 'Programado'
  return 'Vigente'
}

function toLocalDateTime(instant: string | null): string {
  if (!instant) return ''
  const date = new Date(instant)
  if (!Number.isFinite(date.getTime())) return ''
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 16)
}

function toInstant(localDateTime: string): string | null {
  if (!localDateTime) return null
  const value = new Date(localDateTime)
  return Number.isFinite(value.getTime()) ? value.toISOString() : null
}

function newUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16)
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16)
  })
}

function messageForRequestError(error: unknown): string {
  if (error instanceof BrandingAdministrationError) {
    if (error.status === 409 || error.code === 'revision_conflict') return 'La configuración cambió en otra sesión. Tu borrador sigue guardado; recarga la versión actual y vuelve a aplicar tus cambios.'
    if (error.status === 401) return 'La sesión institucional venció. Inicia sesión de nuevo para publicar.'
    if (error.status === 403) return 'Tu cuenta no tiene permiso para administrar la identidad institucional.'
    if (error.status === 413) return 'La imagen supera el tamaño permitido por el servidor.'
    if (error.status === 415 || error.status === 422) return 'El servidor rechazó una imagen o un valor de identidad. Revisa el borrador.'
  }
  return 'No se pudieron guardar los cambios. El borrador permanece disponible para reintentar.'
}
