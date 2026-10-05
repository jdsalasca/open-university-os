import { describe, expect, it } from 'vitest'
import { localDateInputValue } from './localDateInput'

describe('localDateInputValue', () => {
  it('formats a local calendar date for an HTML date input', () => {
    // Arrange
    const localDate = new Date(2026, 8, 30, 12, 0, 0)

    // Act
    const value = localDateInputValue(localDate)

    // Assert
    expect(value).toBe('2026-09-30')
  })
})
