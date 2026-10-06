import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { compile } from 'sass'

const stylesheetPath = fileURLToPath(new URL('../src/styles/_theme.scss', import.meta.url))
const compiledTheme = compile(stylesheetPath).css

function darkRule(selector) {
  // Sass parte los selectores :is() de tres o mas clases en varias lineas, asi que cada espacio
  // del selector buscado puede ser cualquier blanco en el CSS compilado. Sin esto, una regla
  // valida no se encontraba y el guard la daba por ausente.
  const pattern = selector
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+')
  return compiledTheme.match(new RegExp(`${pattern}\\s*\\{([^}]*)\\}`))?.[1]
}

function contrastRatio(textColor, backgroundColor) {
  const luminance = (hexColor) => {
    const channels = hexColor.slice(1).match(/.{2}/g).map((channel) => Number.parseInt(channel, 16) / 255)
    const [red, green, blue] = channels.map((channel) => channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4)
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue
  }

  const values = [luminance(textColor), luminance(backgroundColor)].sort((left, right) => right - left)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

function assertReadableContrast(declarations) {
  const themeDeclarations = darkRule(':root[data-theme=dark]')
  const resolveColor = (property) => {
    const color = declarations.match(new RegExp(`(?:^|\\s)${property}:\\s*(#[0-9a-f]{6}|var\\(--([\\w-]+)\\));`, 'i'))
    if (!color) return undefined
    if (color[1].startsWith('#')) return color[1]
    return themeDeclarations?.match(new RegExp(`--${color[2]}:\\s*(#[0-9a-f]{6});`, 'i'))?.[1]
  }
  const textColor = resolveColor('color')
  const backgroundColor = resolveColor('background')
  assert.ok(textColor && backgroundColor, 'text and background colors must be explicit')
  assert.ok(contrastRatio(textColor, backgroundColor) >= 4.5, 'feedback text must meet WCAG AA contrast')
}

test('dark theme gives identity status messages a readable dark surface', () => {
  // Arrange
  const selector = ':root[data-theme=dark] .workspace main .visual-identity-center .identity-status'

  // Act
  const declarations = darkRule(selector)

  // Assert
  assert.ok(declarations, 'dark identity status rule must be present')
  assert.match(declarations, /background: #332e1d;/)
  assert.match(declarations, /color: #f0dfa0;/)
  assertReadableContrast(declarations)
})

test('dark theme gives identity errors a readable dark error surface', () => {
  // Arrange
  const selector = ':root[data-theme=dark] .workspace main .visual-identity-center .identity-alert'

  // Act
  const declarations = darkRule(selector)

  // Assert
  assert.ok(declarations, 'dark identity error rule must be present')
  assert.match(declarations, /background: #352320;/)
  assert.match(declarations, /color: #ffc0b7;/)
  assertReadableContrast(declarations)
})

test('dark theme gives structure audit events a readable raised surface', () => {
  // Arrange
  const selector = ':root[data-theme=dark] .workspace main .academic-structure-audit-events > li'

  // Act
  const declarations = darkRule(selector)

  // Assert
  assert.ok(declarations, 'dark academic audit event rule must be present')
  assert.match(declarations, /background:\s*var\(--ui-surface-raised\);/)
  assert.match(declarations, /color:\s*var\(--ui-text-primary\);/)
  assertReadableContrast(declarations)
})

test('dark theme gives space announcements a readable raised surface', () => {
  // Arrange: the global dark theme gives announcement text a light color, while the component
  // keeps a cream surface unless the theme overrides it.
  const selector = ':root[data-theme=dark] .workspace main :is(.academic-unit-copy strong, .academic-unit-copy small, .academic-sort-order, .spaces-type-badge, .spaces-pathway-kind, .spaces-pathway-note, .spaces-announcement, .spaces-directory-footer, .catalog-operation-note, .catalog-locked-tag, .catalog-button, .academic-load-error, .room-allocation-synthetic-note, .room-allocation-controls, .room-allocation-input-summary, .room-allocation-session-needed)'
  const dark = darkRule(':root[data-theme=dark]')

  // Act
  const declarations = darkRule(selector)
  const raisedSurface = dark?.match(/--ui-surface-raised:\s*(#[0-9a-f]{6});/i)?.[1]
  const primaryText = dark?.match(/--ui-text-primary:\s*(#[0-9a-f]{6});/i)?.[1]

  // Assert
  assert.ok(declarations, 'dark announcement surface rule must be present')
  assert.match(declarations, /background:\s*var\(--ui-surface-raised\);/)
  assert.match(declarations, /border-color:\s*var\(--ui-border\);/)
  assert.match(declarations, /color:\s*var\(--ui-text-primary\);/)
  assert.ok(raisedSurface && primaryText, 'dark announcement colors must be defined')
  assert.ok(contrastRatio(primaryText, raisedSurface) >= 4.5, 'announcement text on its surface must meet WCAG AA')
})

test('dark theme gives identity center chrome a readable surface', () => {
  // Arrange: these elements keep light backgrounds but inherit the light dark-mode text color,
  // so without a dark rule they render light-on-light (Lighthouse contrast 1.03–2.11).
  const selector = ':root[data-theme=dark] .workspace main .visual-identity-center :is('
    + '.identity-revision-chip, .contrast-hint, .preview-local-badge, .summary-icon)'

  // Act
  const declarations = darkRule(selector)

  // Assert
  assert.ok(declarations, 'dark identity center chrome rule must be present')
  assert.match(declarations, /background:\s*var\(--ui-surface-raised\);/)
  assert.match(declarations, /color:\s*var\(--ui-text-primary\);/)
  assertReadableContrast(declarations)
})

test('library page styles reference only tokens the theme defines, so dark mode can override them', () => {
  // Arrange: a component that invents token names silently keeps light colors in dark mode.
  const libraryStylesheet = readFileSync(
    fileURLToPath(new URL('../src/features/library/LibraryAdminPage.scss', import.meta.url)), 'utf8')

  // Act
  const definedTokens = new Set([...compiledTheme.matchAll(/(--[a-z0-9-]+):/g)].map((match) => match[1]))
  const referenced = [...new Set([...libraryStylesheet.matchAll(/var\((--[a-z0-9-]+)/g)].map((match) => match[1]))]

  // Assert
  assert.ok(referenced.length > 0, 'the library page must style itself through theme tokens')
  assert.deepEqual(referenced.filter((token) => !definedTokens.has(token)), [])
})

test('library page surfaces keep WCAG AA contrast in dark mode', () => {
  // Arrange
  const dark = darkRule(':root[data-theme=dark]')
  const token = (name) => dark?.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, 'i'))?.[1]

  // Act + Assert
  const surface = token('ui-surface')
  const raised = token('ui-surface-raised')
  const text = token('ui-text-primary')
  assert.ok(surface && raised && text, 'dark tokens must be defined')
  assert.ok(contrastRatio(text, surface) >= 4.5, 'library text on surface must meet WCAG AA')
  assert.ok(contrastRatio(text, raised) >= 4.5, 'library text on raised surface must meet WCAG AA')
})

test('public program directory keeps its dark surfaces readable', () => {
  // Arrange: the component renders .public-program-* classes, so the dark rules must target those
  // exact names; a rule for a class the component never renders leaves light-on-light text.
  const dark = darkRule(':root[data-theme=dark]')
  const token = (name) => dark?.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, 'i'))?.[1]
  const text = token('ui-text-primary')
  const secondary = token('ui-text-secondary')
  const raised = token('ui-surface-raised')
  const surface = token('ui-surface')
  assert.ok(text && secondary && raised && surface, 'dark tokens must be defined')

  // Act + Assert: the consolidated surface rule must exist and its text must stay readable.
  const surfaces = darkRule(':root[data-theme=dark] .workspace main .public-program-directory :is(.public-program-hero,\n.public-program-source-note,\n.public-program-results-count,\n.public-program-card,\n.public-program-empty,\n.public-program-more)')
  assert.ok(surfaces, 'the public directory surface rule must exist')
  assert.match(surfaces, /background:\s*var\(--ui-surface-raised\);/)
  assert.ok(contrastRatio(text, raised) >= 4.5, 'directory text on raised surface must meet WCAG AA')

  const filters = darkRule(':root[data-theme=dark] .workspace main .public-program-directory .public-program-filters')
  assert.ok(filters, 'the public directory filters rule must exist')
  assert.match(filters, /background:\s*var\(--ui-surface\);/)
  assert.ok(contrastRatio(text, surface) >= 4.5, 'directory text on surface must meet WCAG AA')

  const offerTag = darkRule(':root[data-theme=dark] .workspace main .public-program-directory .public-program-offer-tag')
  assert.ok(offerTag, 'the public directory offer tag rule must exist')
  assert.ok(contrastRatio(secondary, raised) >= 4.5, 'offer tag text must meet WCAG AA')

  const marked = darkRule(':root[data-theme=dark] .workspace main .public-program-directory .public-program-offer-tag.is-marked')
  assert.ok(marked, 'the marked offer tag rule must exist')
  assertReadableContrast(marked)

  const switchPressed = darkRule(':root[data-theme=dark] .workspace main .public-program-directories .public-program-directory-switch button[aria-pressed=true]')
  assert.ok(switchPressed, 'the pressed directory switch rule must exist')
  assert.match(switchPressed, /background:\s*var\(--ui-surface-raised\);/)
  assert.ok(contrastRatio(text, raised) >= 4.5, 'pressed switch text must meet WCAG AA')
})

test('dark theme keeps academic, spaces, and catalog chrome readable', () => {
  // Arrange: these elements keep hardcoded light backgrounds but inherit the light dark-mode text.
  const selector = ':root[data-theme=dark] .workspace main :is(.academic-unit-copy strong, .academic-unit-copy small, .academic-sort-order, .spaces-type-badge, .spaces-pathway-kind, .spaces-pathway-note, .spaces-announcement, .spaces-directory-footer, .catalog-operation-note, .catalog-locked-tag, .catalog-button, .academic-load-error, .room-allocation-synthetic-note, .room-allocation-controls, .room-allocation-input-summary, .room-allocation-session-needed)'

  // Act
  const declarations = darkRule(selector)

  // Assert
  assert.ok(declarations, 'dark chrome rule must be present')
  assert.match(declarations, /background:\s*var\(--ui-surface-raised\);/)
  assert.match(declarations, /color:\s*var\(--ui-text-primary\);/)
  assertReadableContrast(declarations)
})

test('dark theme keeps the room allocation demo readable', () => {
  // Arrange: the DEV-only demo also keeps hardcoded light surfaces.
  const selector = ':root[data-theme=dark] .workspace main :is(.academic-unit-copy strong, .academic-unit-copy small, .academic-sort-order, .spaces-type-badge, .spaces-pathway-kind, .spaces-pathway-note, .spaces-announcement, .spaces-directory-footer, .catalog-operation-note, .catalog-locked-tag, .catalog-button, .academic-load-error, .room-allocation-synthetic-note, .room-allocation-controls, .room-allocation-input-summary, .room-allocation-session-needed)'

  // Act
  const declarations = darkRule(selector)

  // Assert
  assert.ok(declarations, 'dark chrome rule must be present')
  assert.match(declarations, /background:\s*var\(--ui-surface-raised\);/)
  assert.match(declarations, /color:\s*var\(--ui-text-primary\);/)
  assertReadableContrast(declarations)
})

test('dark theme keeps the public admissions calendar readable', () => {
  // Arrange: measured in the browser, these admissions surfaces rendered light-on-light in dark
  // mode (contrast 1.02-2.27) because they keep hardcoded light backgrounds.
  const selector = ':root[data-theme=dark] .workspace main :is(.admissions-fallback-status,\n.admissions-primary-link,\n.admissions-count,\n.admissions-note-icon,\n.admissions-source-seal,\n.admissions-timeline-index,\n.admissions-checklist,\n.admissions-official-source)'

  // Act
  const declarations = darkRule(selector)

  // Assert
  assert.ok(declarations, 'dark admissions surface rule must be present')
  assert.match(declarations, /background:\s*var\(--ui-surface-raised\);/)
  assertReadableContrast(declarations)
})

test('dark theme keeps admissions muted text readable on its cards', () => {
  // Arrange: these admissions labels keep light muted colors that vanish on the dark card surface.
  const dark = darkRule(':root[data-theme=dark]')
  const token = (name) => dark?.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, 'i'))?.[1]
  const secondary = token('ui-text-secondary')
  const raised = token('ui-surface-raised')
  assert.ok(secondary && raised, 'dark tokens must be defined')

  // Act + Assert
  const muted = darkRule(':root[data-theme=dark] .workspace main :is(.admissions-eyebrow, .admissions-checklist-footnote)')
  assert.ok(muted, 'dark admissions muted-text rule must be present')
  assert.match(muted, /color:\s*var\(--ui-text-secondary\);/)
  assert.ok(contrastRatio(secondary, raised) >= 4.5, 'admissions muted text must meet WCAG AA')
})

test('dark theme keeps the visual identity editor action bar readable', () => {
  // Arrange: measured in the browser, .editor-actions keeps a white background while its buttons
  // inherit the light dark-mode text, rendering "Publicar cambios" invisible (contrast 1.11-1.53).
  const dark = darkRule(':root[data-theme=dark]')
  const token = (name) => dark?.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, 'i'))?.[1]
  const text = token('ui-text-primary')
  const raised = token('ui-surface-raised')
  assert.ok(text && raised, 'dark tokens must be defined')

  // Act
  const declarations = darkRule(':root[data-theme=dark] .workspace main .visual-identity-center :is(.editor-actions, .banner-editor-card)')

  // Assert
  assert.ok(declarations, 'dark identity editor action rule must be present')
  assert.match(declarations, /background:\s*var\(--ui-surface-raised\);/)
  assert.ok(contrastRatio(text, raised) >= 4.5, 'identity editor actions must meet WCAG AA')
})

test('dark theme gives the identity status icon a readable badge', () => {
  // Arrange: the icon keeps a light yellow badge, so dark mode needs its own dark badge color.
  const declarations = darkRule(':root[data-theme=dark] .workspace main .status-banner-icon')

  // Assert
  assert.ok(declarations, 'dark identity status icon rule must be present')
  assert.match(declarations, /background: #4a4326;/)
  assert.match(declarations, /color: #f0dfa0;/)
  assertReadableContrast(declarations)
})

// Mutacion comprobada el 5 de octubre de 2026 con el navegador: estos tres badges fijan su
// fondo en un literal crema o blanco y su color en un literalalso. La regla puerta de
// index.scss (`:root[data-theme=dark] .workspace main :not(...)`) aplica
// `color: var(--ui-text-primary)` con especificidad 0-5-1 y gana sobre un `> span` de
// 0-1-1, asi que el glifo quedaba blanco sobre crema con ratio 1,10: invisible.
test('dark theme repaints the shared academic operation icon', () => {
  // Arrange
  const declarations = darkRule(':root[data-theme=dark] .workspace main .academic-operation-icon')

  // Assert
  assert.ok(declarations, 'dark academic operation icon rule must be present')
  assert.match(declarations, /background:\s*var\(--ui-surface-raised\);/)
  assert.match(declarations, /color:\s*var\(--ui-text-primary\);/)
  assertReadableContrast(declarations)
})

test('every academic operation glyph uses the shared theme class', () => {
  // Arrange: los siete componentes renderizan el mismo badge. Si uno se olvida de la clase,
  // su glifo vuelve a quedar blanco sobre crema sin que ningun otro test lo note.
  const componentes = [
    '../src/features/academics/AcademicOperationsPage.tsx',
    '../src/features/academics/CloseAcademicStructureRelationForm.tsx',
    '../src/features/academics/CreateAcademicChildUnitForm.tsx',
    '../src/features/academics/CreateAcademicProgramAffiliationForm.tsx',
    '../src/features/academics/CreateAcademicStructureRelationForm.tsx',
    '../src/features/academics/CreateFacultyForm.tsx',
    '../src/features/academics/ReassignAcademicProgramAffiliationForm.tsx',
  ]

  // Act
  const sinClase = componentes.filter((ruta) =>
    !readFileSync(fileURLToPath(new URL(ruta, import.meta.url)), 'utf8').includes('className="academic-operation-icon"'))

  // Assert
  assert.deepEqual(sinClase, [], 'todo glifo de operacion academica debe usar la clase compartida del tema')
})

// Barrido medido en el navegador el 5 de octubre de 2026 sobre #espacios y #programas, las dos
// rutas que faltaban por revisar. Siete elementos con texto propio quedaron entre 1,02 y 2,15 en
// tema oscuro. La lista sale de find-dark-badges.mjs, que senala las reglas de componente con
// fondo claro literal y color literal cuya clase el tema oscuro no repinta.
const darkCatalogIcons = darkRule(':root[data-theme=dark] .workspace main :is(.catalog-note-icon, .catalog-file-icon)')
const darkWhiteMarks = darkRule(':root[data-theme=dark] .workspace main :is(.catalog-admin-mark, .catalog-file-picker, .spaces-hero-art, .spaces-search-control)')

test('dark theme repaints the catalog note and file icons', () => {
  // Arrange
  assert.ok(darkCatalogIcons, 'dark catalog icon rule must be present')
  assert.match(darkCatalogIcons, /background:\s*#332e1d;/)
  assert.match(darkCatalogIcons, /color:\s*var\(--ui-text-primary\);/)
  assertReadableContrast(darkCatalogIcons)
})

test('dark theme repaints the white marks, the file picker, the spaces glyph and the hero art', () => {
  // Arrange
  assert.ok(darkWhiteMarks, 'dark rule for the white marks must be present')
  assert.match(darkWhiteMarks, /background:\s*var\(--ui-surface-raised\);/)
  assert.match(darkWhiteMarks, /color:\s*var\(--ui-text-primary\);/)
  assertReadableContrast(darkWhiteMarks)
})

test('dark theme repaints the catalog count chip', () => {
  // Arrange
  const declarations = darkRule(':root[data-theme=dark] .workspace main .catalog-count')

  // Assert
  assert.ok(declarations, 'dark catalog count rule must be present')
  assert.match(declarations, /background:\s*var\(--ui-surface-raised\);/)
  assert.match(declarations, /color:\s*var\(--ui-text-secondary\);/)
  assertReadableContrast(declarations)
})

test('dark theme keeps a disabled primary button legible', () => {
  // Arrange: the disabled button kept a light gray background with white text (contrast 1.53).
  const declarations = darkRule(':root[data-theme=dark] .workspace main .button-primary:disabled')
  const dark = darkRule(':root[data-theme=dark]')
  const muted = dark?.match(/--ui-text-muted:\s*(#[0-9a-f]{6});/i)?.[1]

  // Assert
  assert.ok(declarations && muted, 'dark disabled button rule and muted token must exist')
  assert.match(declarations, /background: #383d36;/)
  assert.ok(contrastRatio(muted, '#383d36') >= 4.5, 'disabled button label must meet WCAG AA')
})

test('the visual identity preview keeps its light-on-light labels readable', () => {
  // Arrange: the preview surface stays light in every theme, so its muted labels must clear WCAG AA
  // against white in the component stylesheet rather than through a dark-theme override.
  const branding = readFileSync(
    fileURLToPath(new URL('../src/features/branding/VisualIdentityCenter.scss', import.meta.url)), 'utf8')

  // Act
  const note = branding.match(/\.preview-module-note\s*\{([^}]*)\}/)?.[1]
  const disabled = branding.match(/\.preview-navigation span\[aria-disabled='true'\]\s*\{([^}]*)\}/)?.[1]

  // Assert
  assert.ok(note && disabled, 'the preview label rules must be present')
  const noteColor = note.match(/color:\s*(#[0-9a-f]{6});/i)?.[1]
  const disabledColor = disabled.match(/color:\s*(#[0-9a-f]{6});/i)?.[1]
  assert.ok(noteColor && disabledColor, 'the preview labels must set an explicit color')
  assert.ok(contrastRatio(noteColor, '#ffffff') >= 4.5, 'preview module note must meet WCAG AA on white')
  assert.ok(contrastRatio(disabledColor, '#ffffff') >= 4.5, 'disabled preview navigation must meet WCAG AA on white')
})

// Hallazgo del 5 de octubre de 2026: Lighthouse en modo oscuro sobre /#accesos dio 96/100 con
// `color-contrast` en el mensaje "requiere identity:roles:read", dibujado con #f0f2eb sobre #faf7eb,
// ratio 1,05:1. Las cajas de aviso del componente no aparecen en la lista de superficies oscuras del
// tema, asi que conservan su fondo crema mientras la regla global les pinta el texto claro. El boton
// "Reintentar" hereda el mismo texto sobre su blanco y tampoco se ve.
test('dark theme gives the access notices a readable surface', () => {
  // Arrange: van por patron en la lista consolidada, asi que un aviso nuevo de #accesos nace legible.
  const selector = ':root[data-theme=dark] .workspace main :is('
    + '.surface-card, .card, [class*=-card], [class*=-panel], [class*=-form], [class*=-dialog],'
    + ' [class*=-confirmation], [class*=-empty], [class*=-list], [class*=-table-wrap],'
    + ' [class*=-history], [class*=-audit], [class*=-events], [class*=-results], [class*=-preview],'
    + ' .catalog-admin, .catalog-admin-locked, .academic-create-entry, [class*=-access-])'
    + ':not(.identity-preview-surface):not(.identity-preview-surface *)'
  const dark = darkRule(':root[data-theme=dark]')
  const token = (name) => dark?.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, 'i'))?.[1]

  // Act
  const declarations = darkRule(selector)

  // Assert
  assert.ok(declarations, 'the consolidated dark surface rule must be present')
  assert.match(declarations, /background:\s*var\(--ui-surface\);/)
  assert.match(declarations, /border-color:\s*var\(--ui-border\);/)
  // La regla consolidada no fija `color`: lo aporta la regla puerta, que pinta todo `main` del tema
  // oscuro con el token de texto primario. El contraste se mide con ese token sobre la superficie.
  assert.ok(contrastRatio(token('ui-text-primary'), token('ui-surface')) >= 4.5,
    'access notices must meet WCAG AA on the dark surface')
})

test('dark theme gives the access retry button a readable raised surface', () => {
  // Arrange
  const selector = ':root[data-theme=dark] .workspace main .role-access-error button'

  // Act
  const declarations = darkRule(selector)

  // Assert
  assert.ok(declarations, 'dark access retry button rule must be present')
  assert.match(declarations, /background:\s*var\(--ui-surface-raised\);/)
  assert.match(declarations, /border-color:\s*var\(--ui-border-strong\);/)
  assertReadableContrast(declarations)
})

// Hallazgo del 5 de octubre de 2026 con axe-core sobre /#academia: los tres formularios de alta
// (facultad, unidad hija, relacion) se dibujaban con el titulo a ratio 1,09 y la introduccion a 2,20.
// `.academic-create-entry` fija `background: #fbfcf8` con literal y no aparece en la lista de
// superficies oscuras del tema, asi que recibe el texto claro de la regla puerta sobre fondo claro.
test('dark theme gives the academic create entries and the access notices a readable surface', () => {
  // Arrange: ambos van por la lista consolidada, asi que un aviso nuevo de #accesos nace legible.
  const selector = ':root[data-theme=dark] .workspace main :is('
    + '.surface-card, .card, [class*=-card], [class*=-panel], [class*=-form], [class*=-dialog],'
    + ' [class*=-confirmation], [class*=-empty], [class*=-list], [class*=-table-wrap],'
    + ' [class*=-history], [class*=-audit], [class*=-events], [class*=-results], [class*=-preview],'
    + ' .catalog-admin, .catalog-admin-locked, .academic-create-entry, [class*=-access-])'
    + ':not(.identity-preview-surface):not(.identity-preview-surface *)'
  const dark = darkRule(':root[data-theme=dark]')
  const token = (name) => dark?.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, 'i'))?.[1]

  // Act
  const declarations = darkRule(selector)

  // Assert
  assert.ok(declarations, 'the consolidated dark surface rule must be present')
  assert.match(declarations, /background:\s*var\(--ui-surface\);/)
  assert.match(declarations, /border-color:\s*var\(--ui-border\);/)
  // La regla consolidada no fija `color`: lo aporta la regla puerta, que pinta todo `main` del tema
  // oscuro con el token de texto primario. El contraste se mide con ese token sobre la superficie.
  assert.ok(contrastRatio(token('ui-text-primary'), token('ui-surface')) >= 4.5,
    'these surfaces must meet WCAG AA with the gate rule text color')
})

test('the academic create entries clear WCAG AA on their own light surface', () => {
  // Arrange: axe-core medio 4,29 con `#77796f` sobre `#fbfcf8` en 23 nodos de tema claro, por debajo
  // del 4,5 que exige AA. Se mide contra la superficie que el propio componente declara.
  const operaciones = readFileSync(
    fileURLToPath(new URL('../src/features/academics/AcademicOperationsPage.scss', import.meta.url)), 'utf8')

  // Act
  const superficie = operaciones.match(/\.academic-create-entry\s*\{([^}]*)\}/)?.[1]
    ?.match(/background:\s*(#[0-9a-f]{6});/i)?.[1]
  const intro = operaciones.match(/\.academic-create-entry-intro\s*\{([^}]*)\}/)?.[1]
    ?.match(/color:\s*(#[0-9a-f]{6});/i)?.[1]
  const acciones = operaciones.match(/\.academic-create-entry-actions p\s*\{([^}]*)\}/)?.[1]
    ?.match(/color:\s*(#[0-9a-f]{6});/i)?.[1]

  // Assert
  assert.ok(superficie && intro && acciones, 'the create entry surface and muted labels must be declared')
  assert.ok(contrastRatio(intro, superficie) >= 4.5, 'the entry intro must meet WCAG AA on its own surface')
  assert.ok(contrastRatio(acciones, superficie) >= 4.5, 'the entry actions hint must meet WCAG AA on its own surface')
})

test('dark theme keeps the curriculum catalog hero readable', () => {
  // Arrange: measured in the browser, .catalog-hero keeps a cream gradient while the global dark
  // theme paints its heading light, so "Mallas curriculares de pregrado" rendered at ratio 1.0.
  const dark = darkRule(':root[data-theme=dark]')
  const token = (name) => dark?.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, 'i'))?.[1]
  const text = token('ui-text-primary')
  const secondary = token('ui-text-secondary')
  const raised = token('ui-surface-raised')
  assert.ok(text && secondary && raised, 'dark tokens must be defined')

  // Act
  const declarations = darkRule(':root[data-theme=dark] .workspace main .catalog-hero')

  // Assert
  assert.ok(declarations, 'dark catalog hero rule must be present')
  assert.match(declarations, /background:\s*var\(--ui-surface-raised\);/)
  assert.ok(contrastRatio(text, raised) >= 4.5, 'catalog hero heading must meet WCAG AA')

  const muted = darkRule(':root[data-theme=dark] .workspace main .catalog-intro')
  assert.ok(muted, 'dark catalog intro rule must be present')
  assert.match(muted, /color:\s*var\(--ui-text-secondary\);/)
  assert.ok(contrastRatio(secondary, raised) >= 4.5, 'catalog hero intro must meet WCAG AA')
})
