import { isIngredientLevelGoal, isProductLevelGoal, isProductLevelGoalImpactBlurb } from './goalApplicability'
import type { DietaryProfile, IngredientExplanation } from '../types'

/**
 * GPT sometimes pastes the same product-level “Allergen conflict: …” line on every ingredient.
 * Only show that copy on rows that are actually an allergen/sensitivity hit for this user.
 */
export function impactForYouMatchesIngredientProfile(
  impact: string | undefined | null,
  ing: IngredientExplanation,
  opts: {
    allergyMatch: boolean
    sensitivityMatch: boolean
    celiacMatch?: boolean
    profile?: Pick<DietaryProfile, 'goal'>
  }
): boolean {
  const t = (impact ?? '').trim()
  if (!t) return false

  const productGoal = isProductLevelGoal(opts.profile?.goal)
  if (
    productGoal &&
    isProductLevelGoalImpactBlurb(t, opts.profile?.goal) &&
    !ing.personalFlag &&
    ing.flagDriver !== 'preference'
  ) {
    return false
  }

  if (/\bconflicts with your\b/i.test(t) && !isProductLevelGoalImpactBlurb(t, opts.profile?.goal)) {
    return true
  }

  if (/no direct profile conflict|processing signal|mostly as a processing/i.test(t)) return false
  if (/allergen conflict|not safe for your .{0,60}allergy|matches your .{0,40}allergy\b/i.test(t)) {
    return opts.allergyMatch || ing.personalFlag === 'allergy'
  }
  if (/sensitivity flag:|sensitivity conflict/i.test(t)) {
    return opts.sensitivityMatch || ing.personalFlag === 'sensitivity'
  }
  const hasDirectProfileDriver =
    opts.allergyMatch ||
    opts.sensitivityMatch ||
    opts.celiacMatch === true ||
    ing.personalFlag === 'allergy' ||
    ing.personalFlag === 'sensitivity' ||
    ing.personalFlag === 'celiac' ||
    ing.personalFlag === 'avoiding' ||
    ing.personalFlag === 'preference_conflict' ||
    ing.flagDriver === 'allergy' ||
    ing.flagDriver === 'sensitivity' ||
    (ing.flagDriver === 'goal' && isIngredientLevelGoal(opts.profile?.goal)) ||
    ing.flagDriver === 'preference'
  if (!hasDirectProfileDriver) return false
  if (
    /\b(your|you)\b/i.test(t) &&
    /\b(goal|preference|allergy|sensitivity|celiac|profile|avoid)\b/i.test(t)
  ) {
    return true
  }
  return /\b(your|you)\b/i.test(t)
}
