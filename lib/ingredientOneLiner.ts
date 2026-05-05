/**
 * Single-line summary for lists — fallback when `buildIngredientCardViewModel` has no short label.
 */
import type { IngredientExplanation } from '../types'
import { isIngredientCopyBoilerplate } from './fillrAdapter'

/** Exported for analytics / other callers that need one sentence. */
export function firstSentencePlain(s: string): string {
  const t = s.trim()
  if (!t) return ''
  const cut = t.split(/(?<=[.!?])\s+/)[0] ?? t
  return cut.trim()
}

function firstSentence(s: string): string {
  return firstSentencePlain(s)
}

/**
 * Best plain-language line for an ingredient (label decode, what it is, or headline stack).
 */
export function buildIngredientTranslationLine(ingredient: IngredientExplanation): string {
  const whatItIs = firstSentence(ingredient.whatItIs || '')
  const whatItDoes = firstSentence(
    (ingredient.whatItDoes ?? ingredient.whyItsUsed ?? '').trim() || ingredient.whatItIs || ''
  )
  const decode = (ingredient.labelDecoder || '').trim()
  if (decode && decode.includes('—') && !isIngredientCopyBoilerplate(decode)) return decode
  if (whatItIs && whatItDoes && whatItIs !== whatItDoes) {
    return `${whatItIs} — ${whatItDoes}`
  }
  if (whatItIs) return whatItIs
  return (
    ingredient.headline?.trim() ||
    ingredient.quickSummary?.trim() ||
    (ingredient.explanation || '').trim().split('.').slice(0, 2).join('. ') ||
    ''
  )
}
