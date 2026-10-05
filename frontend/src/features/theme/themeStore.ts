import { create } from 'zustand'

export type ThemeMode = 'light' | 'dark'
export type ThemePreference = 'system' | ThemeMode

export const THEME_STORAGE_KEY = 'universiry-theme-preference'

export interface ThemeEnvironment {
  storage: ThemePreferenceStorage
  readSystemTheme: () => ThemeMode
  applyTheme: (theme: ThemeMode) => void
  subscribeToSystemTheme: (listener: (theme: ThemeMode) => void) => () => void
}

export interface ThemePreferenceStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

interface ThemeState {
  preference: ThemePreference
  resolvedTheme: ThemeMode
  setPreference: (preference: ThemePreference) => void
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark'
}

function resolveTheme(preference: ThemePreference, readSystemTheme: () => ThemeMode): ThemeMode {
  return preference === 'system' ? readSystemTheme() : preference
}

function readPreference(storage: ThemePreferenceStorage): ThemePreference {
  try {
    const savedPreference = storage.getItem(THEME_STORAGE_KEY)
    return isThemePreference(savedPreference) ? savedPreference : 'system'
  } catch {
    return 'system'
  }
}

function browserStorage(): ThemePreferenceStorage {
  return {
    getItem: (key) => {
      try {
        return typeof window === 'undefined' ? null : window.localStorage.getItem(key)
      } catch {
        return null
      }
    },
    setItem: (key, value) => {
      try {
        if (typeof window !== 'undefined') window.localStorage.setItem(key, value)
      } catch {
        // Appearance remains usable when browser storage is blocked or full.
      }
    },
  }
}

function browserThemeEnvironment(): ThemeEnvironment {
  const query = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null

  return {
    storage: browserStorage(),
    readSystemTheme: () => query?.matches ? 'dark' : 'light',
    applyTheme: (theme) => {
      if (typeof document === 'undefined') return
      document.documentElement.dataset.theme = theme
      document.documentElement.style.colorScheme = theme
    },
    subscribeToSystemTheme: (listener) => {
      if (!query) return () => undefined
      const handleChange = (event: MediaQueryListEvent) => listener(event.matches ? 'dark' : 'light')
      query.addEventListener('change', handleChange)
      return () => query.removeEventListener('change', handleChange)
    },
  }
}

export function createThemeStore(environment: ThemeEnvironment = browserThemeEnvironment()) {
  const preference = readPreference(environment.storage)
  const store = create<ThemeState>()((set) => ({
      preference,
      resolvedTheme: resolveTheme(preference, environment.readSystemTheme),
      setPreference: (preference) => {
        try {
          environment.storage.setItem(THEME_STORAGE_KEY, preference)
        } catch {
          // Saving a visual preference must not block changing the theme.
        }
        const resolvedTheme = resolveTheme(preference, environment.readSystemTheme)
        environment.applyTheme(resolvedTheme)
        set({ preference, resolvedTheme })
      },
  }))

  environment.applyTheme(store.getState().resolvedTheme)
  environment.subscribeToSystemTheme((resolvedTheme) => {
    if (store.getState().preference !== 'system') return
    environment.applyTheme(resolvedTheme)
    store.setState({ resolvedTheme })
  })

  return store
}

export const useThemeStore = createThemeStore()
