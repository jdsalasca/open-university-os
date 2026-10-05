import { lazy, Suspense, useState } from 'react'
import './PublicProgramDirectories.scss'

const PublicUndergraduateDirectory = lazy(() => import('./PublicUndergraduateDirectory').then((module) => ({
  default: module.PublicUndergraduateDirectory,
})))
const PublicPostgraduateDirectory = lazy(() => import('./PublicPostgraduateDirectory').then((module) => ({
  default: module.PublicPostgraduateDirectory,
})))

type ProgramLevel = 'pregrado' | 'posgrado'

export function PublicProgramDirectories() {
  const [programLevel, setProgramLevel] = useState<ProgramLevel>('pregrado')

  return (
    <section className="public-program-directories" aria-label="Directorios académicos públicos UPTC">
      <div className="public-program-directory-switch" aria-label="Nivel de formación">
        <button aria-pressed={programLevel === 'pregrado'} onClick={() => setProgramLevel('pregrado')} type="button">
          Pregrado
        </button>
        <button aria-pressed={programLevel === 'posgrado'} onClick={() => setProgramLevel('posgrado')} type="button">
          Posgrado
        </button>
      </div>
      <Suspense fallback={<div className="catalog-loading catalog-loading-directory" role="status">Cargando el directorio público…</div>}>
        {programLevel === 'pregrado' ? <PublicUndergraduateDirectory /> : <PublicPostgraduateDirectory />}
      </Suspense>
    </section>
  )
}
