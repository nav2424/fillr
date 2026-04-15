/**
 * Display formatting for product names — title case (each word capitalized).
 */
export function toTitleCase(name: string): string {
  if (!name?.trim()) return ''
  return name
    .split(/\s+/)
    .map((w) => (w.length ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
}

export const formatProductTitle = toTitleCase
