import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SpaceDirectorySnapshot, SpaceLocation } from './spaceGuideContracts'
import type { SpaceGuideClient } from './spaceGuideClient'
import { SpaceGuidePage } from './SpaceGuidePage'

afterEach(cleanup)

const locations: SpaceLocation[] = [
  {
    id: 'site-central-tunja', kind: 'CAMPUS', name: 'Sede Central Tunja', municipality: 'Tunja',
    department: 'Boyacá', address: 'Avenida Central del Norte 39-115', locationDetail: null,
    mapQuery: 'Avenida Central del Norte 39-115, Tunja, Boyacá, Colombia',
    source: {
      label: 'Localización y sedes UPTC', url: 'https://uptc.edu.co/sitio/portal/sitios/localizacion/',
      checkedAt: '2026-10-01', sourceUpdatedAt: '2026-07-03',
    },
    announcement: null,
  },
  {
    id: 'cread-chiquinquira', kind: 'CREAD', name: 'CREAD Chiquinquirá', municipality: 'Chiquinquirá',
    department: null, address: 'Calle 14 No. 2-37, barrio Sucre', locationDetail: null,
    mapQuery: 'Calle 14 No. 2-37, barrio Sucre, Chiquinquirá',
    source: {
      label: 'Localización y sedes UPTC', url: 'https://uptc.edu.co/sitio/portal/sitios/localizacion/',
      checkedAt: '2026-10-01', sourceUpdatedAt: '2026-07-03',
    },
    announcement: null,
  },
  {
    id: 'service-acra', kind: 'SERVICE', name: 'Admisiones y Control de Registro Académico (ACRA)',
    municipality: 'Tunja', department: 'Boyacá', address: 'Sede Central Tunja, Avenida Central del Norte 39-115',
    locationDetail: 'Edificio de Admisiones, primer piso',
    mapQuery: 'Edificio de Admisiones UPTC, Avenida Central del Norte 39-115, Tunja, Boyacá',
    source: {
      label: 'Contacto ACRA UPTC', url: 'https://uptc.edu.co/sitio/portal/sitios/universidad/vic_aca/adm_reg/cont.html',
      checkedAt: '2026-10-01', sourceUpdatedAt: null,
    },
    announcement: null,
  },
]

const snapshot: SpaceDirectorySnapshot = {
  locations,
  officialOfficeDirectoryUrl: 'https://www.uptc.edu.co/sitio/portal/sitios/directorio/',
  requestPathways: [
    {
      id: 'auditoriums-admin-spaces', kind: 'AUDITORIUM_OR_ACADEMIC_SPACE',
      title: 'Auditorios y espacios académicos o administrativos', audience: 'Solicitantes según la unidad responsable',
      summary: 'La unidad responsable revisa disponibilidad, viabilidad y requisitos; el alquiler depende del espacio y servicio.',
      availabilityNote: 'La plataforma no muestra disponibilidad ni confirma reservas.',
      sources: [{ label: 'Servicios Docente Asistenciales UPTC', url: 'https://dsp.uptc.edu.co/sitio/portal/sitios/universidad/vic_aca/sd_asistenciales/index.html', checkedAt: '2026-10-01', sourceUpdatedAt: null }],
    },
    {
      id: 'sports-venues', kind: 'SPORTS_VENUE',
      title: 'Escenarios deportivos', audience: 'Solicitantes según el reglamento institucional',
      summary: 'La solicitud se dirige a Bienestar Universitario; consulta requisitos, tarifas y anticipación con el responsable.',
      availabilityNote: 'La plataforma no muestra disponibilidad ni confirma reservas.',
      sources: [{ label: 'Resolución 7189 de 2017', url: 'https://www.uptc.edu.co/export/sites/default/secretaria_general/rectoria/resoluciones_2017/Resolucion_7189_2017.pdf', checkedAt: '2026-10-01', sourceUpdatedAt: null }],
    },
    {
      id: 'library-rooms', kind: 'LIBRARY_ROOM',
      title: 'Salas y espacios de biblioteca', audience: 'Comunidad UPTC según las condiciones de cada sala',
      summary: 'Consulta los términos, la disponibilidad y el canal de reserva de la biblioteca y seccional correspondiente.',
      availabilityNote: 'Los aforos publicados son referenciales; no indican cupos disponibles.',
      sources: [{ label: 'Servicios de Biblioteca Presencial UPTC', url: 'https://www.uptc.edu.co/sitio/portal/sitios/universidad/vic_aca/bibl/4_bpd/blbl_pres.html', checkedAt: '2026-10-01', sourceUpdatedAt: null }],
    },
    {
      id: 'computer-classrooms', kind: 'COMPUTER_CLASSROOM',
      title: 'Aulas de informática', audience: 'Docentes y dependencias académicas',
      summary: 'DTIC distingue la asignación semestral para clase de la solicitud extra-clase para una fecha específica.',
      availabilityNote: 'La programación se consulta y tramita en los canales oficiales de DTIC.',
      sources: [{ label: 'Servicio de Aulas de Informática DTIC', url: 'https://www.uptc.edu.co/sitio/portal/sitios/universidad/rectoria/dtics/04_catserv/aulas.html', checkedAt: '2026-10-01', sourceUpdatedAt: '2025-08-14' }],
    },
    {
      id: 'staff-break-room', kind: 'INTERNAL_STAFF_SPACE',
      title: 'Break Room para personal administrativo', audience: 'Personal administrativo UPTC',
      summary: 'La publicación institucional dirige las solicitudes anticipadas a Talento Humano y áreas responsables.',
      availabilityNote: 'Uso interno sujeto a aprobación y coordinación institucional.',
      sources: [{ label: 'Comunicado institucional sobre el Break Room', url: 'https://www.uptc.edu.co/sitio/portal/cal_not_eve/noticias/det/UPTC-invierte-en-comodidad-y-productividad-para-sus-funcionarios-con-el-nuevo-Break-Room/', checkedAt: '2026-10-01', sourceUpdatedAt: null }],
    },
  ],
}

