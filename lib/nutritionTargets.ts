export type NutritionTrackingStyle = 'general' | 'weight_loss' | 'muscle' | 'blood_sugar'

export type NutritionTargets = {
  maxSugarG?: number
  minProteinG?: number
  maxSodiumMg?: number
  trackingStyle?: NutritionTrackingStyle
}

export const NUTRITION_GOAL_KEYS = new Set([
  'less_sugar',
  'low_sugar',
  'more_protein',
  'high_protein',
  'build_muscle',
  'lower_sodium',
  'lose_weight',
  'low_calorie',
])

export function isNutritionFocusedGoal(goalKey: string | null | undefined): boolean {
  if (!goalKey?.trim()) return false
  return NUTRITION_GOAL_KEYS.has(goalKey.trim())
}

export function defaultTargetsForGoal(goalKey: string | null | undefined): NutritionTargets {
  const g = goalKey?.trim() ?? ''
  if (/less_sugar|low_sugar|blood/i.test(g)) {
    return { maxSugarG: 8, trackingStyle: 'blood_sugar' }
  }
  if (/more_protein|high_protein|build_muscle|muscle/i.test(g)) {
    return { minProteinG: 10, trackingStyle: 'muscle' }
  }
  if (/lower_sodium/i.test(g)) {
    return { maxSodiumMg: 400, trackingStyle: 'general' }
  }
  if (/lose_weight|low_calorie/i.test(g)) {
    return { maxSugarG: 10, maxSodiumMg: 500, trackingStyle: 'weight_loss' }
  }
  return { trackingStyle: 'general' }
}

export function mergedNutritionTargets(
  goalKey: string | null | undefined,
  stored?: NutritionTargets | null
): NutritionTargets {
  const defaults = defaultTargetsForGoal(goalKey)
  return {
    trackingStyle: stored?.trackingStyle ?? defaults.trackingStyle,
    maxSugarG: stored?.maxSugarG ?? defaults.maxSugarG,
    minProteinG: stored?.minProteinG ?? defaults.minProteinG,
    maxSodiumMg: stored?.maxSodiumMg ?? defaults.maxSodiumMg,
  }
}
