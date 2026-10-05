import { TerritorialCatalogSelector } from '../../territorial-catalog/TerritorialCatalogSelector'
import type { TerritorialCatalogClient } from '../../territorial-catalog/territorialCatalogClient'

export function TerritorialCatalogDemo({ client }: { client: TerritorialCatalogClient }) {
  return (
    <section className="admissions-lab-view" aria-labelledby="territorial-catalog-demo-title">
      <header className="admissions-lab-view-heading">
        <div>
          <p className="admissions-lab-eyebrow">CATÁLOGO DE REFERENCIA · DEV</p>
          <h2 id="territorial-catalog-demo-title">Explora ubicaciones por código DIVIPOLA</h2>
          <p>Este selector prepara formularios futuros con una referencia pública versionada del DANE.</p>
        </div>
        <span className="admissions-lab-step-count">DANE</span>
      </header>

      <div className="admissions-lab-notice" role="note">
        <strong>Vista de desarrollo · no forma parte de la ficha</strong>
        <span>Prueba el catálogo con datos públicos. La selección solo vive mientras esta pestaña está abierta: no se envía ni se guarda.</span>
      </div>

      <div className="admissions-lab-form">
        <div className="admissions-lab-form-heading">
          <span className="admissions-lab-step-number">↳</span>
          <div><h3>Selector territorial reutilizable</h3><p>El segundo selector se habilita después de elegir un departamento.</p></div>
        </div>
        <TerritorialCatalogSelector client={client} />
      </div>
    </section>
  )
}
