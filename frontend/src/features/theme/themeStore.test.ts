import { describe, expect, it } from 'vitest'
import { THEME_STORAGE_KEY, createThemeStore } from './themeStore'
import type { ThemeEnvironment, ThemeMode } from './themeStore'

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
    read: (key: string) => values.get(key) ?? null,
  }
}

function themeEnvironment(options: {
  systemTheme?: ThemeMode
  storage?: ReturnType<typeof memoryStorage>
} = {}) {
  let systemTheme = options.systemTheme ?? 'light'
  let onSystemThemeChange: ((theme: ThemeMode) => void) | undefined
  const appliedThemes: ThemeMode[] = []
  const storage = options.storage ?? memoryStorage()
  const environment: ThemeEnvironment = {
    storage,
    readSystemTheme: () => systemTheme,
    applyTheme: (theme) => { appliedThemes.push(theme) },
    subscribeToSystemTheme: (listener) => {
      onSystemThemeChange = listener
      return () => { onSystemThemeChange = undefined }
    },
  }

  return {
    environment,
    appliedThemes,
    storage,
    changeSystemTheme(theme: ThemeMode) {
      systemTheme = theme
      onSystemThemeChange?.(theme)
    },
  }
}

describe('theme preference store', () => {
  it('follows the system theme until the person makes a choice', () => {
    // Arrange
    const setup = themeEnvironment({ systemTheme: 'dark' })

    // Act
    const store = createThemeStore(setup.environment)

    // Assert
    expect(store.getState().preference).toBe('system')
    expect(store.getState().resolvedTheme).toBe('dark')
    expect(setup.appliedThemes.at(-1)).toBe('dark')
    expect(setup.storage.read(THEME_STORAGE_KEY)).toBeNull()
  })

  it('restores a saved preference before the component renders', () => {
    // Arrange
    const storage = memoryStorage({ [THEME_STORAGE_KEY]: 'dark' })
    const setup = themeEnvironment({ systemTheme: 'light', storage })

    // Act
    const store = createThemeStore(setup.environment)

    // Assert
    expect(store.getState().preference).toBe('dark')
    expect(store.getState().resolvedTheme).toBe('dark')
    expect(setup.appliedThemes.at(-1)).toBe('dark')
  })

  it('ignores an invalid saved preference and falls back to the system', () => {
    // Arrange
    const storage = memoryStorage({ [THEME_STORAGE_KEY]: 'ultraviolet' })
    const setup = themeEnvironment({ systemTheme: 'dark', storage })

    // Act
    const store = createThemeStore(setup.environment)

    // Assert
    expect(store.getState().preference).toBe('system')
    expect(store.getState().resolvedTheme).toBe('dark')
    expect(setup.appliedThemes.at(-1)).toBe('dark')
  })

  it('applies the selected preference and persists only that preference', () => {
    // Arrange
    const setup = themeEnvironment({ systemTheme: 'light' })
    const store = createThemeStore(setup.environment)

    // Act
    store.getState().setPreference('dark')

    // Assert
    expect(store.getState().resolvedTheme).toBe('dark')
    expect(setup.appliedThemes.at(-1)).toBe('dark')
    expect(setup.storage.read(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('reacts to system theme changes while automatic mode is selected', () => {
    // Arrange
    const setup = themeEnvironment({ systemTheme: 'light' })
    const store = createThemeStore(setup.environment)

    // Act
    setup.changeSystemTheme('dark')

    // Assert
    expect(store.getState().preference).toBe('system')
    expect(store.getState().resolvedTheme).toBe('dark')
    expect(setup.appliedThemes.at(-1)).toBe('dark')
    expect(setup.storage.read(THEME_STORAGE_KEY)).toBeNull()
  })

  it('keeps an explicit preference when the system theme changes', () => {
    // Arrange
    const setup = themeEnvironment({ systemTheme: 'light' })
    const store = createThemeStore(setup.environment)
    store.getState().setPreference('light')

    // Act
    setup.changeSystemTheme('dark')

    // Assert
    expect(store.getState().preference).toBe('light')
    expect(store.getState().resolvedTheme).toBe('light')
    expect(setup.appliedThemes.at(-1)).toBe('light')
  })

  it('does not fail when browser storage is unavailable', () => {
    // Arrange
    const storageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => { throw new DOMException('Storage is blocked', 'SecurityError') },
    })

    // Act
    try {
      const store = createThemeStore()
      expect(() => store.getState().setPreference('dark')).not.toThrow()

      // Assert
      expect(store.getState().resolvedTheme).toBe('dark')
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    } finally {
      if (storageDescriptor) Object.defineProperty(window, 'localStorage', storageDescriptor)
    }
  })
})
