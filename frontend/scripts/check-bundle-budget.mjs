import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ENTRY_KEY = 'index.html'
const WORKSPACE_HOME_KEY = 'src/features/workspace/WorkspaceHomePage.tsx'
const PROGRAMS_KEY = 'src/features/academics/AcademicCatalogPage.tsx'
const CURRICULUM_COMPARISON_KEY = 'src/features/academics/CurriculumVersionComparisonPanel.tsx'
const PUBLIC_SELECTOR_KEY = 'src/features/academics/publicCatalog/PublicProgramDirectories.tsx'
const PUBLIC_DIRECTORY_KEY = 'src/features/academics/publicCatalog/PublicUndergraduateDirectory.tsx'
const POSTGRADUATE_DIRECTORY_KEY = 'src/features/academics/publicCatalog/PublicPostgraduateDirectory.tsx'
const PUBLIC_CATALOG_KEY = 'src/features/academics/publicCatalog/uptcUndergraduateCatalog.snapshot.json'
const POSTGRADUATE_CATALOG_KEY = 'src/features/academics/publicCatalog/uptcPostgraduateCatalog.snapshot.json'
const OIDC_KEY = 'src/features/identity/identitySessionManager.ts'
const ADMISSIONS_DEMO_PREFIX = 'src/features/admissions/demo/'
const STUDENT_DEMO_PREFIX = 'src/features/students/demo/'
const GRADEBOOK_DEMO_PREFIX = 'src/features/gradebook/demo/'
const ROOM_PLANNING_DEMO_PREFIX = 'src/features/room-planning/demo/'
const WORKSPACE_HOME_DEMO_PREFIX = 'src/features/workspace/demo/'
const LOCAL_PREVIEW_CLIENT_KEY = 'src/features/identity/localPreviewSessionClient.ts'
const LOCAL_PREVIEW_IDENTITY_KEY = 'src/features/identity/localPreviewIdentity.ts'

export const DEFAULT_BUNDLE_BUDGETS = Object.freeze({
  // The shared entry now includes the authenticated #biblioteca, #avisos and #avisos-admin routes; keep their added
  // shell cost bounded.
  entryJavaScript: 286_000,
  // The public program, admissions, curriculum and visual identity screens need dark-mode surface rules
  // so their hardcoded light cards stay readable (WCAG AA); those accessibility fixes add ~1.7 kB.
  // The programs route also reserves its measured height while the lazy chunk loads, removing a 0.75
  // cumulative layout shift; that reservation costs ~0.1 kB of shell CSS.
  // The light theme declares --ui-text-muted once in :root instead of repeating the grey in 39
  // component rules; as a custom property that is ~40 B once, against ~270 B of repeated literals.
  // index.html boots with a visible loading state so a slow network no longer shows a blank page,
  // costing ~0.1 kB of shell CSS.
  // A second browser sweep over #espacios and #programas found seven more elements under AA (1.02 to 2.15);
  // the rules repainting them add ~330 B. Six batches of dark badges are now guarded by tests.
  // axe-core over the nine routes found the last light-on-light surfaces: the #academia create entries
  // rendered their headings at 1.09 and the #accesos locked notice at 1.05. Both join the consolidated
  // dark surface list, one by class and one by pattern, which cost ~200 B; the retry button needs its
  // own rule because it carries no class. Consolidating saved ~196 B against writing them separately.
  // The academic empty state and the catalog empty art join the same list, ~40 B more.
  entryStyles: 23_800,
  workspaceHomeJavaScript: 300_000,
  // The route budget includes the public directory chunk but excludes the on-demand curriculum comparison panel.
  programsJavaScript: 350_000,
  // The skip-link leaves the flow so keyboard users no longer see the focus ring jump backwards;
  // its own surface, padding and z-index cost ~160 B.
  // #programas inherits the shared dark surface rules for the create entries and the empty state, so
  // it grows with the entry budget by ~80 B in this batch.
  programsStyles: 56_400,
  oidcJavaScript: 75_000,
})

function collectStaticAssets(manifest, roots) {
  const visitedChunks = new Set()
  const javascript = new Set()
  const styles = new Set()
  const assets = new Set()
  const pending = [...roots]

  while (pending.length > 0) {
    const key = pending.pop()
    if (visitedChunks.has(key)) continue

    const chunk = manifest[key]
    if (!chunk) throw new Error(`Falta el chunk ${key} en el manifiesto de Vite`)
    visitedChunks.add(key)

    if (chunk.file?.endsWith('.js')) javascript.add(chunk.file)
    for (const style of chunk.css ?? []) styles.add(style)
    for (const asset of chunk.assets ?? []) assets.add(asset)
    for (const dependency of chunk.imports ?? []) pending.push(dependency)
  }

  return { javascript: [...javascript], styles: [...styles], assets: [...assets] }
}

