import {
  detectAllergensEvidenceBased,
  type DetectionOutput,
  type UserAllergenConfig,
} from './allergenEngine'
import type { MatchedAllergen, OverallStatus, Severity } from './allergenEngine/types'
import { normalizeText } from './allergenEngine/matcher'

export interface CachedBarcodeAllergenScanInput {
  productName?: string
  /** Learned label (OCR / manual backfill) chosen as the ingredient list. */
  cachedIngredientText: string
  /**
   * OFF English (or raw) ingredient haystack. Often shorter than the learned label.
   * Searched in addition to the learned label — never instead of it.
   */
  offSafetyText?: string
  containsText?: string
  mayContainText?: string
  allergensTags?: string[]
  tracesTags?: string[]
}

/**
 * Allergen detection for a barcode hit that is reusing a stored ingredient list.
 *
 * OFF `ingredients_text_safety` used to replace the stored list whenever it was
 * non-empty. A sparse Open Food Facts English field ("oats, honey, salt") then
 * hid allergens that existed only on the captured label, while the product screen
 * still showed that label. Tags and contains-lines from OFF are kept. An allergen
 * that appears only on the OFF ingredient text is still detected.
 */
export function detectAllergensForCachedBarcodeScan(
  input: CachedBarcodeAllergenScanInput,
  userConfig: UserAllergenConfig
): DetectionOutput {
  const cached = input.cachedIngredientText.trim()
  const off = (input.offSafetyText ?? '').trim()
  const primary = detectAllergensEvidenceBased(
    {
      product_name: input.productName,
      ingredients_text: cached,
      ingredients_text_safety: cached,
      contains_text: input.containsText ?? '',
      may_contain_text: input.mayContainText ?? '',
      allergens_tags: input.allergensTags,
      traces_tags: input.tracesTags,
    },
    userConfig
  )

  if (!off || normalizeText(off) === normalizeText(cached)) return primary

  const fromOffIngredients = detectAllergensEvidenceBased(
    {
      product_name: input.productName,
      ingredients_text: off,
      ingredients_text_safety: off,
      contains_text: '',
      may_contain_text: '',
      allergens_tags: [],
      traces_tags: [],
    },
    userConfig
  )

  return {
    ...primary,
    overall_status: strongerOverallStatus(primary.overall_status, fromOffIngredients.overall_status),
    matched_allergens: mergeMatchedAllergens(
      primary.matched_allergens,
      fromOffIngredients.matched_allergens
    ),
  }
}

function strongerOverallStatus(a: OverallStatus, b: OverallStatus): OverallStatus {
  const rank: Record<OverallStatus, number> = {
    CONTAINS: 3,
    MAY_CONTAIN: 2,
    SAFE: 1,
    UNKNOWN: 0,
  }
  return rank[a] >= rank[b] ? a : b
}

function mergeMatchedAllergens(a: MatchedAllergen[], b: MatchedAllergen[]): MatchedAllergen[] {
  const byId = new Map<string, MatchedAllergen>()
  for (const match of [...a, ...b]) {
    const current = byId.get(match.allergen_id)
    if (!current) {
      byId.set(match.allergen_id, { ...match })
      continue
    }
    const severity: Severity =
      current.severity === 'CONTAINS' || match.severity === 'CONTAINS' ? 'CONTAINS' : 'MAY_CONTAIN'
    const base =
      match.severity === 'CONTAINS' && current.severity !== 'CONTAINS' ? match : current
    const parts = new Set<string>()
    for (const blob of [current.match_text, match.match_text]) {
      for (const bit of String(blob ?? '')
        .split(/\s*·\s*/)
        .map((part) => part.trim())
        .filter(Boolean)) {
        parts.add(bit)
      }
    }
    byId.set(match.allergen_id, {
      ...base,
      severity,
      match_text: [...parts].join(' · '),
    })
  }
  return [...byId.values()]
}
