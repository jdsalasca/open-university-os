import { createStore } from 'zustand/vanilla'

export const ADMISSIONS_DEMO_PROGRAM_OPTIONS = [
  { id: 'demo-program-a', label: 'Programa ficticio A' },
  { id: 'demo-program-b', label: 'Programa ficticio B' },
  { id: 'demo-program-c', label: 'Programa ficticio C' },
] as const

export type AdmissionsDemoProgramId = typeof ADMISSIONS_DEMO_PROGRAM_OPTIONS[number]['id']
export type AdmissionsDemoReviewStatus =
  | 'DEMO_RECEIVED'
  | 'DEMO_REVIEWING'
  | 'DEMO_CORRECTION_REQUESTED'
  | 'DEMO_CORRECTION_SUBMITTED'
  | 'DEMO_REVIEW_COMPLETE'
export type AdmissionsDemoCorrectionReason = 'DEMO_CONFIRM_CHOICES' | 'DEMO_COMPLETE_CHECKLIST'

export const ADMISSIONS_DEMO_CORRECTION_REASONS: readonly {
  id: AdmissionsDemoCorrectionReason
  label: string
}[] = [
  { id: 'DEMO_CONFIRM_CHOICES', label: 'Confirmar que las opciones de ejemplo son distintas' },
  { id: 'DEMO_COMPLETE_CHECKLIST', label: 'Completar la lista ficticia del ejercicio' },
]

export function getAdmissionsDemoCorrectionReasonLabel(reason: AdmissionsDemoCorrectionReason): string {
  return ADMISSIONS_DEMO_CORRECTION_REASONS.find((item) => item.id === reason)?.label ?? 'Ajuste ficticio solicitado'
}

export interface AdmissionsDemoApplication {
  reference: string
  firstChoiceId: AdmissionsDemoProgramId
  secondChoiceId: AdmissionsDemoProgramId
  hasReviewedDemoNotice: true
  confirmedSyntheticOptions: true
  status: AdmissionsDemoReviewStatus
  correctionReason?: AdmissionsDemoCorrectionReason
}

export interface NewAdmissionsDemoApplication {
  firstChoiceId: AdmissionsDemoProgramId
  secondChoiceId: AdmissionsDemoProgramId
  hasReviewedDemoNotice: boolean
  confirmedSyntheticOptions: boolean
}

export interface AdmissionsDemoState {
  applications: AdmissionsDemoApplication[]
  addApplication(application: NewAdmissionsDemoApplication): AdmissionsDemoApplication
  startReview(reference: string): void
  requestCorrection(reference: string, reason: AdmissionsDemoCorrectionReason): void
  acknowledgeCorrection(reference: string): void
  resumeReview(reference: string): void
  completeReview(reference: string): void
  resetDemo(): void
}

const INITIAL_DEMO_APPLICATIONS: AdmissionsDemoApplication[] = [
  {
    reference: 'DEMO-0001',
    firstChoiceId: 'demo-program-a',
    secondChoiceId: 'demo-program-b',
    hasReviewedDemoNotice: true,
    confirmedSyntheticOptions: true,
    status: 'DEMO_RECEIVED',
  },
  {
    reference: 'DEMO-0002',
    firstChoiceId: 'demo-program-b',
    secondChoiceId: 'demo-program-c',
    hasReviewedDemoNotice: true,
    confirmedSyntheticOptions: true,
    status: 'DEMO_CORRECTION_REQUESTED',
    correctionReason: 'DEMO_CONFIRM_CHOICES',
  },
]

const VALID_PROGRAM_IDS = new Set<string>(ADMISSIONS_DEMO_PROGRAM_OPTIONS.map((option) => option.id))
const VALID_CORRECTION_REASONS = new Set<AdmissionsDemoCorrectionReason>(
  ADMISSIONS_DEMO_CORRECTION_REASONS.map((reason) => reason.id),
)

function cloneInitialApplications(): AdmissionsDemoApplication[] {
  return INITIAL_DEMO_APPLICATIONS.map((application) => ({ ...application }))
}

function validateNewApplication(application: NewAdmissionsDemoApplication) {
  if (!VALID_PROGRAM_IDS.has(application.firstChoiceId) || !VALID_PROGRAM_IDS.has(application.secondChoiceId)) {
    throw new Error('Selecciona opciones ficticias disponibles para la demostración.')
  }
  if (application.firstChoiceId === application.secondChoiceId) {
    throw new Error('Elige opciones diferentes para la demostración.')
  }
  if (!application.hasReviewedDemoNotice || !application.confirmedSyntheticOptions) {
    throw new Error('Confirma el aviso y las opciones ficticias antes de continuar.')
  }
}

export function createAdmissionsDemoStore() {
  let nextReferenceSequence = INITIAL_DEMO_APPLICATIONS.length + 1

  return createStore<AdmissionsDemoState>()((set, get) => ({
    applications: cloneInitialApplications(),
    addApplication: (application) => {
      validateNewApplication(application)
      const created: AdmissionsDemoApplication = {
        reference: `DEMO-${String(nextReferenceSequence).padStart(4, '0')}`,
        firstChoiceId: application.firstChoiceId,
        secondChoiceId: application.secondChoiceId,
        hasReviewedDemoNotice: true,
        confirmedSyntheticOptions: true,
        status: 'DEMO_RECEIVED',
      }
      nextReferenceSequence += 1
      set((state) => ({ applications: [created, ...state.applications] }))
      return created
    },
    startReview: (reference) => {
      transitionApplication(reference, 'DEMO_RECEIVED', 'DEMO_REVIEWING', set, get)
    },
    requestCorrection: (reference, reason) => {
      if (!VALID_CORRECTION_REASONS.has(reason)) {
        throw new Error('Selecciona un motivo de demostración disponible.')
      }
      transitionApplication(reference, 'DEMO_REVIEWING', 'DEMO_CORRECTION_REQUESTED', set, get, {
        correctionReason: reason,
      })
    },
    acknowledgeCorrection: (reference) => {
      transitionApplication(reference, 'DEMO_CORRECTION_REQUESTED', 'DEMO_CORRECTION_SUBMITTED', set, get)
    },
    resumeReview: (reference) => {
      transitionApplication(reference, 'DEMO_CORRECTION_SUBMITTED', 'DEMO_REVIEWING', set, get)
    },
    completeReview: (reference) => {
      transitionApplication(reference, 'DEMO_REVIEWING', 'DEMO_REVIEW_COMPLETE', set, get)
    },
    resetDemo: () => {
      nextReferenceSequence = INITIAL_DEMO_APPLICATIONS.length + 1
      set({ applications: cloneInitialApplications() })
    },
  }))
}

function transitionApplication(
  reference: string,
  expectedStatus: AdmissionsDemoReviewStatus,
  nextStatus: AdmissionsDemoReviewStatus,
  set: (partial: { applications: AdmissionsDemoApplication[] }) => void,
  get: () => AdmissionsDemoState,
  extra: Partial<Pick<AdmissionsDemoApplication, 'correctionReason'>> = {},
) {
  const current = get().applications.find((application) => application.reference === reference)
  if (!current) throw new Error('No existe esa ficha sintética en la bandeja local.')
  if (current.status !== expectedStatus) throw new Error('Transición demo no permitida para el estado actual.')

  set({
    applications: get().applications.map((application) => application.reference === reference
      ? { ...application, ...extra, status: nextStatus }
      : application),
  })
}
