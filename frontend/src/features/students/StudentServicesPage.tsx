import { useRef, useState } from 'react'
import { normalizeSearchText } from '../../shared/text/normalizeSearchText'
import { UPTC_OFFICIAL_PAYMENT_GUIDANCE_URL } from '../../shared/officialUptcLinks'
import { StudentAcademicCalendar2026II } from './StudentAcademicCalendar2026II'
import './StudentServicesPage.scss'

type StudentServiceCategory =
  | 'Bienestar'
  | 'Biblioteca'
  | 'Sistemas institucionales'
  | 'Gestiones académicas'
  | 'Calendario académico'
type StudentServiceFilter = 'Todos' | StudentServiceCategory

interface StudentService {
  id: string
  category: StudentServiceCategory
  title: string
  description: string
  searchTerms: readonly string[]
  sourceUrl: string
  sourcePublishedLabel?: string
  sourcePublishedDate?: string
  sourceUpdatedLabel?: string
  sourceUpdatedDate?: string
}

const STUDENT_SERVICES: readonly StudentService[] = [
  {
    id: 'bienestar-universitario',
    category: 'Bienestar',
    title: 'Bienestar Universitario',
    description: 'Explora el portafolio público de servicios de acompañamiento para la comunidad universitaria.',
    searchTerms: ['bienestar', 'acompañamiento', 'servicios universitarios'],
    sourceUrl: 'https://www.uptc.edu.co/sitio/portal/sitios/universidad/rectoria/bie_uni/index.html',
    sourceUpdatedLabel: '1 oct 2026',
  },
  {
    id: 'bienestar-virtual',
    category: 'Bienestar',
    title: 'Bienestar Virtual',
    description: 'Consulta las rutas virtuales publicadas para salud mental y Ruta Violeta, además de la oferta de cultura, desarrollo humano, actividad física, deporte y salud.',
    searchTerms: ['salud mental', 'ruta violeta', 'cultura', 'desarrollo humano', 'actividad física', 'deporte', 'salud'],
    sourceUrl: 'https://www.uptc.edu.co/sitio/portal/sitios/universidad/rectoria/bie_uni/bieVir.html',
    sourceUpdatedLabel: '11 sep 2026',
  },
  {
    id: 'bienestar-cultura',
    category: 'Bienestar',
    title: 'Cultura',
    description: 'La Línea de Cultura promueve la expresión artística, la investigación, la inclusión y la interculturalidad. Confirma la oferta y su vigencia en la fuente oficial.',
    searchTerms: ['línea de cultura', 'expresión artística', 'interculturalidad', 'diversidad'],
    sourceUrl: 'https://www.uptc.edu.co/sitio/portal/sitios/universidad/rectoria/bie_uni/lineas_accion/cultura/',
  },
  {
    id: 'bienestar-actividad-fisica',
    category: 'Bienestar',
    title: 'Actividad Física',
    description: 'La Línea de Actividad Física publica programas para promover estilos de vida saludables. Confirma actividades, sedes y horarios directamente en la fuente oficial.',
    searchTerms: ['línea de actividad física', 'musculación', 'ejercicio cardiovascular', 'hábitos saludables'],
    sourceUrl: 'https://www.uptc.edu.co/sitio/portal/sitios/universidad/rectoria/bie_uni/lineas_accion/act_fisica/index.html',
    sourceUpdatedLabel: '7 jul 2025',
    sourceUpdatedDate: '2025-07-07',
  },
  {
    id: 'apoyo-socioeconomico',
    category: 'Bienestar',
    title: 'Apoyo socioeconómico',
    description: 'Consulta la Línea de Apoyo Socioeconómico de la UPTC para conocer sus programas publicados y confirmar requisitos y vigencia directamente en la fuente.',
    searchTerms: ['apoyo', 'socioeconómico', 'restaurante estudiantil', 'becas', 'residencias', 'renta joven', 'upetecitos'],
    sourceUrl: 'https://www.uptc.edu.co/sitio/portal/sitios/universidad/rectoria/bie_uni/lineas_accion/apoyo/',
    sourceUpdatedLabel: '20 jul 2025',
    sourceUpdatedDate: '2025-07-20',
  },
  {
    id: 'biblioteca-servicios',
    category: 'Biblioteca',
    title: 'Préstamo y consulta bibliográfica',
    description: 'Infórmate sobre consulta en sala, servicios de referencia, formación de usuarios y recursos de Biblioteca.',
    searchTerms: ['préstamo', 'consulta en sala', 'referencia', 'formación de usuarios'],
    sourceUrl: 'https://www.uptc.edu.co/sitio/portal/sitios/universidad/vic_aca/bibl/7secc/01jpp/serv.html',
  },
  {
    id: 'biblioteca-digital',
    category: 'Biblioteca',
    title: 'Biblioteca digital y catálogo',
    description: 'Busca libros, artículos, publicaciones y recursos digitales; algunas colecciones remotas requieren pertenecer a la comunidad UPTC.',
    searchTerms: ['catálogo', 'libros', 'artículos', 'bases de datos', 'recursos digitales'],
    sourceUrl: 'https://www.uptc.edu.co/sitio/portal/sitios/universidad/vic_aca/bibl/0_busq/index.html',
    sourceUpdatedLabel: '8 sep 2026',
  },
  {
    id: 'uptconecta-horarios-calificaciones',
    category: 'Sistemas institucionales',
    title: 'Horarios y calificaciones en UPTConecta',
    description: 'El comunicado institucional describe la consulta de horarios, calificaciones y servicios académicos en la aplicación UPTConecta.',
    searchTerms: ['uptconecta', 'horarios', 'calificaciones', 'sira', 'servicios académicos'],
    sourceUrl: 'https://www.uptc.edu.co/sitio/portal/cal_not_eve/noticias/det/UPTConecta-la-App-institucional-incorpora-nuevos-servicios-para-la-comunidad-upetecista/',
    sourcePublishedLabel: '31 jul 2025',
    sourcePublishedDate: '2025-07-31',
  },
  {
    id: 'sira-estudiante',
    category: 'Sistemas institucionales',
    title: 'SIRA estudiante',
    description: 'Campus Virtual publica el acceso a SIRA para estudiantes. Continúa en el portal oficial; esta plataforma no solicita tus credenciales.',
    searchTerms: ['campus virtual', 'sira', 'estudiante', 'sistemas de información'],
    sourceUrl: 'https://www.uptc.edu.co/sitio/portal/campus_virtual/',
    sourceUpdatedLabel: '20 may 2026',
    sourceUpdatedDate: '2026-05-20',
  },
  {
    id: 'inscripcion-materias',
    category: 'Gestiones académicas',
    title: 'Inscripción de materias',
    description: 'La página institucional reúne las opciones publicadas para inscribir materias. Revisa allí cuál corresponde a tu trámite y su vigencia.',
    searchTerms: ['inscripción de asignaturas', 'sistemas de información', 'estudiantes', 'materias'],
    sourceUrl: 'https://uptc.edu.co/sitio/portal/sitios/estudiantes/sis_inf/',
    sourceUpdatedLabel: '24 jun 2025',
    sourceUpdatedDate: '2025-06-24',
  },
  {
    id: 'fechas-pregrado-estudiantes',
    category: 'Calendario académico',
    title: 'Fechas académicas de pregrado',
    description: 'Consulta las fechas que UPTC publica para estudiantes de pregrado y confirma el periodo vigente directamente en la fuente.',
    searchTerms: ['calendario', 'fechas', 'trámites', 'pregrado', 'estudiante'],
    sourceUrl: 'https://uptc.edu.co/sitio/portal/sitios/universidad/vic_aca/adm_reg/2estu/est_pre.html',
    sourceUpdatedLabel: '17 sep 2026',
    sourceUpdatedDate: '2026-09-17',
  },
  {
    id: 'pagos-recibos',
    category: 'Gestiones académicas',
    title: 'Pagos y recibos',
    description: 'Consulta la guía oficial de pagos y recibos de la UPTC. Universiry no recibe pagos ni datos bancarios.',
    searchTerms: ['pagos', 'recibos', 'recaudo', 'derechos pecuniarios'],
    sourceUrl: UPTC_OFFICIAL_PAYMENT_GUIDANCE_URL,
  },
]

