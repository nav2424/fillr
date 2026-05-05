/**
 * Processing / “whole-food vs industrial” score — independent of allergy safety.
 * Higher = closer to minimally processed; lower = more ultra-processed style.
 * Uses the same ingredient tiers + industrial signals as Fillr scoring (deterministic).
 */

import type { ProcessedRatingSnapshot } from '../types'
import type { FillrScoringInput } from './fillrScoring'

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function labelHasChelator(hay: string): boolean {
  const h = hay.trim()
  if (!h) return false
  return /\b(calcium\s+disodium\s+edta|disodium\s+calcium\s+edta|disodium\s+edta|trisodium\s+edta|ethylenediaminetetraacetic)\b/i.test(
    h
  )
}

function isGumCategory(data: FillrScoringInput): boolean {
  if (data.productCategory === 'gum') return true
  return /\b(chewing\s+gum|gum base|bubble\s+gum|pur gum)\b/i.test(data.labelHaystack ?? '')
}

function verdictForScore(score: number): { verdict: string; verdictColor: string; progressColor: string } {
  if (score >= 82) {
    return { verdict: 'Minimal processing', verdictColor: '#16a34a', progressColor: '#22c55e' }
  }
  if (score >= 64) {
    return { verdict: 'Lightly processed', verdictColor: '#15803d', progressColor: '#4ade80' }
  }
  if (score >= 42) {
    return { verdict: 'Moderately processed', verdictColor: '#d97706', progressColor: '#f59e0b' }
  }
  if (score >= 22) {
    return { verdict: 'Heavily processed', verdictColor: '#ea580c', progressColor: '#fb923c' }
  }
  return { verdict: 'Ultra-processed style', verdictColor: '#dc2626', progressColor: '#ef4444' }
}

const SEED_OIL_IN_LABEL =
  /\b(canola|rapeseed|soybean|sunflower|safflower|corn|cottonseed|grapeseed|vegetable)\s+oil\b/i

/** Rich label-aware copy for emulsions / dressings — only when the pattern is unambiguous. */
function buildLabelHaystackReasonBlock(data: FillrScoringInput, score: number): string {
  const h = (data.labelHaystack ?? '').trim()
  if (!h) return ''
  const chel = labelHasChelator(h)
  const hasSeed = SEED_OIL_IN_LABEL.test(h)
  const hasModStarch = /\bmodified\b.*\bstarch\b/i.test(h)
  const hasSorb = /\bsorbic\s+acid\b|\bpotassium\s+sorbate\b/i.test(h)
  if (!chel && !(hasSeed && (hasModStarch || hasSorb))) return ''

  const naturalTier = data.ingredientCounts?.natural ?? 0
  const out: string[] = []

  if (chel && hasSeed && naturalTier >= 4 && score >= 38 && score <= 72) {
    out.push(
      `Sits just past the midpoint toward processed. The ${naturalTier} cleaner-tier lines pull the score away from the red zone, but the refined oil base and industrial helpers keep it from reading like a short whole-food list.`
    )
  }
  if (chel) {
    out.push(
      "Calcium disodium EDTA is the flag on this label: a synthetic chelator used to preserve color and slow oxidation. Regulators generally treat it as safe, but it is an industrial line item — not something you'd weigh out in a home kitchen."
    )
  }
  if (hasSeed) {
    out.push(
      'A refined seed oil is usually the largest ingredient by weight in oil-heavy formulas — not acutely unsafe, but higher in omega-6 than olive or avocado oil at the amounts you might eat regularly.'
    )
  }
  if (hasModStarch) {
    out.push(
      'Modified starches (corn / potato) are chemically treated for thickness and emulsion stability — normal in shelf-stable jars, borderline from a strict whole-food view.'
    )
  }
  if (hasSorb) {
    out.push(
      'Sorbic acid / sorbates are synthetic mold inhibitors — common in shelf-stable condiments; stricter clean-label classifications treat them as concerning.'
    )
  }
  if (chel && score >= 38 && score <= 72) {
    out.push(
      'Bottom line: decent for a commercial jar. Avocado- or olive-oil alternatives usually score meaningfully higher — the chelator is the hardest line to justify from a clean-label standpoint.'
    )
  }
  return out.slice(0, 5).join(' ')
}

