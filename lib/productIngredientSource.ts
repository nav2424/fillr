/**
 * Compare ingredient-text sources when barcode cache and Open Food Facts disagree.
 */

import { parseIngredientListFromPlain } from './ingredientTextParsing'

/** Cache must beat OFF by this margin to win a live scan; OFF must beat learned text by this margin to clobber it. */
export const INGREDIENT_SOURCE_PREFERENCE_MARGIN = 18

export function isLearnedIngredientSource(source: string | null | undefined): boolean {
  return /backfilled|photo_ocr|manual_entry/i.test(String(source ?? ''))
}

export function scoreIngredientSource(
  ingredientText: string,
  sourceLabel: string,
  updatedAt?: string | null
): number {
  const text = String(ingredientText ?? '').trim()
  if (!text) return 0
  const parsedCount = parseIngredientListFromPlain(text, 'barcode').length
  let score = 0
  score += Math.min(text.length, 5000) / 25
  score += Math.min(parsedCount * 16, 220)
  if (/\bingredients?\s*:/i.test(text)) score += 40
  if (/openfoodfacts/i.test(sourceLabel)) score += 20
  if (/backfilled|photo_ocr|manual_entry/i.test(sourceLabel)) score += 35
  if (updatedAt && !Number.isNaN(Date.parse(updatedAt))) {
    const ageDays = (Date.now() - Date.parse(updatedAt)) / (1000 * 60 * 60 * 24)
    if (ageDays <= 30) score += 20
    else if (ageDays <= 180) score += 10
  }
  return Math.round(score)
}

/**
 * Decide which ingredient_text/source to persist on an OFF product upsert.
 * Learned OCR/manual backfills must not be overwritten by weaker or similar OFF text —
 * that path previously destroyed Contains-line evidence and later scans could false-SAFE.
 */
export function resolveProductUpsertIngredient(params: {
  offIngredientText: string | null | undefined
  offUpdatedAt?: string | null
  existingIngredientText: string | null | undefined
  existingSource: string | null | undefined
  existingUpdatedAt?: string | null
}): { ingredientText: string | null; source: string } {
  const offText = String(params.offIngredientText ?? '').trim() || null
  const existingText = String(params.existingIngredientText ?? '').trim() || null
  const existingSource = String(params.existingSource ?? '').trim() || null

  if (existingText && existingSource && isLearnedIngredientSource(existingSource)) {
    const offScore = scoreIngredientSource(offText ?? '', 'openfoodfacts', params.offUpdatedAt)
    const existingScore = scoreIngredientSource(
      existingText,
      existingSource,
      params.existingUpdatedAt
    )
    if (offScore < existingScore + INGREDIENT_SOURCE_PREFERENCE_MARGIN) {
      return { ingredientText: existingText, source: existingSource }
    }
  }

  return { ingredientText: offText, source: 'openfoodfacts' }
}
