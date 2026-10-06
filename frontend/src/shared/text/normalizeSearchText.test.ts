import { describe, expect, it } from 'vitest'
import { normalizeSearchText } from './normalizeSearchText'

describe('normalizeSearchText', () => {
  it('normaliza tildes, mayúsculas y espacios de una consulta', () => {
    // Arrange
    const value = '  INSCRIPCIÓN\t  DE\n MATERIAS  '

    // Act
    const result = normalizeSearchText(value)

    // Assert
    expect(result).toBe('inscripcion de materias')
  })

  it('devuelve texto vacío cuando la entrada solo contiene espacios', () => {
    // Arrange
    const value = ' \t\n '

    // Act
    const result = normalizeSearchText(value)

    // Assert
    expect(result).toBe('')
  })
})
