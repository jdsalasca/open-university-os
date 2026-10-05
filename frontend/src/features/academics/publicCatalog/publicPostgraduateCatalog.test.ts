import { describe, expect, it } from 'vitest'
import { filterPublicPostgraduatePrograms } from './publicPostgraduateCatalog'
import type { PublicPostgraduateProgram } from './publicPostgraduateCatalog'

const programs: PublicPostgraduateProgram[] = [
  {
    programCode: '001',
    name: 'Maestría en Educación Ambiental',
    facultyOrUnit: 'Ciencias de la Educación',
    facultyCode: '03',
    level: 'Maestría',
    modality: 'Presencial',
    placeLabel: 'Tunja',
    locationsSummary: 'Tunja',
    detailUrl: 'https://www.uptc.edu.co/programa/001',
  },
  {
    programCode: '002',
    name: 'Especialización en Gestión Ambiental',
    facultyOrUnit: 'Ciencias de la Salud',
    facultyCode: '05',
    level: 'Especialización',
    modality: 'Virtual',
    placeLabel: 'Virtual',
    locationsSummary: 'Duitama',
    detailUrl: 'https://www.uptc.edu.co/programa/002',
  },
]

describe('filterPublicPostgraduatePrograms', () => {
  it('combines accent-insensitive search with faculty, place, modality and level filters', () => {
    // Arrange
    const filters = {
      query: 'educacion tunja',
      facultyOrUnit: 'Ciencias de la Educación',
      place: 'Tunja',
      modality: 'Presencial',
      level: 'Maestría',
    }

    // Act
    const result = filterPublicPostgraduatePrograms(programs, filters)

    // Assert
    expect(result).toEqual([programs[0]])
  })

  it('returns an empty list when active filters do not match the snapshot', () => {
    // Arrange
    const filters = {
      query: '',
      facultyOrUnit: 'Ciencias de la Educación',
      place: 'Virtual',
      modality: '',
      level: '',
    }

    // Act
    const result = filterPublicPostgraduatePrograms(programs, filters)

    // Assert
    expect(result).toEqual([])
  })
})
