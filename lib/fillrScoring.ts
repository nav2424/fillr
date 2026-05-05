/**
 * Deterministic Fillr Fit scoring — no AI, no network.
 */

export type FillrIngredientCounts = {
  natural: number
  processed: number
  additive: number
  flagged: number
}

import type { GoalConflictDetail } from '../types'
import { getGoalDisplayLabel } from './profileDisplayLabels'

export type ProductCategory =
  | 'whole_food'
  | 'clean_snack'
  | 'protein_bar'
  | 'gum'
  | 'candy'
  | 'dairy'
  | 'drink'
  | 'condiment'
  | 'generic_packaged'

export type FillrScoringInput = {
  allergyMatches?: string[]
  celiacSeverity?: 'SAFE' | 'CAUTION' | 'AVOID'
  /** Strict celiac mode — used with `celiacAmbiguousCount` for unscored gluten-source-unknown lines. */
  celiacStrictGluten?: boolean
  /** Ingredients flagged `personalFlag: 'celiac'` but not rated `avoid` (e.g. unspecified maltodextrin). */
  celiacAmbiguousCount?: number
  sensitivityMatches?: string[]
  avoidingMatches?: string[]
  goalMatches?: string[]
  goalConflicts?: string[]
  /** UI only — which lines matched each conflict (see `buildProfileMatches`). */
  goalConflictDetails?: GoalConflictDetail[]
  ingredientCounts?: FillrIngredientCounts
  totalIngredients?: number
  eNumberCount?: number
  genericFunctionalTermCount?: number
  industrialSweetenerCount?: number
  hydrogenatedOilCount?: number
  /** Keys from profile `scoringPreferenceKeys` — deterministic score nudges in `calculateFillrFit`. */
  scoringPreferenceKeys?: string[]
  /** Non-nutritive / artificial sweetener lines (name heuristic). */
  sweetenerCount?: number
  /** Weighted sugar / refined carb signal for `low_sugar` preference. */
  sugarScore?: number
  hasSeedOils?: boolean
  emulsifierCount?: number
  /** Estimated caffeine (mg) from nutrition or label fallback. */
  caffeineMg?: number
  proInflammatoryCount?: number
  /** Full ingredient label text (for formulation-only copy in processing score). */
  labelHaystack?: string
  /** Product-category context so inherently processed categories are scored against their lane. */
  productCategory?: ProductCategory
}

export type CategoryBaseline = {
  label: string
  floor: number
  ceiling: number
  base: number
}

export const CATEGORY_BASELINES: Record<ProductCategory, CategoryBaseline> = {
  whole_food: { label: 'whole food', floor: 70, ceiling: 100, base: 86 },
  clean_snack: { label: 'clean snack', floor: 45, ceiling: 85, base: 66 },
  protein_bar: { label: 'protein bar', floor: 35, ceiling: 82, base: 58 },
  gum: { label: 'chewing gum', floor: 20, ceiling: 65, base: 50 },
  candy: { label: 'candy', floor: 5, ceiling: 50, base: 25 },
  dairy: { label: 'dairy product', floor: 35, ceiling: 90, base: 62 },
  drink: { label: 'drink', floor: 10, ceiling: 70, base: 42 },
  condiment: { label: 'condiment', floor: 25, ceiling: 75, base: 50 },
  generic_packaged: { label: 'packaged food', floor: 20, ceiling: 90, base: 55 },
}

export type FillrFitComputed = {
  score: number
  verdict: string
  verdictColor: string
  progressColor: string
  reason: string
  tier: 1 | 2 | 3
}

function formatList(arr: string[]): string {
  if (arr.length === 0) return ''
  if (arr.length === 1) return arr[0]
  if (arr.length === 2) return `${arr[0]} and ${arr[1]}`
  return `${arr[0]}, ${arr[1]} and ${arr.length - 2} more`
}

/** Human-readable goal / preference label for scoring copy — never raw keys like `more_protein`. */
export function formatGoalName(slug: string): string {
  return getGoalDisplayLabel(slug)
}

function hasLactoseSignal(sensitivityMatches: string[]): boolean {
  return sensitivityMatches.some((s) => /lactose|milk|dairy|whey|casein/i.test(String(s)))
}

function clampScore(n: number): number {
  return Math.round(Math.max(0, Math.min(100, n)))
}

function categoryOf(data: FillrScoringInput): ProductCategory {
  return data.productCategory ?? 'generic_packaged'
}

function clampToCategoryBand(score: number, data: FillrScoringInput): number {
  const band = CATEGORY_BASELINES[categoryOf(data)]
  return Math.round(Math.max(band.floor, Math.min(band.ceiling, score)))
}

