import type { SafetyStatus } from '../types'
import { scoreToShortVerdict } from './fillrScoring'

export function resolveProductHeroFitVerdict(params: {
  hasNutritionData?: boolean
  nutritionFit?: number | null
  nutritionLabel?: string | null
  fillrVerdict?: string | null
  fillrTier?: number | null
  heroFitScore?: number | null
  safetyStatus?: SafetyStatus | null
  matchedAllergenCount?: number
  celiacAvoid?: boolean
}): string {
  const fitVerdict = params.fillrVerdict?.trim() ?? ''
  const unsafe =
    params.safetyStatus === 'UNSAFE' ||
    (params.matchedAllergenCount ?? 0) > 0 ||
    params.celiacAvoid === true ||
    (params.heroFitScore != null && params.heroFitScore <= 0 && params.fillrTier === 1)

  if (unsafe) {
    if (fitVerdict) return fitVerdict
    if (params.heroFitScore != null) return scoreToShortVerdict(params.heroFitScore).label
    return 'Unsafe'
  }

  const nutritionLabel = params.nutritionLabel?.trim() ?? ''
  if (params.hasNutritionData && (params.nutritionFit ?? 0) > 0 && nutritionLabel) {
    return nutritionLabel
  }
  if (fitVerdict) return fitVerdict
  if (params.heroFitScore != null) return scoreToShortVerdict(params.heroFitScore).label
  return 'Scored'
}
