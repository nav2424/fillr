/**
 * Goals that describe overall diet direction belong on the product score / summary,
 * not as per-ingredient "conflicts" (e.g. salt does not conflict with "eat more protein").
 *
 * Scope is defined on each entry in `GOAL_SIGNALS` (`profileSignals.ts`).
 */

import { migrateGoalKey } from './goalKeyMigration'
import { getGoalDisplayLabel } from './profileDisplayLabels'
import { GOAL_SIGNALS } from './profileSignals'

export function normalizeGoalKey(raw: string): string {
  const k0 = String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_')
  const k = migrateGoalKey(k0)
  if (GOAL_SIGNALS[k]) return k
  if (GOAL_SIGNALS[k0]) return k0
  return k
}

export function getGoalSignalScope(goal: string | undefined | null): 'product' | 'ingredient' | null {
  if (!goal?.trim()) return null
  const signal = GOAL_SIGNALS[normalizeGoalKey(goal)]
  return signal?.scope ?? null
}

/** Macro / directional goals — evaluate at product level only. */
export function isProductLevelGoal(goal: string | undefined | null): boolean {
  return getGoalSignalScope(goal) === 'product'
}

/** Goals where specific label lines may conflict (sugar, sodium, additives, etc.). */
export function isIngredientLevelGoal(goal: string | undefined | null): boolean {
  return getGoalSignalScope(goal) === 'ingredient'
}

/** Product-level goals should not populate per-ingredient conflict lists in scoring. */
export function shouldAttachGoalConflictsToIngredients(goal: string | undefined | null): boolean {
  return isIngredientLevelGoal(goal)
}

/** Labels for ingredient-card focus detection (excludes product-scoped goals). */
export function ingredientLevelGoalFocusLabels(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, signal] of Object.entries(GOAL_SIGNALS)) {
    if (signal.scope !== 'ingredient') continue
    out[key] = signal.label
  }
  return out
}

/** True when copy looks like a generic product-goal stamp on an unrelated ingredient line. */
export function isProductLevelGoalImpactBlurb(
  text: string | undefined | null,
  goal: string | undefined | null
): boolean {
  if (!isProductLevelGoal(goal)) return false
  const t = String(text ?? '').trim()
  if (!t || !/\b(your|you)\b/i.test(t)) return false

  const label = (getGoalDisplayLabel(goal) ?? '').toLowerCase()
  const keyPhrase = normalizeGoalKey(goal).replace(/_/g, ' ')
  const mentionsGoal =
    /\b(goal|current goal)\b/i.test(t) ||
    (label.length > 0 && t.toLowerCase().includes(label)) ||
    (keyPhrase.length > 0 && t.toLowerCase().includes(keyPhrase))

  return mentionsGoal && /\b(works against|does not align|conflicts with|against your)\b/i.test(t)
}

type GoalStrippableIngredient = {
  flagDriver?: string
  profileAnchor?: string
  personalFlag?: string
  impactForYou?: string
  whyItMattersYou?: string
  personalMessage?: string
}

/** Remove per-ingredient goal flags/copy when the user's goal is product-scoped. */
export function stripProductLevelGoalFromIngredient<T extends GoalStrippableIngredient>(
  ing: T,
  goal: string | undefined | null
): T {
  if (!isProductLevelGoal(goal)) return ing
  const next = { ...ing }
  if (next.flagDriver === 'goal') delete next.flagDriver
  const anchor = normalizeGoalKey(String(next.profileAnchor ?? ''))
  if (anchor && isProductLevelGoal(anchor)) delete next.profileAnchor
  if (isProductLevelGoalImpactBlurb(next.impactForYou, goal)) delete next.impactForYou
  if (isProductLevelGoalImpactBlurb(next.whyItMattersYou, goal)) delete next.whyItMattersYou
  if (isProductLevelGoalImpactBlurb(next.personalMessage, goal)) delete next.personalMessage
  return next
}
