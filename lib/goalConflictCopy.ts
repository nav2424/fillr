import type { GoalConflictDetail } from '../types'

const MAX_NAMES_PER_LABEL = 8

function oxfordList(names: string[]): string {
  const u = [...new Set(names.map((n) => n.trim()).filter(Boolean))]
  if (u.length === 0) return ''
  if (u.length === 1) return u[0]
  if (u.length === 2) return `${u[0]} and ${u[1]}`
  return `${u.slice(0, -1).join(', ')}, and ${u[u.length - 1]}`
}

/**
 * Human-readable copy listing which label lines triggered each goal/preference conflict.
 */
export function formatGoalConflictExplanation(details: GoalConflictDetail[]): string {
  const parts: string[] = []
  for (const { label, ingredients } of details) {
    if (!ingredients.length) continue
    const shown = ingredients.slice(0, MAX_NAMES_PER_LABEL)
    const rest = ingredients.length - shown.length
    let list = oxfordList(shown)
    if (rest > 0) list += ` (+${rest} more)`
    parts.push(`${label}: ${list}`)
  }
  if (parts.length === 0) return ''
  return parts.join('\n\n')
}
