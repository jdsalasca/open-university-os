import type { InputHTMLAttributes } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import './RHFInputField.scss'

interface RHFInputFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'name' | 'size'> {
  id: string
  label: string
  registration?: UseFormRegisterReturn
  error?: string
  hint?: string
}

export function RHFInputField({
  id,
  label,
  registration,
  error,
  hint,
  className,
  ...inputProps
}: RHFInputFieldProps) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter((value): value is string => value !== null)
    .join(' ')
  const inputClassName = ['rhf-input-field-control', className].filter(Boolean).join(' ')

  return (
    <div className="rhf-input-field">
      <label className="rhf-input-field-label" htmlFor={id}>{label}</label>
      <input
        id={id}
        className={inputClassName}
        {...inputProps}
        {...registration}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={describedBy || undefined}
      />
      {hint && <span id={`${id}-hint`} className="rhf-input-field-hint">{hint}</span>}
      {error && <span id={`${id}-error`} className="rhf-input-field-error" role="alert">{error}</span>}
    </div>
  )
}
