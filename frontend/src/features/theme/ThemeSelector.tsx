import './ThemeSelector.scss'
import { useThemeStore } from './themeStore'
import type { ThemePreference } from './themeStore'

const choices: Array<{ value: ThemePreference; label: string }> = [
  { value: 'system', label: 'Automático' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
]

export function ThemeSelector() {
  const preference = useThemeStore((state) => state.preference)
  const setPreference = useThemeStore((state) => state.setPreference)

  return (
    <fieldset className="theme-selector" aria-label="Tema visual">
      {choices.map(({ value, label }) => (
        <label className="theme-selector-choice" key={value} title={label}>
          <input
            type="radio"
            name="theme-preference"
            value={value}
            checked={preference === value}
            onChange={() => setPreference(value)}
          />
          <span className="theme-selector-icon" aria-hidden="true">
            {value === 'system' ? <SystemIcon /> : value === 'light' ? <SunIcon /> : <MoonIcon />}
          </span>
          <span className="theme-selector-label">{label}</span>
        </label>
      ))}
    </fieldset>
  )
}

function SystemIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <rect x="3.5" y="4" width="17" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M20.1 15.2A8.6 8.6 0 0 1 8.8 3.9 8.7 8.7 0 1 0 20.1 15.2Z" />
    </svg>
  )
}
