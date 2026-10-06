/** Normalize accents, casing, and whitespace consistently for public text searches. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es-CO')
    .replace(/\s+/g, ' ')
    .trim()
}
