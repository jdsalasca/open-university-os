import { describe, expect, it } from 'vitest'
import snapshot from './uptcUndergraduateCatalog.snapshot.json'
import { filterPublicUndergraduatePrograms } from './publicUndergraduateCatalog'
import type { PublicUndergraduateProgram } from './publicUndergraduateCatalog'

const programs: PublicUndergraduateProgram[] = [
  {
    id: 'engineering-001',
    name: 'Ingeniería Mecánica',
    faculty: 'Facultad de Ingeniería',
    facultyCode: '07',
    level: 'Profesional Universitario',
    modality: 'Presencial',
    placeLabel: 'Tunja',
    locationsSummary: 'Tunja',
    markedOffered: true,
    detailUrl: 'https://www.uptc.edu.co/programs/engineering-001/',
  },
  {
    id: 'education-001',
    name: 'Licenciatura en Educación Básica',
    faculty: 'Ciencias de la Educación',
    facultyCode: '03',
    level: 'Profesional Universitario',
    modality: 'Virtual',
    placeLabel: 'Virtual',
    locationsSummary: 'Tunja, Bogotá y Duitama',
    markedOffered: false,
    detailUrl: 'https://www.uptc.edu.co/programs/education-001/',
  },
]

describe('filterPublicUndergraduatePrograms', () => {
  it('searches without case or accent sensitivity across public program fields', () => {
    const result = filterPublicUndergraduatePrograms(programs, {
      query: 'educacion duitama',
      faculty: '',
      place: '',
      modality: '',
      level: '',
      offered: 'all',
    })

    expect(result).toEqual([programs[1]])
  })

  it('combines faculty, place, modality, level, and source-offer filters', () => {
    const result = filterPublicUndergraduatePrograms(programs, {
      query: '',
      faculty: 'Facultad de Ingeniería',
      place: 'Tunja',
      modality: 'Presencial',
      level: 'Profesional Universitario',
      offered: 'marked',
    })

    expect(result).toEqual([programs[0]])
  })

  it('returns no record when the filters do not match the published snapshot', () => {
    const result = filterPublicUndergraduatePrograms(programs, {
      query: '',
      faculty: 'Facultad de Ingeniería',
      place: 'Bogotá',
      modality: '',
      level: '',
      offered: 'all',
    })

    expect(result).toEqual([])
  })
})

describe('UPTC undergraduate public snapshot', () => {
  it('preserves the observed record counts, source dates, and official detail links', () => {
    const ids = snapshot.programs.map((program) => program.id)
    const officialLinks = snapshot.programs.every((program) => {
      const url = new URL(program.detailUrl)
      return url.protocol === 'https:' && url.hostname === 'www.uptc.edu.co'
    })

    expect(snapshot.source.pageUpdatedAt).toBe('2026-09-15')
    expect(snapshot.source.capturedAt).toBe('2026-10-02')
    expect(snapshot.programs).toHaveLength(79)
    expect(snapshot.programs.filter((program) => program.markedOffered)).toHaveLength(72)
    expect(new Set(ids).size).toBe(ids.length)
    expect(officialLinks).toBe(true)
  })
})
