import type { RoomPlanningScenario } from './roomAllocationContracts'

export interface RoomPlanningSampleScenario {
  id: string
  label: string
  description: string
  scenario: RoomPlanningScenario
}

export const roomPlanningSampleScenarios: RoomPlanningSampleScenario[] = [
  {
    id: 'balanced',
    label: 'Distribución equilibrada',
    description: 'Dos grupos con necesidades distintas y aulas compatibles.',
    scenario: {
      groups: [
        {
          code: 'DEMO-GRP-01',
          expectedEnrollment: 28,
          requiredFeatures: ['PROJECTOR', 'WHITEBOARD'],
          meetings: [
            { day: 'MONDAY', startsAt: '08:00', endsAt: '10:00' },
            { day: 'WEDNESDAY', startsAt: '08:00', endsAt: '10:00' },
          ],
        },
        {
          code: 'DEMO-GRP-02',
          expectedEnrollment: 20,
          requiredFeatures: ['COMPUTER_STATIONS'],
          meetings: [
            { day: 'MONDAY', startsAt: '08:00', endsAt: '10:00' },
            { day: 'THURSDAY', startsAt: '10:00', endsAt: '12:00' },
          ],
        },
      ],
      rooms: [
        { code: 'DEMO-AULA-01', capacity: 30, active: true, features: ['PROJECTOR', 'WHITEBOARD'] },
        { code: 'DEMO-AULA-02', capacity: 24, active: true, features: ['COMPUTER_STATIONS', 'PROJECTOR'] },
        { code: 'DEMO-AULA-03', capacity: 40, active: true, features: ['PROJECTOR', 'WHITEBOARD'] },
      ],
    },
  },
  {
    id: 'limited',
    label: 'Aulas limitadas · conflicto de horario',
    description: 'Tres grupos coinciden; hay dos aulas aptas para el horario.',
    scenario: {
      groups: [
        {
          code: 'DEMO-GRP-11',
          expectedEnrollment: 30,
          requiredFeatures: ['PROJECTOR'],
          meetings: [{ day: 'TUESDAY', startsAt: '08:00', endsAt: '09:30' }],
        },
        {
          code: 'DEMO-GRP-12',
          expectedEnrollment: 22,
          requiredFeatures: ['PROJECTOR'],
          meetings: [{ day: 'TUESDAY', startsAt: '08:30', endsAt: '10:00' }],
        },
        {
          code: 'DEMO-GRP-13',
          expectedEnrollment: 26,
          requiredFeatures: ['PROJECTOR'],
          meetings: [{ day: 'TUESDAY', startsAt: '08:00', endsAt: '09:00' }],
        },
      ],
      rooms: [
        { code: 'DEMO-AULA-11', capacity: 32, active: true, features: ['PROJECTOR', 'WHITEBOARD'] },
        { code: 'DEMO-AULA-12', capacity: 24, active: true, features: ['PROJECTOR'] },
      ],
    },
  },
]
