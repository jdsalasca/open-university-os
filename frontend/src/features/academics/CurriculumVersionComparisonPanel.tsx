import type {
  CurriculumVersionComparison,
  CurriculumVersionComparisonChangedField,
} from './contracts'
import './CurriculumVersionComparisonPanel.scss'

interface CurriculumVersionComparisonPanelProps {
  comparison: CurriculumVersionComparison
}

export default function CurriculumVersionComparisonPanel({ comparison }: CurriculumVersionComparisonPanelProps) {
  return (
    <section className="catalog-version-comparison" aria-labelledby="catalog-version-comparison-title">
      <p className="catalog-eyebrow">REVISIÓN INFORMATIVA</p>
      <h4 id="catalog-version-comparison-title">Comparación informativa</h4>
      {comparison.status === 'NO_REFERENCE'
        ? <p className="catalog-version-comparison-empty" role="status">
            No existe una versión publicada comparable para este programa, nivel, modalidad y sede. No se realizó una comparación.
          </p>
        : <ComparedCurriculumVersion comparison={comparison} />}
    </section>
  )
}

function ComparedCurriculumVersion({ comparison }: {
  comparison: Extract<CurriculumVersionComparison, { status: 'COMPARED' }>
}) {
  const date = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' })
    .format(new Date(comparison.reference.publishedAt))
  const cohort = comparison.reference.cohortThrough
    ? `${comparison.reference.cohortFrom} a ${comparison.reference.cohortThrough}`
    : `${comparison.reference.cohortFrom} en adelante`
  const categories = [
    { name: 'Nuevas', samples: comparison.addedSamples },
    { name: 'Retiradas', samples: comparison.removedSamples },
    { name: 'Modificadas', samples: comparison.modifiedSamples },
    { name: 'Sin cambio', samples: comparison.unchangedSamples },
  ]
  const changedFieldLabels: Record<CurriculumVersionComparisonChangedField, string> = {
    NAME: 'Nombre',
    CREDITS: 'Créditos',
    SEMESTER: 'Semestre',
    ORDER: 'Orden',
    FORMATION_SPACE: 'Espacio de formación',
    COMPONENT: 'Componente',
    CHOICE_GROUP: 'Grupo de opción',
  }

  return (
    <div className="catalog-version-comparison-result">
      <p className="catalog-version-comparison-reference">
        Referencia: versión publicada {comparison.reference.curriculumVersion} · cohortes {cohort}
      </p>
      <p className="catalog-version-comparison-date">Publicado el {date}</p>
      <ul className="catalog-version-comparison-counts" aria-label="Conteos por categoría">
        <li>Nuevas: {comparison.counts.added}</li>
        <li>Retiradas: {comparison.counts.removed}</li>
        <li>Modificadas: {comparison.counts.modified}</li>
        <li>Sin cambio: {comparison.counts.unchanged}</li>
      </ul>
      <div className="catalog-version-comparison-categories">
        {categories.map((category) => category.samples.length > 0 && (
          <div className="catalog-version-comparison-category" key={category.name}>
            <h5>{category.name}</h5>
            <ul>
              {category.samples.map((sample, index) => (
                <li key={`${sample.subjectCode}-${index}`}>
                  <code>{sample.subjectCode}</code>
                  {sample.subjectName !== undefined && sample.semester !== undefined && (
                    <>
                      <span className="catalog-version-comparison-subject-name">{sample.subjectName}</span>
                      <span className="catalog-version-comparison-subject-semester">Semestre {sample.semester}</span>
                    </>
                  )}
                  {sample.changedFields.length > 0 && (
                    <span>Cambios: {sample.changedFields.map((field) => changedFieldLabels[field]).join(', ')}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="catalog-version-comparison-note">
        Los conteos cubren todas las asignaturas; se muestran hasta diez ejemplos por categoría. La comparación orienta la revisión y no aplica equivalencias.
      </p>
    </div>
  )
}