function buildReason(
  data: FillrScoringInput,
  score: number,
  tierLoad: number,
  signalPart: number
): string {
  const {
    ingredientCounts = { natural: 0, processed: 0, additive: 0, flagged: 0 },
    totalIngredients = 0,
    eNumberCount = 0,
    industrialSweetenerCount = 0,
    hydrogenatedOilCount = 0,
    labelHaystack = '',
  } = data
  const t = totalIngredients || 1
  const naturalShare = ingredientCounts.natural / t
  const flaggedShare = ingredientCounts.flagged / t

  const fromLabel = buildLabelHaystackReasonBlock(data, score)
  if (fromLabel) return fromLabel

  if (isGumCategory(data) && score >= 50) {
    return 'Cleaner for chewing gum: still an engineered product, but it avoids the worst sweetener/additive pattern for this category.'
  }

  const parts: string[] = []
  if (naturalShare >= 0.55 && score >= 70) {
    parts.push('Mostly simple, recognizable ingredients.')
  } else if (flaggedShare >= 0.2) {
    parts.push('Several ingredients read as industrial or best limited.')
  } else if (tierLoad >= 0.45) {
    parts.push('Formulation skews toward additives and industrial inputs.')
  }

  if (eNumberCount >= 3) {
    parts.push('Multiple E-number additives on the label.')
  } else if (eNumberCount >= 1 && signalPart >= 0.12) {
    parts.push('Includes numbered additives (E-coded).')
  }

  if (industrialSweetenerCount >= 2) {
    parts.push('Industrial sweeteners show up more than once.')
  } else if (industrialSweetenerCount === 1) {
    parts.push('Contains an industrial sweetener syrup.')
  }

  if (hydrogenatedOilCount >= 1) {
    parts.push('Includes hydrogenated oils — rare in minimally processed foods.')
  }

  if (parts.length === 0) {
    if (score >= 75) return 'Ingredient list looks relatively close to whole foods.'
    if (score >= 50) return 'Typical packaged food — some processing, not only whole ingredients.'
    return 'Looks closer to an industrial formulation than a short whole-food list.'
  }
  return parts.slice(0, 2).join(' ')
}

/**
 * @returns null when there are no parsed ingredients to score.
 */
export function calculateProcessedRating(data: FillrScoringInput): ProcessedRatingSnapshot | null {
  const total = data.totalIngredients ?? 0
  if (total <= 0) return null

  const {
    ingredientCounts = { natural: 0, processed: 0, additive: 0, flagged: 0 },
    eNumberCount = 0,
    genericFunctionalTermCount = 0,
    industrialSweetenerCount = 0,
    hydrogenatedOilCount = 0,
  } = data

  const ic = ingredientCounts
  const t = total
  // 0 = whole-food end, 1 = heavy industrial (all "avoid"-tier lines)
  const tierLoad =
    (ic.natural * 0 + ic.processed * 0.26 + ic.additive * 0.58 + ic.flagged * 1) / t

  const signalPart = clamp01(
    (eNumberCount * 0.07 +
      genericFunctionalTermCount * 0.055 +
      industrialSweetenerCount * 0.09 +
      hydrogenatedOilCount * 0.11) /
      Math.max(4, t * 0.35)
  )

  let combined = clamp01(tierLoad * 0.88 + signalPart * 0.32)
  const hay = (data.labelHaystack ?? '').trim()
  if (hay && labelHasChelator(hay)) {
    combined = clamp01(combined + 0.24)
  }
  let score = Math.round(100 * (1 - combined))
  if (isGumCategory(data)) {
    const hay = (data.labelHaystack ?? '').toLowerCase()
    const hasXylitol = /\bxylitol\b/.test(hay)
    const hasArtificialSweetener =
      (data.sweetenerCount ?? 0) > 0 ||
      /\b(aspartame|sucralose|acesulfame(?:\s+potassium)?|acesulfame k|saccharin|cyclamate)\b/i.test(hay)
    const hasSevere = hydrogenatedOilCount > 0 || (ingredientCounts.flagged ?? 0) > 0
    if (hasSevere) {
      // Leave truly severe gum near the bottom.
    } else if (hasArtificialSweetener || industrialSweetenerCount > 0) {
      score = Math.max(score, 28)
    } else {
      score = Math.max(score, hasXylitol ? 56 : 42)
    }
    score = Math.min(score, 65)
  }
  const clamped = Math.max(0, Math.min(100, score))
  const { verdict, verdictColor, progressColor } = verdictForScore(clamped)
  const reason = buildReason(data, clamped, tierLoad, signalPart)

  return {
    score: clamped,
    verdict,
    reason,
    verdictColor,
    progressColor,
  }
}

