import type { DietaryProfile, ScanResult } from '../types'
import { applyPresentationDefaults } from '../services/openaiIngredientAnalysis'
import { buildScoringData } from './buildScoringData'
import { CATEGORY_BASELINES, calculateFillrFit } from './fillrScoring'
import type { FillrFitComputed } from './fillrScoring'
import type { FillrScoringInput } from './fillrScoring'
import { calculateProcessedRating } from './processedRating'

export type { FillrFitComputed, FillrScoringInput }

function sentence(s: string): string {
  const t = s.trim()
  if (!t) return ''
  return /[.!?]$/.test(t) ? t : `${t}.`
}

function relativeCategoryQuality(scoringData: FillrScoringInput, score: number): string {
  const category = scoringData.productCategory ?? 'generic_packaged'
  const band = CATEGORY_BASELINES[category]
  const relative = (score - band.floor) / Math.max(1, band.ceiling - band.floor)
  if (relative >= 0.72) return 'strong'
  if (relative >= 0.45) return 'middle-ground'
  return 'weak'
}

function userFitCopy(scoringData: FillrScoringInput, fit: FillrFitComputed): string {
  if (fit.tier === 1) return fit.reason
  if ((scoringData.goalConflicts ?? []).length > 0) {
    return `This conflicts with your goal because ${fit.reason.toLowerCase()}`
  }
  if ((scoringData.goalMatches ?? []).length > 0) {
    return `This aligns with your goal because ${fit.reason.toLowerCase()}`
  }
  if ((scoringData.sensitivityMatches ?? []).length > 0 || (scoringData.avoidingMatches ?? []).length > 0) {
    return `For your profile, ${fit.reason.charAt(0).toLowerCase()}${fit.reason.slice(1)}`
  }
  return 'No direct profile conflict drove the score; ingredient quality and category fit did most of the work.'
}

function attachScoringCopy(result: ScanResult, scoringData: FillrScoringInput, fit: FillrFitComputed): ScanResult {
  const category = scoringData.productCategory ?? 'generic_packaged'
  const band = CATEGORY_BASELINES[category]
  const categoryLine = `For ${band.label}, this is ${relativeCategoryQuality(scoringData, fit.score)}`
  const userLine = userFitCopy(scoringData, fit)
  const existing = result.productAnalysis ?? {}
  return {
    ...result,
    productAnalysis: {
      ...existing,
      bottomLine: sentence([existing.bottomLine, categoryLine].filter(Boolean).join(' ')),
      whatTheyDontTellYou: sentence([existing.whatTheyDontTellYou, userLine].filter(Boolean).join(' ')),
    },
  }
}

/** Attach `fillrFit` + `processedRating` + `scoringData` using current breakdown (no re-presentation). */
export function attachFillrFitToScanResult(
  result: ScanResult,
  profile: DietaryProfile
): ScanResult {
  const scoringData = buildScoringData(result, result.ingredientBreakdown, profile)
  const fillrFit = calculateFillrFit(scoringData)
  const processedRating = calculateProcessedRating(scoringData)
  return attachScoringCopy({ ...result, fillrFit, processedRating, scoringData }, scoringData, fillrFit)
}

/** Deterministic ratings sort + Fillr Fit for a fresh scan. */
export function finalizeScanForPresentation(
  result: ScanResult,
  profile: DietaryProfile
): ScanResult {
  return attachFillrFitToScanResult(applyPresentationDefaults(result), profile)
}
