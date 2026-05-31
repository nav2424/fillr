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
  return {
    name: raw,
    headline: 'Ingredient details unavailable.',
    labelDecoder: 'Ingredient intelligence did not load for this line.',
    whatItIs: '',
    whyItsUsed: '',
    whatToKnow: 'Use the printed package as the source of truth, especially for allergens.',
    quickSummary: 'Details unavailable',
    ingredientRating: 'okay',
    verdict: 'NEUTRAL',
    ratingReason: 'Rating may update after a successful online decode; it is based on the ingredient name only right now.',
    ratingSource: 'deterministic',
    ingredientDecodeStatus: 'unavailable',
  }
}
