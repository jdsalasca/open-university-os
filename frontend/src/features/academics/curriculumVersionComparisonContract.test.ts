import { describe, expect, it } from 'vitest'
import { parseCurriculumImportPreview } from './contracts'

const preview = {
  programCode: 'PRG-12345',
  academicLevel: 'PREGRADO',
  studyModality: 'PRESENCIAL',
  sniesCode: '12345',
  programName: 'Programa sintético',
  faculty: 'Facultad de prueba',
  campusCode: 'TUNJA',
  campusName: 'Tunja',
  curriculumVersion: 'V2',
  cohortFrom: '2026-1',
  cohortThrough: null,
  approvalReference: 'Referencia sintética',
  entryCount: 1,
  semesters: [1],
  sampleEntries: [{
    sourceRowNumber: 2,
    rowOrder: 1,
    semester: 1,
    subjectCode: 'SUB-001',
    subjectName: 'Álgebra',
    credits: 3,
    formationSpace: 'Disciplinar',
    component: 'Obligatorio',
    choiceGroup: null,
  }],
}

const noReference = {
  status: 'NO_REFERENCE',
  reference: null,
  counts: null,
  addedSamples: [],
  removedSamples: [],
  modifiedSamples: [],
  unchangedSamples: [],
}

const compared = {
  status: 'COMPARED',
  reference: {
    curriculumId: '46e7938c-cbab-4f97-9dc5-0ad1ab04603d',
    curriculumVersion: 'V1',
    cohortFrom: '2025-1',
    cohortThrough: null,
    publishedAt: '2025-01-10T10:00:00Z',
  },
  counts: { added: 0, removed: 1, modified: 0, unchanged: 1 },
  addedSamples: [],
  removedSamples: [{ subjectCode: 'SUB-OLD', changedFields: [] }],
  modifiedSamples: [],
  unchangedSamples: [{ subjectCode: 'SUB-001', changedFields: [] }],
}

