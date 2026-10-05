import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { SAMPLE_GRADE_GROUPS } from './sampleGradebook'
import type { SampleGradeGroup } from './sampleGradebook'
import './GradeEntryDemo.scss'

interface GradeEntryFormValues {
  grades: Array<{ value: string }>
}

export function GradeEntryDemo() {
  const [groupId, setGroupId] = useState(SAMPLE_GRADE_GROUPS[0].id)
  const [savedCount, setSavedCount] = useState<number | null>(null)
  const group = SAMPLE_GRADE_GROUPS.find((candidate) => candidate.id === groupId) ?? SAMPLE_GRADE_GROUPS[0]
  const { formState, handleSubmit, register, reset } = useForm<GradeEntryFormValues>({
    defaultValues: initialValues(group),
  })

  function changeGroup(nextGroupId: string) {
    const nextGroup = SAMPLE_GRADE_GROUPS.find((candidate) => candidate.id === nextGroupId)
    if (!nextGroup) return
    setGroupId(nextGroup.id)
    setSavedCount(null)
    reset(initialValues(nextGroup))
  }

  function saveDraft() {
    return handleSubmit((values) => setSavedCount(values.grades.length))()
  }

  return (
    <div className="grade-entry-demo">
      <header className="grade-entry-hero">
        <div>
          <p className="grade-entry-eyebrow">LABORATORIO LOCAL · SOLO DESARROLLO</p>
          <h1>Registro de calificaciones · demo</h1>
          <p>Prueba la captura por grupo y revisa la validación antes de guardar un borrador de muestra.</p>
        </div>
        <span className="grade-entry-hero-mark" aria-hidden="true">∑</span>
      </header>

      <aside className="grade-entry-notice" role="note" aria-label="Alcance del laboratorio">
        <span className="grade-entry-notice-mark" aria-hidden="true">i</span>
        <div>
          <strong>Datos y reglas ficticios.</strong>
          <p>La escala de prueba 0 a 5 no está validada por UPTC. El borrador solo se guarda en memoria: no usa matrícula, no calcula resultados y no publica notas.</p>
        </div>
      </aside>

      <section className="grade-entry-group-panel" aria-label="Grupo y actividad de ejemplo">
        <label className="grade-entry-group-select">
          <span>Grupo de ejemplo</span>
          <select
            aria-label="Grupo de ejemplo"
            value={group.id}
            onChange={(event) => changeGroup(event.currentTarget.value)}
          >
            {SAMPLE_GRADE_GROUPS.map((option) => (
              <option key={option.id} value={option.id}>{option.code} · {option.subject}</option>
            ))}
          </select>
        </label>
        <div className="grade-entry-group-detail">
          <span>ACTIVIDAD DE PRUEBA</span>
          <strong>{group.activity}</strong>
          <small>{group.students.length} referencias anónimas · grupo sin periodo institucional</small>
        </div>
      </section>

      <form
        aria-label="Captura de calificaciones de ejemplo"
        className="grade-entry-form"
        noValidate
        onSubmit={(event) => { event.preventDefault(); void saveDraft() }}
      >
        <div className="grade-entry-form-heading">
          <div>
            <p className="grade-entry-eyebrow">CAPTURA MANUAL · BORRADOR VOLÁTIL</p>
            <h2>Referencias del grupo</h2>
          </div>
          <span className="grade-entry-count">{group.students.length} registros demo</span>
        </div>

        <ol className="grade-entry-roster">
          {group.students.map((student, index) => {
            const fieldPath = `grades.${index}.value` as const
            const error = formState.errors.grades?.[index]?.value
            const field = register(fieldPath, {
              required: 'Ingresa un valor para esta referencia ficticia.',
              validate: (value) => validateSampleGrade(value),
            })
            const errorId = `grade-entry-error-${student.reference}`

            return (
              <li key={student.reference}>
                <div className="grade-entry-student-ref">
                  <span>REFERENCIA SINTÉTICA</span>
                  <strong>{student.reference}</strong>
                </div>
                <label className="grade-entry-score-field">
                  <span>Calificación de prueba</span>
                  <input
                    {...field}
                    aria-describedby={error ? errorId : undefined}
                    aria-invalid={Boolean(error)}
                    aria-label={`Calificación para ${student.reference}`}
                    inputMode="decimal"
                    max={5}
                    min={0}
                    onChange={(event) => {
                      void field.onChange(event)
                      setSavedCount(null)
                    }}
                    placeholder="0 a 5"
                    step="any"
                    type="number"
                  />
                  {error?.message && <span className="grade-entry-field-error" id={errorId} role="alert">{error.message}</span>}
                </label>
              </li>
            )
          })}
        </ol>

        <div className="grade-entry-submit-row">
          <p>No hay promedio, aprobación automática ni nota definitiva en esta prueba.</p>
          <button className="grade-entry-save" type="submit">Guardar borrador local</button>
        </div>
        {savedCount !== null && (
          <p className="grade-entry-saved" role="status">
            Borrador local guardado para {savedCount} referencias ficticias. No se publica ninguna nota.
          </p>
        )}
        {Object.keys(formState.errors).length > 0 && <p className="grade-entry-submit-error" role="alert">Corrige los valores señalados para guardar este borrador.</p>}
      </form>
    </div>
  )
}

function initialValues(group: SampleGradeGroup): GradeEntryFormValues {
  return { grades: group.students.map(() => ({ value: '' })) }
}

function validateSampleGrade(value: string): true | string {
  if (value.trim() === '') return 'Ingresa un valor para esta referencia ficticia.'
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return 'Ingresa un número válido.'
  if (numericValue < 0 || numericValue > 5) return 'La escala de prueba debe estar entre 0 y 5.'
  return true
}