function calculateIngredientScore(data: FillrScoringInput): number {
  const counts = data.ingredientCounts ?? { natural: 0, processed: 0, additive: 0, flagged: 0 }
  const total = data.totalIngredients || 1
  const band = CATEGORY_BASELINES[categoryOf(data)]
  const quality =
    (counts.natural * 1 + counts.processed * 0.62 + counts.additive * 0.25 + counts.flagged * 0) / total
  const signalPenalty =
    (data.eNumberCount ?? 0) * 2 +
    (data.genericFunctionalTermCount ?? 0) * 1.5 +
    (data.industrialSweetenerCount ?? 0) * 4 +
    (data.hydrogenatedOilCount ?? 0) * 6
  const bandWidth = band.ceiling - band.floor
  let score = (quality - 0.5) * bandWidth - signalPenalty

  const hay = (data.labelHaystack ?? '').toLowerCase()
  if (data.productCategory === 'gum') {
    if (/\bxylitol\b/.test(hay)) score += 20
    if (/\b(aspartame|sucralose|acesulfame(?:\s+potassium)?|acesulfame k|saccharin|cyclamate)\b/i.test(hay)) {
      score -= 14
    }
  }
  if (data.productCategory === 'protein_bar' && /whey|casein|pea protein|soy protein|protein/i.test(hay)) {
    score += 8
  }
  return score
}

function calculateUserAdjustments(data: FillrScoringInput): number {
  let score = 0
  const prefs = new Set((data.scoringPreferenceKeys ?? []).map((k) => String(k).toLowerCase()))
  const sensitivityText = (data.sensitivityMatches ?? []).join(' ').toLowerCase()

  const sugarSensitive =
    prefs.has('low_sugar') ||
    prefs.has('diabetic_friendly') ||
    /fructose|sugar|diabetic|glucose/i.test(sensitivityText)
  if (sugarSensitive) score -= Math.min(18, Math.max(0, (data.sugarScore ?? 0) - 4))

  if (prefs.has('high_protein')) {
    score += (data.goalMatches ?? []).some((m) => /protein/i.test(m)) ? 10 : -8
  }

  const additiveSensitive =
    prefs.has('whole_foods') ||
    prefs.has('less_processed') ||
    prefs.has('eat_cleaner') ||
    prefs.has('reduce_upf') ||
    prefs.has('gut_health') ||
    /artificial sweeteners|msg|fodmap|histamine/i.test(sensitivityText)
  if (additiveSensitive) {
    score -= Math.min(
      20,
      (data.ingredientCounts?.additive ?? 0) * 3 +
        (data.emulsifierCount ?? 0) * 4 +
        (data.proInflammatoryCount ?? 0) * 3
    )
  }

  if (prefs.has('no_artificial_sweeteners') && (data.sweetenerCount ?? 0) > 0) score -= 16
  if (prefs.has('no_seed_oils') && data.hasSeedOils) score -= 12
  if (prefs.has('low_caffeine') && (data.caffeineMg ?? 0) > 80) score -= 12
  return score
}

function calculateGoalAdjustments(data: FillrScoringInput): number {
  let score = 0
  const goalText = [...(data.goalMatches ?? []), ...(data.goalConflicts ?? [])].join(' ').toLowerCase()

  score += Math.min(18, (data.goalMatches ?? []).length * 8)
  score -= Math.min(28, (data.goalConflicts ?? []).length * 10)

  if (/lose weight|fat loss|low calorie|less sugar|eat less sugar/i.test(goalText)) {
    score -= Math.min(18, Math.max(0, (data.sugarScore ?? 0) - 5))
    if ((data.ingredientCounts?.natural ?? 0) === 0 && (data.ingredientCounts?.additive ?? 0) > 2) score -= 6
  }
  if (/protein|muscle/i.test(goalText)) {
    score += (data.goalMatches ?? []).some((m) => /protein/i.test(m)) ? 12 : -8
  }
  if (/cleaner|processed|ultra-processed|whole/i.test(goalText)) {
    score -= Math.min(18, (data.ingredientCounts?.additive ?? 0) * 3 + (data.ingredientCounts?.flagged ?? 0) * 6)
  }
  if (/convenience/i.test(goalText)) {
    score += Math.min(10, (data.ingredientCounts?.processed ?? 0) * 2)
  }
  return score
}

function applyRiskCaps(score: number, data: FillrScoringInput): { score: number; tier2: boolean; reason?: string } {
  let next = score
  let tier2 = false
  let reason: string | undefined

  if (data.celiacStrictGluten && (data.celiacAmbiguousCount ?? 0) > 0) {
    next = Math.min(next, 50)
    tier2 = true
    reason = `${data.celiacAmbiguousCount} ingredient(s) with unverified gluten source`
  }
  if ((data.sensitivityMatches ?? []).length > 0) {
    next = Math.min(next, 50)
    tier2 = true
    reason ??= hasLactoseSignal(data.sensitivityMatches ?? [])
      ? `Contains ${data.sensitivityMatches?.[0]} — lactose sensitivity`
      : `Contains ${data.sensitivityMatches?.[0]} — flagged as your sensitivity`
  }
  if ((data.goalConflicts ?? []).includes('keto')) next = Math.min(next, 25)
  if ((data.goalConflicts ?? []).includes('paleo') && (data.goalConflicts ?? []).includes('paleo-heavy')) {
    next = Math.min(next, 35)
  }
  if ((data.hydrogenatedOilCount ?? 0) > 0 || (data.ingredientCounts?.flagged ?? 0) > 0) {
    next = Math.min(next, 35)
  }
  return { score: clampScore(next), tier2, reason }
}

