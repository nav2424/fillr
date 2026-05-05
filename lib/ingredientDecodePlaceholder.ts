/**
 * Placeholders for ingredient rows that still need an OpenAI decode.
 * Intentionally fail `ingredientExplanationFailsQualityGate` / validation so repair passes replace them.
 */

import type { IngredientExplanation } from '../types'
import type { IngredientAnalysisItem } from '../services/openaiIngredientAnalysisPrompt'

export function createAwaitingDecodeIngredientExplanation(labelName: string): IngredientExplanation {
  const name = labelName.trim() || 'Ingredient'
  return {
    name,
    whatItIs: '',
    whyItsUsed: '',
    whatToKnow: '',
    headline: '',
    labelDecoder: '',
    quickSummary: '',
    ingredientRating: 'okay',
    verdict: 'NEUTRAL',
  }
}

export function createAwaitingDecodeAnalysisItem(labelName: string): IngredientAnalysisItem {
  const name = labelName.trim() || 'Ingredient'
  return {
    name,
    headline: '',
    labelDecoder: '',
    whatItIs: '',
    whatItDoes: '',
    bodyEffect: '',
    funFact: '',
    whyItMattersYou: '',
    ratingReason: '',
    rating: 'okay',
    contextStat: '',
  }
}

/**
 * Honest per-line copy when AI decode never arrived (timeout / offline).
 * Not encyclopedia filler — tells the user what happened and what to do next.
 */
export function createOfflineOrTimeoutIngredientExplanation(labelName: string): IngredientExplanation {
  const raw = labelName.trim() || 'Ingredient'
  const quoted = raw.includes('"') ? raw : `“${raw}”`
  return {
    name: raw,
    headline: `Decode for ${quoted} didn’t load this time.`,
    labelDecoder: `We see ${quoted} on your label, but the detailed Fillr card didn’t download—usually a weak connection or a timeout.`,
    whatItIs: `Reconnect when you can, open this scan again, and Fillr will try to pull the same ingredient breakdown you get online. Until then, treat the printed package as the source of truth, especially for allergens.`,
    whyItsUsed: `No role text is available without a network decode; this row only mirrors the wording from your label.`,
    whatToKnow: `If you manage allergies medically, confirm the physical label before eating.`,
    quickSummary: `Offline or timed out — tap back in online to refresh this line.`,
    ingredientRating: 'okay',
    verdict: 'NEUTRAL',
    ratingReason: 'Rating may update after a successful online decode; it is based on the ingredient name only right now.',
    ratingSource: 'deterministic',
  }
}
