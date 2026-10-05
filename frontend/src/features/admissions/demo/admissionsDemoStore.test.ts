import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ADMISSIONS_DEMO_PROGRAM_OPTIONS,
  createAdmissionsDemoStore,
} from './admissionsDemoStore'

const validApplication = {
  firstChoiceId: ADMISSIONS_DEMO_PROGRAM_OPTIONS[0].id,
  secondChoiceId: ADMISSIONS_DEMO_PROGRAM_OPTIONS[1].id,
  hasReviewedDemoNotice: true,
  confirmedSyntheticOptions: true,
}

describe('admissions demo store', () => {
  afterEach(() => vi.restoreAllMocks())

  it('starts with synthetic cases that contain no personal fields', () => {
    // Arrange
    const store = createAdmissionsDemoStore()

    // Act
    const { applications } = store.getState()

    // Assert
    expect(applications).toHaveLength(2)
    expect(applications.every((application) => application.reference.startsWith('DEMO-'))).toBe(true)
    expect(applications.every((application) => application.firstChoiceId !== application.secondChoiceId)).toBe(true)
    expect(applications.find((application) => application.reference === 'DEMO-0002'))
      .toMatchObject({ status: 'DEMO_CORRECTION_REQUESTED', correctionReason: 'DEMO_CONFIRM_CHOICES' })
    expect(applications.every((application) => !('name' in application) && !('documentNumber' in application))).toBe(true)
  })

  it('adds a synthetic application to the shared inbox without sending or persisting it', () => {
    // Arrange
    const store = createAdmissionsDemoStore()

    // Act
    const created = store.getState().addApplication(validApplication)

    // Assert
    expect(created.reference).toBe('DEMO-0003')
    expect(created.status).toBe('DEMO_RECEIVED')
    expect(store.getState().applications[0]).toEqual(created)
  })

  it('does not write the synthetic cases to either browser storage area', () => {
    // Arrange
    const localSetItem = vi.spyOn(window.localStorage, 'setItem')
    const sessionSetItem = vi.spyOn(window.sessionStorage, 'setItem')
    const store = createAdmissionsDemoStore()

    // Act
    store.getState().addApplication(validApplication)

    // Assert
    expect(localSetItem).not.toHaveBeenCalled()
    expect(sessionSetItem).not.toHaveBeenCalled()
  })

  it('rejects an invalid application without changing the inbox', () => {
    // Arrange
    const store = createAdmissionsDemoStore()
    const before = store.getState().applications

    // Act + Assert
    expect(() => store.getState().addApplication({ ...validApplication, secondChoiceId: validApplication.firstChoiceId }))
      .toThrow(/opciones diferentes/i)
    expect(store.getState().applications).toEqual(before)
  })

  it('moves a case through review, correction request, applicant response, and final review', () => {
    // Arrange
    const store = createAdmissionsDemoStore()
    const reference = store.getState().applications[0].reference

    // Act
    store.getState().startReview(reference)
    store.getState().requestCorrection(reference, 'DEMO_COMPLETE_CHECKLIST')
    store.getState().acknowledgeCorrection(reference)
    store.getState().resumeReview(reference)
    store.getState().completeReview(reference)

    // Assert
    expect(store.getState().applications.find((item) => item.reference === reference)?.status)
      .toBe('DEMO_REVIEW_COMPLETE')
    expect(() => store.getState().completeReview(reference)).toThrow(/transición demo no permitida/i)
  })

  it('requires a review in progress and a known reason before requesting a correction', () => {
    // Arrange
    const store = createAdmissionsDemoStore()
    const before = store.getState().applications

    // Act + Assert
    expect(() => store.getState().requestCorrection('DEMO-0001', 'DEMO_CONFIRM_CHOICES'))
      .toThrow(/transición demo no permitida/i)
    expect(() => store.getState().requestCorrection('DEMO-0002', 'UNKNOWN_REASON' as never))
      .toThrow(/motivo de demostración/i)
    expect(store.getState().applications).toEqual(before)
  })

  it('resets all edits and generated cases to the synthetic baseline', () => {
    // Arrange
    const store = createAdmissionsDemoStore()
    store.getState().addApplication(validApplication)
    store.getState().startReview('DEMO-0001')
    store.getState().requestCorrection('DEMO-0001', 'DEMO_COMPLETE_CHECKLIST')

    // Act
    store.getState().resetDemo()
    const { applications } = store.getState()

    // Assert
    expect(applications).toHaveLength(2)
    expect(applications[0].reference).toBe('DEMO-0001')
    expect(applications[0].status).toBe('DEMO_RECEIVED')
    expect(applications[1].status).toBe('DEMO_CORRECTION_REQUESTED')
  })
})