function categoryQualityPhrase(data: FillrScoringInput, score: number): string {
  const band = CATEGORY_BASELINES[categoryOf(data)]
  const span = Math.max(1, band.ceiling - band.floor)
  const relative = (score - band.floor) / span
  if (relative >= 0.72) return 'better than most options'
  if (relative >= 0.45) return 'middle-of-the-pack'
  return 'weaker than average'
}

export function calculateFillrFit(data: FillrScoringInput): FillrFitComputed {
  const {
    allergyMatches = [],
    celiacSeverity = 'SAFE',
    avoidingMatches = [],
    goalMatches = [],
    goalConflicts = [],
  } = data

  if (allergyMatches.length > 0) {
    return {
      score: 0,
      verdict: 'Unsafe',
      verdictColor: '#dc2626',
      reason: `Contains ${formatList(allergyMatches)} — on your allergy list`,
      tier: 1,
      progressColor: '#dc2626',
    }
  }

  if (celiacSeverity === 'AVOID') {
    return {
      score: 0,
      verdict: 'Unsafe',
      verdictColor: '#dc2626',
      reason: 'Contains a direct gluten source — unsafe for celiac disease',
      tier: 1,
      progressColor: '#dc2626',
    }
  }

  const category = CATEGORY_BASELINES[categoryOf(data)]
  const ingredientScore = calculateIngredientScore(data)
  const userAdjustments = calculateUserAdjustments(data) - avoidingMatches.length * 12
  const goalAdjustments = calculateGoalAdjustments(data)

  let finalScore = clampToCategoryBand(
    category.base + ingredientScore + userAdjustments + goalAdjustments,
    data
  )

  let isTier2 = false
  let tier2Reason = ''
  if (celiacSeverity === 'CAUTION') {
    isTier2 = true
    tier2Reason = 'Possible gluten risk — verify before consuming'
    finalScore = Math.min(finalScore, 50)
  }
  const risk = applyRiskCaps(finalScore, data)
  finalScore = risk.score
  isTier2 = isTier2 || risk.tier2
  tier2Reason = risk.reason ?? tier2Reason

  let verdict: string
  let verdictColor: string
  let progressColor: string

  if (finalScore >= 80) {
    verdict = 'Great fit'
    verdictColor = '#16a34a'
    progressColor = '#22c55e'
  } else if (finalScore >= 60) {
    verdict = 'Good fit'
    verdictColor = '#16a34a'
    progressColor = '#22c55e'
  } else if (finalScore >= 40) {
    verdict = 'Decent fit'
    verdictColor = '#d97706'
    progressColor = '#f59e0b'
  } else if (finalScore >= 20) {
    verdict = 'Poor fit'
    verdictColor = '#ea580c'
    progressColor = '#fb923c'
  } else {
    verdict = 'Not for you'
    verdictColor = '#dc2626'
    progressColor = '#ef4444'
  }

  let reason = ''

  if (isTier2 && tier2Reason) {
    reason = tier2Reason
  } else if (goalConflicts.length > 0 && goalMatches.length > 0) {
    reason = `Mixed fit: some ingredients align, but it also conflicts with your ${formatGoalName(goalConflicts[0])} goal`
  } else if (avoidingMatches.length > 0 && goalConflicts.length > 0) {
    reason = `Contains ingredients you avoid and conflicts with your ${formatGoalName(goalConflicts[0])} goal`
  } else if (avoidingMatches.length > 0) {
    reason = `Contains ${avoidingMatches.length} ingredient${avoidingMatches.length > 1 ? 's' : ''} you prefer to avoid`
  } else if (goalConflicts.length > 0) {
    reason = `Conflicts with your ${formatGoalName(goalConflicts[0])} goal`
  } else if ((data.ingredientCounts?.flagged ?? 0) > 0) {
    reason = `${data.ingredientCounts?.flagged} flagged ingredient${data.ingredientCounts?.flagged === 1 ? '' : 's'} lower the quality score`
  } else if (goalMatches.length > 0 && finalScore >= 70) {
    reason = `Aligns well with your ${formatGoalName(goalMatches[0])} goal`
  } else if (finalScore >= 80) {
    reason = 'Clean ingredient list — matches your profile well'
  } else if (data.productCategory) {
    reason = `For ${category.label}, this is ${categoryQualityPhrase(data, finalScore)}`
  } else {
    reason = 'Scored on overall ingredient quality for your profile'
  }

  return {
    score: finalScore,
    verdict,
    verdictColor,
    progressColor,
    reason,
    tier: isTier2 ? 2 : 3,
  }
}
