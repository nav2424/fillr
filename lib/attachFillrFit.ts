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

function normalizeProfileList(values: readonly string[] | undefined): string[] {
  return [...new Set((values ?? []).map((v) => String(v || '').toLowerCase().trim()).filter(Boolean))].sort()
}

export function getFillrScoringProfileHash(profile: DietaryProfile): string {
  return JSON.stringify({
    allergies: normalizeProfileList(profile.allergies),
    sensitivities: normalizeProfileList(profile.sensitivities),
    avoiding: normalizeProfileList(profile.avoiding),
    preferences: normalizeProfileList(
      profile.scoringPreferenceKeys?.length ? profile.scoringPreferenceKeys : profile.preferences
    ),
    goal: String(profile.goal ?? '').toLowerCase().trim(),
    celiacStrictGluten: Boolean(profile.celiacStrictGluten),
  })
}

function computeLiveFillrScoring(
  result: ScanResult,
  profile: DietaryProfile
): { fillrFit: FillrFitComputed; scoringData: FillrScoringInput } {
  const scoringData = buildScoringData(result, result.ingredientBreakdown, profile)
  return { scoringData, fillrFit: calculateFillrFit(scoringData) }
}

/** Lock Fillr Fit at first display (barcode fast path, OCR/manual base scan). */
export function freezeScanScoring(result: ScanResult, profile: DietaryProfile): ScanResult {
  const withFit = result.fillrFit ? result : attachFillrFitToScanResult(result, profile)
  if (withFit.scoringFrozenAt) return withFit
  return {
    ...withFit,
    scoringFrozenAt: new Date().toISOString(),
    scoringProfileHash: withFit.scoringProfileHash ?? getFillrScoringProfileHash(profile),
  }
}

/** Keep the first Fillr Fit when ingredient copy or ratings update after decode. */
export function preserveFrozenScoring(base: ScanResult, next: ScanResult): ScanResult {
  if (!base.fillrFit) return next
  return {
    ...next,
    fillrFit: base.fillrFit,
    scoringData: base.scoringData,
    processedRating: base.processedRating,
    scoringFrozenAt: base.scoringFrozenAt ?? new Date().toISOString(),
    scoringProfileHash: base.scoringProfileHash,
  }
}

/**
 * Presentation pass after OpenAI merge — ingredient sort/hydration only; score stays from `base`.
 */
export function finalizeEnrichedScanPreservingScore(
  base: ScanResult,
  merged: ScanResult,
  profile: DietaryProfile
): ScanResult {
  const presented = applyPresentationDefaults(merged)
  if (base.fillrFit || base.scoringFrozenAt) {
    return preserveFrozenScoring(base, presented)
  }
  return attachFillrFitToScanResult(presented, profile)
}

/** Attach `fillrFit` + `processedRating` + `scoringData` using current breakdown (no re-presentation). */
export function attachFillrFitToScanResult(
  result: ScanResult,
  profile: DietaryProfile
): ScanResult {
  const { fillrFit, scoringData } = computeLiveFillrScoring(result, profile)
  const processedRating = calculateProcessedRating(scoringData)
  return attachScoringCopy(
    {
      ...result,
      fillrFit,
      processedRating,
      scoringData,
      scoringProfileHash: getFillrScoringProfileHash(profile),
    },
    scoringData,
    fillrFit
  )
}

/** Deterministic ratings sort + Fillr Fit for a fresh scan. */
export function finalizeScanForPresentation(
  result: ScanResult,
  profile: DietaryProfile
): ScanResult {
  return attachFillrFitToScanResult(applyPresentationDefaults(result), profile)
}
