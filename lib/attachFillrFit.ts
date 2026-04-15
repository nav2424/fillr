import type { DietaryProfile, ScanResult } from '../types'
import { applyPresentationDefaults } from '../services/openaiIngredientAnalysis'
import { buildScoringData } from './buildScoringData'
import { calculateFillrFit } from './fillrScoring'
import type { FillrFitComputed } from './fillrScoring'
import type { FillrScoringInput } from './fillrScoring'

export type { FillrFitComputed, FillrScoringInput }

/** Attach `fillrFit` + `scoringData` using current breakdown (no re-presentation). */
export function attachFillrFitToScanResult(
  result: ScanResult,
  profile: DietaryProfile
): ScanResult {
  const scoringData = buildScoringData(result, result.ingredientBreakdown, profile)
  const fillrFit = calculateFillrFit(scoringData)
  return { ...result, fillrFit, scoringData }
}

/** Deterministic ratings sort + Fillr Fit for a fresh scan. */
export function finalizeScanForPresentation(
  result: ScanResult,
  profile: DietaryProfile
): ScanResult {
  return attachFillrFitToScanResult(applyPresentationDefaults(result), profile)
}
