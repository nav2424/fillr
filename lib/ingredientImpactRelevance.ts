import type { IngredientExplanation } from '../types'

/**
 * GPT sometimes pastes the same product-level “Allergen conflict: …” line on every ingredient.
 * Only show that copy on rows that are actually an allergen/sensitivity hit for this user.
 */
export function impactForYouMatchesIngredientProfile(
  impact: string | undefined | null,
  ing: IngredientExplanation,
  opts: { allergyMatch: boolean; sensitivityMatch: boolean }
): boolean {
  const t = (impact ?? '').trim()
  if (!t) return false
  if (/allergen conflict|not safe for your .{0,60}allergy|matches your .{0,40}allergy\b/i.test(t)) {
    return opts.allergyMatch || ing.personalFlag === 'allergy'
  }
  if (/sensitivity flag:|sensitivity conflict/i.test(t)) {
    return opts.sensitivityMatch || ing.personalFlag === 'sensitivity'
  }
  return true
}
