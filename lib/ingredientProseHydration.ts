/**
 * Ensures shopper-facing ingredient fields are distinct and ingredient-specific.
 */

import { buildFallbackIngredientExplanation } from './fillrAdapter'
import {
  ingredientExplanationFailsQualityGate,
  textMatchesIngredientGenericPattern,
} from './ingredientCopyQuality'
import type { IngredientExplanation } from '../types'

function normProse(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** True when multiple prose fields are effectively the same sentence. */
export function ingredientProseFieldsAreRepetitive(ing: IngredientExplanation): boolean {
  const parts = [
    ing.whatItIs,
    ing.labelDecoder,
    ing.whatItDoes ?? ing.whyItsUsed,
    ing.bodyEffect,
    ing.headline,
    ing.funFact,
  ]
    .map((p) => normProse(String(p ?? '')))
    .filter((p) => p.length >= 18)

  if (parts.length < 2) return false

  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      const a = parts[i]
      const b = parts[j]
      if (a === b) return true
      const prefix = 28
      if (a.length >= prefix && b.includes(a.slice(0, prefix))) {
        // Headline / hook is often a truncated clause of whatItIs — not duplicate filler.
        if (Math.min(a.length, b.length) < 72 && Math.max(a.length, b.length) > Math.min(a.length, b.length) + 18) {
          continue
        }
        return true
      }
      if (b.length >= prefix && a.includes(b.slice(0, prefix))) {
        if (Math.min(a.length, b.length) < 72 && Math.max(a.length, b.length) > Math.min(a.length, b.length) + 18) {
          continue
        }
        return true
      }
    }
  }
  return false
}

export function ingredientExplanationNeedsHydration(ing: IngredientExplanation): boolean {
  if (ing.aiDecodePending) return false
  if (ingredientExplanationFailsQualityGate(ing)) return true
  if (ingredientProseFieldsAreRepetitive(ing)) return true
  const w1 = String(ing.whatItIs ?? '').trim()
  const w2 = String(ing.whatItDoes ?? ing.whyItsUsed ?? '').trim()
  if (w1 && w2 && normProse(w1) === normProse(w2)) return true
  if (textMatchesIngredientGenericPattern(w1) && textMatchesIngredientGenericPattern(w2)) return true
  return false
}

/**
 * Replace thin / duplicate / template copy with deterministic per-ingredient explanations.
 * Preserves ratings and profile flags from the scan row.
 */
export function ensureDistinctIngredientExplanation(ing: IngredientExplanation): IngredientExplanation {
  if (!ingredientExplanationNeedsHydration(ing)) return ing

  const fb = buildFallbackIngredientExplanation(ing.name)
  return {
    ...fb,
    name: ing.name,
    ingredientRating: ing.ingredientRating ?? fb.ingredientRating,
    verdict: ing.verdict ?? fb.verdict,
    ratingSource: ing.ratingSource ?? fb.ratingSource,
    ratingOverridden: ing.ratingOverridden ?? fb.ratingOverridden,
    personalFlag: ing.personalFlag,
    personalMessage: ing.personalMessage,
    personalizedNote: ing.personalizedNote,
    flagDriver: ing.flagDriver,
    profileAnchor: ing.profileAnchor,
    actionability: ing.actionability,
    impactForYou: ing.impactForYou,
    systemJudgment: ing.systemJudgment,
    shortLabel: ing.shortLabel,
    whyItMattersBullets: ing.whyItMattersBullets,
    intelligenceConfidence: ing.intelligenceConfidence,
    sourceAmbiguity: ing.sourceAmbiguity,
    fromCache: ing.fromCache,
    evidenceTrace: ing.evidenceTrace,
    ingredientDecodeStatus: ing.ingredientDecodeStatus,
    aiDecodePending: ing.aiDecodePending,
    quickSummary:
      ing.quickSummary && !textMatchesIngredientGenericPattern(ing.quickSummary)
        ? ing.quickSummary
        : fb.quickSummary,
  }
}