describe('parseCurriculumImportPreview comparison contract', () => {
  it('parses an explicit no-reference state without counts', async () => {
    // Arrange
    const response = { ...preview, comparison: noReference }

    // Act
    const parsed = await parseCurriculumImportPreview(response)

    // Assert
    expect(parsed).toMatchObject({ comparison: noReference })
  })

  it('parses reference metadata, complete counts, and changed-field samples', async () => {
    // Arrange
    const response = {
      ...preview,
      entryCount: 2,
      sampleEntries: [preview.sampleEntries[0], { ...preview.sampleEntries[0], rowOrder: 2, subjectCode: 'SUB-002' }],
      comparison: {
        ...compared,
        counts: { added: 1, removed: 1, modified: 1, unchanged: 0 },
        addedSamples: [{ subjectCode: 'SUB-NEW', changedFields: [] }],
        modifiedSamples: [{ subjectCode: 'SUB-002', changedFields: ['CREDITS', 'CHOICE_GROUP'] }],
        unchangedSamples: [],
      },
    }

    // Act
    const parsed = await parseCurriculumImportPreview(response)

    // Assert
    expect(parsed).toMatchObject({ comparison: response.comparison })
  })

  it('parses descriptive metadata for samples in every comparison category', async () => {
    // Arrange
    const response = {
      ...preview,
      entryCount: 3,
      comparison: {
        ...compared,
        counts: { added: 1, removed: 1, modified: 1, unchanged: 1 },
        addedSamples: [{ subjectCode: 'SUB-NEW', subjectName: 'Biología', semester: 2, changedFields: [] }],
        removedSamples: [{ subjectCode: 'SUB-OLD', subjectName: 'Química', semester: 3, changedFields: [] }],
        modifiedSamples: [{ subjectCode: 'SUB-EDIT', subjectName: 'Física moderna', semester: 4, changedFields: ['NAME'] }],
        unchangedSamples: [{ subjectCode: 'SUB-SAME', subjectName: 'Álgebra', semester: 1, changedFields: [] }],
      },
    }

    // Act
    const parsed = await parseCurriculumImportPreview(response)

    // Assert
    expect(parsed.comparison).toMatchObject({
      addedSamples: [{ subjectName: 'Biología', semester: 2 }],
      removedSamples: [{ subjectName: 'Química', semester: 3 }],
      modifiedSamples: [{ subjectName: 'Física moderna', semester: 4 }],
      unchangedSamples: [{ subjectName: 'Álgebra', semester: 1 }],
    })
  })

  it('rejects blank, oversized, out-of-range, or incomplete descriptive metadata', async () => {
    // Arrange
    const invalidSamples = [
      { subjectCode: 'SUB-NEW', subjectName: ' ', semester: 1, changedFields: [] },
      { subjectCode: 'SUB-NEW', subjectName: 'N'.repeat(241), semester: 1, changedFields: [] },
      { subjectCode: 'SUB-NEW', subjectName: 'Biología', semester: 0, changedFields: [] },
      { subjectCode: 'SUB-NEW', subjectName: 'Biología', semester: 32768, changedFields: [] },
      { subjectCode: 'SUB-NEW', subjectName: 'Biología', changedFields: [] },
    ]
    const responses = invalidSamples.map((sample) => ({
      ...preview,
      comparison: {
        ...compared,
        counts: { added: 1, removed: 0, modified: 0, unchanged: 0 },
        addedSamples: [sample],
        removedSamples: [],
        modifiedSamples: [],
        unchangedSamples: [],
      },
    }))

    // Act + Assert
    for (const response of responses) {
      await expect(parseCurriculumImportPreview(response)).rejects.toThrow()
    }
  })

  it('rejects inconsistent counts and samples larger than the ten-item limit', async () => {
    // Arrange
    const invalidCounts = { ...preview, comparison: { ...compared, counts: { added: 2, removed: 0, modified: 0, unchanged: 0 } } }
    const tooManySamples = {
      ...preview,
      comparison: {
        ...compared,
        counts: { added: 11, removed: 0, modified: 0, unchanged: 0 },
        addedSamples: Array.from({ length: 11 }, (_, index) => ({
          subjectCode: `SUB-${index}`,
          changedFields: [],
        })),
        removedSamples: [],
        unchangedSamples: [],
      },
    }

    // Act + Assert
    await expect(parseCurriculumImportPreview(invalidCounts)).rejects.toThrow()
    await expect(parseCurriculumImportPreview(tooManySamples)).rejects.toThrow()
  })

  it('enforces the removed reference curriculum entry limit', async () => {
    // Arrange
    const atLimit = {
      ...preview,
      comparison: {
        ...compared,
        counts: { ...compared.counts, removed: 10_000 },
      },
    }
    const aboveLimit = {
      ...atLimit,
      comparison: {
        ...atLimit.comparison,
        counts: { ...atLimit.comparison.counts, removed: 10_001 },
      },
    }

    // Act & Assert
    await expect(parseCurriculumImportPreview(atLimit)).resolves.toMatchObject({
      comparison: { counts: { removed: 10_000 } },
    })
    await expect(parseCurriculumImportPreview(aboveLimit)).rejects.toThrow()
  })

  it('rejects an added or removed sample that carries changed fields', async () => {
    // Arrange: added/removed rows are field-less by contract; only modified rows carry a diff.
    const addedWithFields = {
      ...preview,
      comparison: {
        ...compared,
        counts: { added: 1, removed: 0, modified: 0, unchanged: 0 },
        addedSamples: [{ subjectCode: 'SUB-NEW', changedFields: ['CREDITS'] }],
        removedSamples: [],
        modifiedSamples: [],
        unchangedSamples: [],
      },
    }

    // Act + Assert
    await expect(parseCurriculumImportPreview(addedWithFields)).rejects.toThrow()
  })

  it('accepts an older backend response that omits comparison', async () => {
    // Arrange
    const response = { ...preview }

    // Act
    const parsed = await parseCurriculumImportPreview(response)

    // Assert
    expect(parsed).not.toHaveProperty('comparison')
  })
})