function sumAssets(assets, sizeOf) {
  return assets.reduce((total, asset) => {
    const size = sizeOf(asset)
    if (!Number.isSafeInteger(size) || size < 0) {
      throw new Error(`Tamaño inválido para ${asset}: ${size}`)
    }
    return total + size
  }, 0)
}

export function inspectBundleBudget(
  manifest,
  sizeOf,
  budgets = DEFAULT_BUNDLE_BUDGETS,
) {
  const entryAssets = collectStaticAssets(manifest, [ENTRY_KEY])
  const workspaceHomeAssets = collectStaticAssets(manifest, [ENTRY_KEY, WORKSPACE_HOME_KEY])
  const programsPageAssets = collectStaticAssets(manifest, [PROGRAMS_KEY])
  const selectorAssets = collectStaticAssets(manifest, [PROGRAMS_KEY, PUBLIC_SELECTOR_KEY])
  const undergraduateAssets = collectStaticAssets(manifest, [PROGRAMS_KEY, PUBLIC_SELECTOR_KEY, PUBLIC_DIRECTORY_KEY])
  const postgraduateAssets = collectStaticAssets(manifest, [PROGRAMS_KEY, PUBLIC_SELECTOR_KEY, POSTGRADUATE_DIRECTORY_KEY])
  const programsAssets = collectStaticAssets(manifest, [
    PROGRAMS_KEY,
    PUBLIC_SELECTOR_KEY,
    PUBLIC_DIRECTORY_KEY,
    POSTGRADUATE_DIRECTORY_KEY,
  ])
  const branchAssets = [undergraduateAssets, postgraduateAssets]
  const comparisonPanel = manifest[CURRICULUM_COMPARISON_KEY]
  const workspaceHomeChunk = manifest[WORKSPACE_HOME_KEY]
  const publicSelectorChunk = manifest[PUBLIC_SELECTOR_KEY]
  const publicDirectoryChunk = manifest[PUBLIC_DIRECTORY_KEY]
  const postgraduateDirectoryChunk = manifest[POSTGRADUATE_DIRECTORY_KEY]
  const publicCatalogAsset = manifest[PUBLIC_CATALOG_KEY]
  const postgraduateCatalogAsset = manifest[POSTGRADUATE_CATALOG_KEY]
  const oidcChunk = manifest[OIDC_KEY]
  if (!oidcChunk?.file) throw new Error(`Falta el chunk ${OIDC_KEY} en el manifiesto de Vite`)
  const oidcAssets = collectStaticAssets(manifest, [OIDC_KEY])

  const measurements = {
    entryJavaScript: sumAssets(entryAssets.javascript, sizeOf),
    entryStyles: sumAssets(entryAssets.styles, sizeOf),
    workspaceHomeJavaScript: sumAssets(workspaceHomeAssets.javascript, sizeOf),
    workspaceHomeStyles: sumAssets(workspaceHomeAssets.styles, sizeOf),
    programsJavaScript: Math.max(...branchAssets.map((assets) => sumAssets(assets.javascript, sizeOf))),
    programsStyles: Math.max(...branchAssets.map((assets) => sumAssets(assets.styles, sizeOf))),
    programsDataBytes: Math.max(...branchAssets.map((assets) => sumAssets(assets.assets, sizeOf))),
    oidcJavaScript: sumAssets(oidcAssets.javascript, sizeOf),
  }

  const violations = []
  const checks = [
    ['entry JavaScript', measurements.entryJavaScript, budgets.entryJavaScript],
    ['entry CSS', measurements.entryStyles, budgets.entryStyles],
    ['ruta #resumen JavaScript', measurements.workspaceHomeJavaScript, budgets.workspaceHomeJavaScript],
    ['ruta #resumen CSS', measurements.workspaceHomeStyles, budgets.workspaceHomeStyles],
    ['ruta #programas JavaScript', measurements.programsJavaScript, budgets.programsJavaScript],
    ['ruta #programas CSS', measurements.programsStyles, budgets.programsStyles],
    ['datos estáticos de #programas', measurements.programsDataBytes, budgets.programsDataBytes],
    ['chunk OIDC JavaScript', measurements.oidcJavaScript, budgets.oidcJavaScript],
  ]
  for (const [label, size, limit] of checks) {
    if (size > limit) violations.push(`${label}: ${size} B excede el límite de ${limit} B`)
  }

  const entry = manifest[ENTRY_KEY]
  if (
    !entry?.dynamicImports?.includes(WORKSPACE_HOME_KEY)
    || !workspaceHomeChunk?.file
    || entryAssets.javascript.includes(workspaceHomeChunk.file)
  ) {
    violations.push('La portada #resumen debe permanecer en un chunk dinámico separado')
  }

  if (
    !manifest[PROGRAMS_KEY]?.dynamicImports?.includes(PUBLIC_SELECTOR_KEY)
    || !publicSelectorChunk?.file
    || programsPageAssets.javascript.includes(publicSelectorChunk.file)
  ) {
    violations.push('El selector público de #programas debe permanecer en un chunk dinámico separado')
  }

  if (
    !publicSelectorChunk?.dynamicImports?.includes(PUBLIC_DIRECTORY_KEY)
    || !publicSelectorChunk?.dynamicImports?.includes(POSTGRADUATE_DIRECTORY_KEY)
    || !publicDirectoryChunk?.file
    || !postgraduateDirectoryChunk?.file
    || selectorAssets.javascript.includes(publicDirectoryChunk.file)
    || selectorAssets.javascript.includes(postgraduateDirectoryChunk.file)
  ) {
    violations.push('Los directorios de pregrado y posgrado deben permanecer como chunks diferidos del selector público')
  }

  if (
    !publicCatalogAsset?.file
    || !programsAssets.assets.includes(publicCatalogAsset.file)
  ) {
    violations.push('La instantánea pública UPTC debe quedar como asset estático asociado al directorio de #programas')
  }

  if (
    !postgraduateCatalogAsset?.file
    || !postgraduateAssets.assets.includes(postgraduateCatalogAsset.file)
  ) {
    violations.push('La instantánea pública UPTC de posgrado debe quedar como asset estático asociado a su directorio')
  }

  if (
    !entry?.dynamicImports?.includes(OIDC_KEY)
    || oidcAssets.javascript.some((asset) => entryAssets.javascript.includes(asset))
  ) {
    violations.push('OIDC debe permanecer en un chunk dinámico separado')
  }

  if (
    !manifest[PROGRAMS_KEY]?.dynamicImports?.includes(CURRICULUM_COMPARISON_KEY)
    || !comparisonPanel?.file
    || programsAssets.javascript.includes(comparisonPanel.file)
  ) {
    violations.push('La comparación curricular debe permanecer en un chunk dinámico separado')
  }

  if (Object.keys(manifest).some((key) => key.startsWith(ADMISSIONS_DEMO_PREFIX))) {
    violations.push('El laboratorio de admisiones de desarrollo no debe entrar al build de producción')
  }
  if (Object.keys(manifest).some((key) => key.startsWith(STUDENT_DEMO_PREFIX))) {
    violations.push('La experiencia estudiantil de desarrollo no debe entrar al build de producción')
  }
  if (Object.keys(manifest).some((key) => key.startsWith(GRADEBOOK_DEMO_PREFIX))) {
    violations.push('El laboratorio de calificaciones de desarrollo no debe entrar al build de producción')
  }
  if (Object.keys(manifest).some((key) => key.startsWith(ROOM_PLANNING_DEMO_PREFIX))) {
    violations.push('El laboratorio de asignación de aulas de desarrollo no debe entrar al build de producción')
  }
  if (Object.keys(manifest).some((key) => key.startsWith(WORKSPACE_HOME_DEMO_PREFIX))) {
    violations.push('Los recorridos locales de la portada no deben entrar al build de producción')
  }
  if (Object.hasOwn(manifest, LOCAL_PREVIEW_CLIENT_KEY)) {
    violations.push('El cliente de sesión de desarrollador local no debe entrar al build de producción')
  }
  if (Object.hasOwn(manifest, LOCAL_PREVIEW_IDENTITY_KEY)) {
    violations.push('La lógica de sesión de desarrollador local no debe entrar al build de producción')
  }

  return { measurements, violations }
}

function verifyBuiltBundle() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
  const distDirectory = path.resolve(scriptDirectory, '..', 'dist')
  const manifestPath = path.join(distDirectory, '.vite', 'manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const sizeOf = (asset) => statSync(path.resolve(distDirectory, asset)).size
  const { measurements, violations } = inspectBundleBudget(manifest, sizeOf)

  console.log(
    `Bundles: entry ${measurements.entryJavaScript} B JS / ${measurements.entryStyles} B CSS; `
      + `#resumen ${measurements.workspaceHomeJavaScript} B JS / ${measurements.workspaceHomeStyles} B CSS; `
      + `#programas ${measurements.programsJavaScript} B JS / ${measurements.programsStyles} B CSS / ${measurements.programsDataBytes} B JSON; `
      + `OIDC diferido ${measurements.oidcJavaScript} B JS.`,
  )

  if (violations.length > 0) {
    for (const violation of violations) console.error(`ERROR: ${violation}`)
    process.exitCode = 1
    return
  }

  console.log('Presupuestos de bundle verificados.')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyBuiltBundle()
}
