// Product name hints - ONLY when UNKNOWN, never for confirmed detection
// Evidence-based: only suggest if product name contains known allergen terms
// Negation window: suppress hints when "milk-free", "dairy-free", "no X" etc. appear near the term

import type { ProductNameHint } from './types'
import { getBuiltinById } from './builtinDictionary'
import { normalizeText } from './matcher'

/** Negation tokens - if found within ~25 chars before match, suppress hint (avoids "milk-free", "sans lait", etc.) */
const NEGATION_PATTERN = /\b(no|free|without|sans|0%|dairy-free|milk-free|nut-free|gluten-free|wheat-free|soy-free|sans\s+lait|sans\s+soja|sans\s+[oœ]eufs|sans\s+bl[ée]|sans\s+poisson|sans\s+arachides|ne\s+contient\s+pas|sin\s+leche|sin\s+soy[aa]|sin\s+huevos|sin\s+trigo|sin\s+pescado|no\s+contiene)\b/i

/** Well-known product-name indicators. Excludes ambiguous terms like "cheese" (vegan/cheese-flavor). */
const PRODUCT_NAME_INDICATORS: Record<string, string[]> = {
  peanuts: ['peanut', 'reese', 'reeses', 'skippy', 'jif'],
  milk: ['milk', 'dairy', 'yogurt', 'parmesan cheese'],
  wheat: ['bread', 'wheat', 'gluten'],
  soy: ['soy', 'tofu', 'edamame'],
  eggs: ['egg'],
  tree_nuts: ['almond', 'cashew', 'walnut', 'pecan', 'pistachio'],
  sesame: ['sesame', 'tahini'],
  fish: ['fish', 'salmon', 'tuna', 'cod'],
}

/** Check ~20 chars before match for negation - suppress hint if found */
function hasNegationNearMatch(text: string, term: string): boolean {
  const norm = normalizeText(text)
  const t = normalizeText(term)
  const idx = norm.indexOf(t)
  if (idx < 0) return false
  const windowStart = Math.max(0, idx - 25)
  const window = norm.slice(windowStart, idx + t.length + 5)
  return NEGATION_PATTERN.test(window)
}

/**
 * Generate optional unverified hints from product name.
 * Only when overall_status is UNKNOWN. Never affects matched_allergens.
 * Negation window suppresses hints for "milk-free", "dairy-free", etc.
 */
export function getProductNameHints(
  productName: string | undefined,
  enabledBuiltinIds: string[]
): ProductNameHint[] {
  if (!productName || !productName.trim()) return []
  const norm = normalizeText(productName)
  const hints: ProductNameHint[] = []
  for (const id of enabledBuiltinIds) {
    const terms = PRODUCT_NAME_INDICATORS[id]
    if (!terms) continue
    const found = terms.find(t => norm.includes(normalizeText(t)))
    if (found && !hasNegationNearMatch(productName, found)) {
      const builtin = getBuiltinById(id)
      if (builtin) {
        hints.push({
          allergen_id: id,
          allergen_name: builtin.name,
          hint_text: `Product name suggests ${builtin.name}`,
        })
      }
    }
  }
  return hints
}

