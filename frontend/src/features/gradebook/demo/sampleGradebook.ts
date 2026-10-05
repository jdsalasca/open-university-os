export interface SampleGradeStudent {
  reference: string
}

export interface SampleGradeGroup {
  id: string
  code: string
  subject: string
  activity: string
  students: readonly SampleGradeStudent[]
}

export const SAMPLE_GRADE_GROUPS: readonly SampleGradeGroup[] = [
  {
    id: 'demo-group-01',
    code: 'DEMO-GRUPO-01',
    subject: 'Diseño de interacción de muestra',
    activity: 'Actividad de ejemplo 1',
    students: [
      { reference: 'DEMO-ALU-001' },
      { reference: 'DEMO-ALU-002' },
      { reference: 'DEMO-ALU-003' },
    ],
  },
  {
    id: 'demo-group-02',
    code: 'DEMO-GRUPO-02',
    subject: 'Laboratorio académico de muestra',
    activity: 'Actividad de ejemplo 2',
    students: [
      { reference: 'DEMO-ALU-004' },
      { reference: 'DEMO-ALU-005' },
    ],
  },
]