function clientReturning(data: SpaceDirectorySnapshot = snapshot): SpaceGuideClient {
  return { listSpaces: vi.fn().mockResolvedValue(data) }
}

describe('SpaceGuidePage', () => {
  it('shows Music capacities as separate announcements, links both source contexts, and offers no map', async () => {
    // Arrange
    const music = {
      id: 'service-music-library-2026',
      kind: 'SERVICE',
      name: 'Biblioteca de Música y Sala de Estudio · UPTC',
      municipality: 'Tunja',
      department: null,
      address: null,
      locationDetail: 'Segundo piso del Edificio de Música, según comunicado UPTC.',
      mapQuery: null,
      source: {
        label: 'Comunicado UPTC n.º 067 · Escuela de Música',
        url: 'https://www.uptc.edu.co/sitio/mercury-demo/detail-pages/article/Escuela-de-Musica-de-la-UPTC-estrena-biblioteca-y-sala-de-estudio-nuevos-espacios-para-la-formacion-y-la-creacion-artistica/',
        checkedAt: '2026-10-03',
        sourceUpdatedAt: '2026-03-24',
      },
      announcement: {
        capacities: [
          { areaName: 'Zona de estudio teórico e histórico', announcedCapacityPersons: 30 },
          { areaName: 'Zona de atención central', announcedCapacityPersons: 8 },
          { areaName: 'Sala de estudio', announcedCapacityPersons: 25 },
        ],
        locationNote: 'El comunicado ubica los nuevos espacios en el segundo piso; la ficha de biblioteca aún indica el primero. Confirma antes de desplazarte.',
        locationReferences: [{
          label: 'Biblioteca de la Facultad de Estudios a Distancia · Biblioteca de Música',
          url: 'https://www.uptc.edu.co/sitio/portal/sitios/universidad/vic_aca/bibl/7secc/06fac/index.html',
          checkedAt: '2026-10-03',
          sourceUpdatedAt: '2024-10-10',
        }, {
          label: 'Biblioteca presencial UPTC · Biblioteca Especializada en Música',
          url: 'https://www.uptc.edu.co/sitio/portal/sitios/universidad/vic_aca/bibl/4_bpd/blbl_pres.html',
          checkedAt: '2026-10-03',
          sourceUpdatedAt: '2022-08-11',
        }],
      },
    } as unknown as SpaceLocation
    render(<SpaceGuidePage client={clientReturning({ ...snapshot, locations: [music] })} />)

    // Act
    const card = await screen.findByRole('article', { name: 'Biblioteca de Música y Sala de Estudio · UPTC' })

    // Assert
    expect(within(card).getByRole('heading', { name: 'Capacidades anunciadas' })).toBeVisible()
    expect(within(card).getByText('30 personas')).toBeVisible()
    expect(within(card).getByText('8 personas')).toBeVisible()
    expect(within(card).getByText('25 personas')).toBeVisible()
    expect(card).toHaveTextContent('no indican disponibilidad actual')
    expect(card).toHaveTextContent(/segundo piso.*primer.*Confirma/i)
    expect(within(card).getByRole('link', { name: 'Comunicado UPTC n.º 067 · Escuela de Música' }))
      .toHaveAttribute('href', music.source.url)
    expect(within(card).getByRole('link', {
      name: 'Biblioteca de la Facultad de Estudios a Distancia · Biblioteca de Música',
    })).toHaveAttribute('href', music.announcement!.locationReferences[0].url)
    expect(within(card).getByRole('link', { name: 'Biblioteca presencial UPTC · Biblioteca Especializada en Música' }))
      .toHaveAttribute('href', music.announcement!.locationReferences[1].url)
    expect(within(card).queryByRole('link', { name: /abrir búsqueda de mapa/i })).not.toBeInTheDocument()
    expect(within(card).queryByText('63 personas')).not.toBeInTheDocument()
  })

  it('shows the Goranchacha public opening notice with attributed approximate capacity and no invented map', async () => {
    // Arrange
    const goranchacha: SpaceLocation = {
      id: 'auditorium-goranchacha-2026',
      kind: 'SERVICE',
      name: 'Auditorio Goranchacha · UPTC',
      municipality: 'Tunja',
      department: 'Boyacá',
      address: null,
      locationDetail: 'Edificio de Posgrados, Sede Central de Tunja, según el comunicado UPTC.',
      mapQuery: null,
      source: {
        label: 'Comunicado UPTC n.º 230 · apertura del Auditorio Goranchacha',
        url: 'https://uptc.edu.co/sitio/portal/cal_not_eve/noticias/det/Nuevo-Auditorio-Goranchacha-de-la-UPTC-abrio-sus-puertas-a-la-comunidad-universitaria/',
        checkedAt: '2026-10-04',
        sourceUpdatedAt: '2026-09-09',
      },
      announcement: {
        capacities: [{ areaName: 'Capacidad aproximada', announcedCapacityPersons: 450 }],
        locationNote: 'Comunicado del 9 de septiembre de 2026. El aforo es aproximado y no indica disponibilidad.',
        locationReferences: [{
          label: 'UPTC Radio · referencia pública del Auditorio Goranchacha',
          url: 'https://dsp.uptc.edu.co/sitio/portal/cal_not_eve/noticias/det/UPTC-Radio-celebra-25-anos-al-aire-como-voz-academica-cultural-e-institucional-de-la-Universidad/',
          checkedAt: '2026-10-04',
          sourceUpdatedAt: '2026-09-29',
        }],
      },
    }
    render(<SpaceGuidePage client={clientReturning({ ...snapshot, locations: [goranchacha] })} />)

    // Act
    const card = await screen.findByRole('article', { name: 'Auditorio Goranchacha · UPTC' })

    // Assert
    expect(within(card).getByText('Edificio de Posgrados, Sede Central de Tunja, según el comunicado UPTC.'))
      .toBeVisible()
    expect(within(card).getByText('Capacidad aproximada')).toBeVisible()
    expect(within(card).getByText('450 personas')).toBeVisible()
    expect(within(card).getByText(/aforo es aproximado y no indica disponibilidad/i)).toBeVisible()
    expect(within(card).getByRole('link', { name: 'Comunicado UPTC n.º 230 · apertura del Auditorio Goranchacha' }))
      .toHaveAttribute('href', goranchacha.source.url)
    expect(within(card).getByRole('link', { name: 'UPTC Radio · referencia pública del Auditorio Goranchacha' }))
      .toHaveAttribute('target', '_blank')
    expect(within(card).queryByRole('link', { name: /abrir búsqueda de mapa/i })).not.toBeInTheDocument()
  })

  it('loads the sourced campus, CREAD and service cards with map and source links', async () => {
    // Arrange
    const client = clientReturning()
    render(<SpaceGuidePage client={client} />)

    // Act
    const campusCard = await screen.findByRole('article', { name: /sede central tunja/i })

    // Assert
    expect(screen.getByRole('heading', { name: 'Guía de espacios' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('3 de 3 espacios')
    expect(within(campusCard).getByRole('link', { name: /abrir búsqueda de mapa para sede central tunja/i }))
      .toHaveAttribute('href', expect.stringContaining('openstreetmap.org/search?query='))
    expect(within(campusCard).getByRole('link', { name: 'Localización y sedes UPTC' }))
      .toHaveAttribute('href', 'https://uptc.edu.co/sitio/portal/sitios/localizacion/')
    expect(screen.getByRole('link', { name: /directorio oficial de oficinas/i })).toHaveAttribute(
      'href', snapshot.officialOfficeDirectoryUrl,
    )
  })

  it('searches without accents and combines the text query with a location type filter', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<SpaceGuidePage client={clientReturning()} />)
    await screen.findByRole('article', { name: /cread chiquinquirá/i })

    // Act
    await user.type(screen.getByRole('searchbox', { name: 'Buscar espacios o rutas oficiales' }), 'chiquinquira')

    // Assert
    expect(screen.getByRole('article', { name: /cread chiquinquirá/i })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('1 de 3 espacios')
    await user.clear(screen.getByRole('searchbox', { name: 'Buscar espacios o rutas oficiales' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por tipo' }), 'SERVICE')
    await user.type(screen.getByRole('searchbox', { name: 'Buscar espacios o rutas oficiales' }), 'TUNJA')

    // Assert
    expect(screen.getByRole('article', { name: /acra/i })).toBeVisible()
    expect(screen.queryByRole('article', { name: /sede central tunja/i })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('1 de 3 espacios')
    await user.clear(screen.getByRole('searchbox', { name: 'Buscar espacios o rutas oficiales' }))
    await user.type(screen.getByRole('searchbox', { name: 'Buscar espacios o rutas oficiales' }), 'chiquinquira')
    expect(screen.getByRole('status')).toHaveTextContent('0 de 3 espacios')
  })

  it('filters by distinct published municipalities and combines municipality, type and text', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<SpaceGuidePage client={clientReturning()} />)
    await screen.findByRole('article', { name: /sede central tunja/i })
    const municipalityFilter = screen.getByRole('combobox', { name: 'Filtrar por municipio' })

    // Act
    await user.selectOptions(municipalityFilter, 'Chiquinquirá')

    // Assert
    expect(within(municipalityFilter).getAllByRole('option').map((option) => option.textContent))
      .toEqual(['Todos los municipios', 'Chiquinquirá', 'Tunja'])
    expect(screen.getByRole('article', { name: /cread chiquinquirá/i })).toBeVisible()
    expect(screen.queryByRole('article', { name: /sede central tunja/i })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('1 de 3 espacios')

    await user.selectOptions(municipalityFilter, 'Tunja')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por tipo' }), 'SERVICE')
    await user.type(screen.getByRole('searchbox', { name: 'Buscar espacios o rutas oficiales' }), 'acra')

    expect(screen.getByRole('article', { name: /acra/i })).toBeVisible()
    expect(screen.queryByRole('article', { name: /sede central tunja/i })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('1 de 3 espacios')
  })

  it('clears a municipality filter when a refreshed directory no longer contains that municipality', async () => {
    // Arrange
    const user = userEvent.setup()
    const { rerender } = render(<SpaceGuidePage client={clientReturning()} />)
    await screen.findByRole('article', { name: /cread chiquinquirá/i })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por municipio' }), 'Chiquinquirá')

    // Act
    rerender(<SpaceGuidePage client={clientReturning({ ...snapshot, locations: [locations[0], locations[2]] })} />)

    // Assert
    expect(await screen.findByRole('article', { name: /acra/i })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('2 de 2 espacios')
    expect(screen.getByRole('combobox', { name: 'Filtrar por municipio' })).toHaveValue('ALL')
  })

  it('shows an empty-search state and lets the visitor clear filters', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<SpaceGuidePage client={clientReturning()} />)
    await screen.findByRole('article', { name: /sede central tunja/i })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por municipio' }), 'Chiquinquirá')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por tipo' }), 'SERVICE')

    // Act
    const search = screen.getByRole('searchbox', { name: 'Buscar espacios o rutas oficiales' })
    await user.click(search)
    await user.paste('lugar inexistente')

    // Assert
    expect(screen.getByText('No encontramos espacios con esos filtros.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(screen.getByRole('status')).toHaveTextContent('3 de 3 espacios')
    expect(screen.getByRole('combobox', { name: 'Filtrar por municipio' })).toHaveValue('ALL')
    expect(screen.getByRole('combobox', { name: 'Filtrar por tipo' })).toHaveValue('ALL')
  })

  it('reports a loading failure and retries the public catalog request', async () => {
    // Arrange
    const user = userEvent.setup()
    const client: SpaceGuideClient = {
      listSpaces: vi.fn()
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValueOnce(snapshot),
    }
    render(<SpaceGuidePage client={client} />)

    // Act
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    // Assert
    expect(await screen.findByRole('article', { name: /acra/i })).toBeVisible()
    expect(client.listSpaces).toHaveBeenCalledTimes(2)
  })

  it('does not create an external map link for a location without a published street address', async () => {
    // Arrange
    const incompleteLocation = {
      ...locations[2], address: null, locationDetail: 'Segundo piso de la biblioteca municipal', mapQuery: null,
    } as SpaceLocation
    render(<SpaceGuidePage client={clientReturning({ ...snapshot, locations: [incompleteLocation] })} />)

    // Act
    const serviceCard = await screen.findByRole('article', { name: /acra/i })

    // Assert
    expect(within(serviceCard).queryByRole('link', { name: /abrir búsqueda de mapa/i })).not.toBeInTheDocument()
  })

  it('shows separate official pathways for borrowing, room assignment and rental without claiming availability', async () => {
    // Arrange
    render(<SpaceGuidePage client={clientReturning()} />)

    // Act
    const pathways = await screen.findByRole('region', { name: 'Préstamo, asignación y alquiler' })

    // Assert
    for (const title of snapshot.requestPathways.map((pathway) => pathway.title)) {
      expect(within(pathways).getByRole('article', { name: title })).toBeVisible()
    }
    expect(within(pathways).getByRole('link', { name: 'Consultar Servicios de Biblioteca Presencial UPTC' }))
      .toHaveAttribute('href', snapshot.requestPathways[2].sources[0].url)
    expect(pathways).toHaveTextContent('La plataforma no muestra disponibilidad ni confirma reservas.')
    expect(pathways.querySelector('form')).toBeNull()
    expect(pathways.querySelector('input')).toBeNull()
  })

  it('finds an official rental pathway while reporting location and pathway results separately', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<SpaceGuidePage client={clientReturning()} />)
    await screen.findByRole('article', { name: /sede central tunja/i })

    // Act
    await user.type(screen.getByRole('searchbox', { name: 'Buscar espacios o rutas oficiales' }), 'ALQUILER')

    // Assert
    const pathways = screen.getByRole('region', { name: 'Préstamo, asignación y alquiler' })
    expect(within(pathways).getByRole('article', { name: 'Auditorios y espacios académicos o administrativos' }))
      .toBeVisible()
    expect(within(pathways).queryByRole('article', { name: 'Escenarios deportivos' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('0 de 3 espacios')
    expect(screen.getByRole('status')).toHaveTextContent('1 de 5 recorridos')
    expect(screen.getByText('No encontramos espacios con esos filtros.')).toBeVisible()
  })

  it('normalizes accents and keeps type and municipality filters limited to places', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<SpaceGuidePage client={clientReturning()} />)
    await screen.findByRole('article', { name: /sede central tunja/i })

    // Act
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por tipo' }), 'CREAD')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por municipio' }), 'Chiquinquirá')
    await user.type(screen.getByRole('searchbox', { name: 'Buscar espacios o rutas oficiales' }), 'ASIGNACION')

    // Assert
    const pathways = screen.getByRole('region', { name: 'Préstamo, asignación y alquiler' })
    expect(within(pathways).getByRole('article', { name: 'Aulas de informática' })).toBeVisible()
    expect(within(pathways).queryByRole('article', { name: 'Auditorios y espacios académicos o administrativos' }))
      .not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('0 de 3 espacios')
    expect(screen.getByRole('status')).toHaveTextContent('1 de 5 recorridos')
  })

  it('searches official source labels and offers an independent way to clear a pathway query', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<SpaceGuidePage client={clientReturning()} />)
    await screen.findByRole('article', { name: /sede central tunja/i })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por tipo' }), 'CREAD')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por municipio' }), 'Chiquinquirá')
    const search = screen.getByRole('searchbox', { name: 'Buscar espacios o rutas oficiales' })

    // Act
    await user.type(search, 'resolucion 7189')

    // Assert
    const pathways = screen.getByRole('region', { name: 'Préstamo, asignación y alquiler' })
    expect(within(pathways).getByRole('article', { name: 'Escenarios deportivos' })).toBeVisible()
    expect(within(pathways).queryByRole('article', { name: 'Salas y espacios de biblioteca' }))
      .not.toBeInTheDocument()
    expect(within(pathways).getByText(/1 de 5 recorridos/)).toBeVisible()

    await user.clear(search)
    await user.type(search, 'sin coincidencias')
    expect(screen.getByText('No encontramos recorridos oficiales para esta búsqueda.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }))
    expect(search).toHaveValue('')
    expect(within(pathways).getAllByRole('article')).toHaveLength(snapshot.requestPathways.length)
    expect(screen.getByRole('status')).toHaveTextContent('1 de 3 espacios')
    expect(screen.getByRole('combobox', { name: 'Filtrar por tipo' })).toHaveValue('CREAD')
    expect(screen.getByRole('combobox', { name: 'Filtrar por municipio' })).toHaveValue('Chiquinquirá')
  })
})