const STUDENT_SERVICE_FILTERS: readonly StudentServiceFilter[] = [
  'Todos',
  ...Array.from(new Set(STUDENT_SERVICES.map((service) => service.category))),
]


export function StudentServicesPage() {
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<StudentServiceFilter>('Todos')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const normalizedQuery = normalizeSearchText(query)
  const visibleServices = STUDENT_SERVICES.filter((service) => {
    const searchableText = [service.category, service.title, service.description, ...service.searchTerms].join(' ')
    const matchesCategory = selectedCategory === 'Todos' || service.category === selectedCategory
    const matchesQuery = !normalizedQuery || normalizeSearchText(searchableText).includes(normalizedQuery)
    return matchesCategory && matchesQuery
  })

  return (
    <section className="student-services-page" aria-labelledby="student-services-title">
      <header className="student-services-hero">
        <div className="student-services-hero-copy">
          <p className="student-services-eyebrow"><span aria-hidden="true">✳</span> Vida universitaria · orientación</p>
          <h1 id="student-services-title">Servicios para acompañar tu vida universitaria</h1>
          <p className="student-services-intro">
            Encuentra información pública sobre rutas académicas, bienestar y recursos de aprendizaje. Cada enlace continúa en el portal oficial de la UPTC.
          </p>
        </div>
        <div className="student-services-hero-mark" aria-hidden="true">
          <span>UPTC</span>
          <strong>Campus<br />y comunidad</strong>
          <i />
        </div>
      </header>

      <section className="student-services-explorer" aria-label="Directorio de servicios">
        <div className="student-services-search-row">
          <div className="student-services-search-field">
            <label htmlFor="student-services-search">Buscar servicios estudiantiles</label>
            <div className="student-services-search-control">
              <span aria-hidden="true">⌕</span>
              <input
                id="student-services-search"
                ref={searchInputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ej. calificaciones, calendario, biblioteca…"
                aria-describedby="student-services-privacy"
              />
            </div>
          </div>
          <div className="student-services-count" aria-live="polite" aria-atomic="true">
            <strong>{visibleServices.length}</strong>
            <span>{visibleServices.length === 1 ? 'servicio disponible' : 'servicios disponibles'}</span>
          </div>
        </div>

        <div className="student-services-categories" role="group" aria-label="Filtrar por categoría">
          {STUDENT_SERVICE_FILTERS.map((category) => (
            <button
              aria-pressed={selectedCategory === category}
              key={category}
              onClick={() => setSelectedCategory(category)}
              type="button"
            >
              {category}
            </button>
          ))}
        </div>

        <p className="student-services-privacy" id="student-services-privacy">
          <span aria-hidden="true">↗</span>
          Este directorio enlaza información pública. No ingreses aquí contraseñas ni datos personales.
        </p>

        {visibleServices.length === 0 ? (
          <div className="student-services-empty" role="status">
            <h2>No encontramos servicios con esos filtros.</h2>
            <p>Prueba otras palabras o muestra de nuevo todas las categorías.</p>
            <button
              onClick={() => {
                setQuery('')
                setSelectedCategory('Todos')
                searchInputRef.current?.focus()
              }}
              type="button"
            >
              Limpiar búsqueda y filtros
            </button>
          </div>
        ) : (
          <div className="student-services-grid">
            {visibleServices.map((service) => (
              <article
                className={`student-service-card student-service-card--${categoryClassName(service.category)}`}
                key={service.id}
                aria-labelledby={`student-service-title-${service.id}`}
              >
                <div className="student-service-card-topline">
                  <span className="student-service-symbol" aria-hidden="true">
                    {service.category === 'Bienestar' ? '◎' : service.category === 'Sistemas institucionales' ? '◷' : '▤'}
                  </span>
                  <span className="student-service-category">{service.category}</span>
                </div>
                <h2 id={`student-service-title-${service.id}`}>{service.title}</h2>
                <p className="student-service-description">{service.description}</p>
                <div className="student-service-card-bottom">
                  <a
                    href={service.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Consultar ${service.title} en el portal oficial UPTC`}
                  >
                    Consultar fuente oficial <span aria-hidden="true">↗</span>
                  </a>
                  <small>
                    Fuente oficial UPTC
                    {service.sourcePublishedLabel && service.sourcePublishedDate
                      ? <> · <time dateTime={service.sourcePublishedDate}>comunicado publicado {service.sourcePublishedLabel}</time></>
                      : ''}
                    {service.sourceUpdatedLabel && service.sourceUpdatedDate
                      ? <> · <time dateTime={service.sourceUpdatedDate}>actualizada {service.sourceUpdatedLabel}</time></>
                      : service.sourceUpdatedLabel ? ` · actualizada ${service.sourceUpdatedLabel}` : ''}
                  </small>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <StudentAcademicCalendar2026II />
    </section>
  )
}

function categoryClassName(category: StudentServiceCategory): string {
  return category
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es')
    .replace(/\s+/g, '-')
}
