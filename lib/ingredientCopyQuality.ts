/**
 * Detects generic / template ingredient copy so we can repair or reject instead of shipping filler.
 */

import type { IngredientExplanation } from '../types'
import type { IngredientAnalysisItem } from '../services/openaiIngredientAnalysisPrompt'
import { isIngredientCopyBoilerplate } from './fillrAdapter'

/** Patterns that must never pass as “real” shopper-facing ingredient intelligence. */
export const INGREDIENT_GENERIC_PROSE_PATTERNS: RegExp[] = [
  /many labels use a short or trade name/i,
  /exact compound or source is not obvious from this line alone/i,
  /this line on the label names a typical packaged-food ingredient/i,
  /typical ingredient used for taste, texture, or shelf life/i,
  /similar to other items in the same category/i,
  /Ingredient lists are ordered by weight—what appears earlier/i,
  /could not be parsed from the model json/i,
  /Fillr keeps the raw label line/i,
  /malformed ingredient row/i,
  /Fillr used a cautious default/i,
  /This label line is decoded in plain language for your profile context/i,
  /This label line maps to a profile-relevant ingredient concern/i,
  /once eaten.*handled like other foods/i,
  /specifics depend on what the ingredient/i,
  /common processed-food ingredient/i,
  /supports taste, texture, stability/i,
  /how this manufacturer lists this component/i,
  /manufacturer lists this component on the ingredient panel/i,
  /its role here depends on the recipe/i,
  /texture, sweetness, shelf life, color, or how the line runs/i,
  /a named ingredient in (this|the) (formula|product)/i,
  /one of the key lines to verify/i,
  /if dairy is in your profile/i,
  /this ingredient is explicitly listed on the label and contributes to the product formula/i,
  /contributes to the product recipe,\s*texture,\s*flavou?r,\s*stability,\s*or nutrition profile/i,
  /\b(label ingredient|named label ingredient)\b/i,
  /does not align with your profile settings and is one of the lines driving this rating/i,
  /an indication of .* presence/i,
  /warns of potential .* allergens/i,
  /it helps prevent allergic reactions/i,
]

export function textMatchesIngredientGenericPattern(text: string | undefined | null): boolean {
  const t = String(text ?? '').trim()
  if (!t) return false
  return INGREDIENT_GENERIC_PROSE_PATTERNS.some((re) => re.test(t))
}

function collectExplanationProse(ing: IngredientExplanation): string {
  const parts = [
    ing.headline,
    ing.labelDecoder,
    ing.whatItIs,
    ing.whatItDoes ?? ing.whyItsUsed,
    ing.bodyEffect,
    ing.whyItMatters,
    ing.quickSummary,
    ing.explanation,
    ing.ratingReason,
    ...(Array.isArray(ing.whyItMattersBullets) ? ing.whyItMattersBullets : []),
  ]
  return parts.map((p) => String(p ?? '').trim()).filter(Boolean).join('\n')
}

/** True when merged / cached card copy is empty, too thin, template-like, or knowledge-cache filler. */
export function ingredientExplanationFailsQualityGate(ing: IngredientExplanation): boolean {
  if (ing.ingredientDecodeStatus === 'unavailable') return true
  const blob = collectExplanationProse(ing)
  if (!blob.trim()) return true
  const wi = (ing.whatItIs ?? '').trim().length
  const ld = (ing.labelDecoder ?? '').trim().length
  const hl = (ing.headline ?? '').trim().length
  if (Math.max(wi, ld, hl) < 24) return true
  if (isIngredientCopyBoilerplate(blob)) return true
  if (INGREDIENT_GENERIC_PROSE_PATTERNS.some((re) => re.test(blob))) return true
  return false
}

const ITEM_PROSE_KEYS: (keyof IngredientAnalysisItem)[] = [
  'headline',
  'labelDecoder',
  'whatItIs',
  'whatItDoes',
  'bodyEffect',
  'funFact',
  'whyItMattersYou',
  'ratingReason',
]

export function ingredientAnalysisItemFailsGenericGate(item: IngredientAnalysisItem): boolean {
  let maxLen = 0
  for (const k of ITEM_PROSE_KEYS) {
    const L = String(item[k] ?? '').trim().length
    if (L > maxLen) maxLen = L
  }
  if (maxLen < 24) return true
  const blob = ITEM_PROSE_KEYS.map((k) => String(item[k] ?? '').trim()).filter(Boolean).join('\n')
  if (!blob.trim()) return true
  if (INGREDIENT_GENERIC_PROSE_PATTERNS.some((re) => re.test(blob))) return true
  return false
}
