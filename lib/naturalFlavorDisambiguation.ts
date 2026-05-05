import type { ProductCategory } from './fillrScoring'

type NaturalFlavorContext = {
  ingredientName: string
  fullLabelHaystack?: string
  productCategory?: ProductCategory
}

const NATURAL_FLAVOR_RE = /\bnatural flavou?r(s)?\b/i
const ALLERGEN_SUPPORT_RE =
  /\b(milk|whey|casein|caseinate|butter|cream|cheese|egg|albumin|soy|soybean|wheat|barley|rye|malt|gluten|sesame|peanut|almond|cashew|hazelnut|walnut|pecan|pistachio|shellfish|shrimp|crab|lobster|fish)\b/i
const RISKY_PAIR_RE =
  /\b(artificial flavou?r|caramel colou?r|msg|monosodium glutamate|disodium inosinate|disodium guanylate|malt extract|yeast extract)\b/i

const ESCALATE_CATEGORIES = new Set<ProductCategory>(['candy', 'drink', 'gum'])
const CARAMEL_RE = /\bcaramel colou?r\b/i
const MALTODEXTRIN_RE = /\bmaltodextrin\b/i
const MODIFIED_STARCH_RE = /\bmodified (food )?starch\b/i
const GLUTEN_SUPPORT_RE = /\b(barley|malt|wheat|rye|gluten)\b/i
const ULTRA_PROCESSED_SUPPORT_RE =
  /\b(artificial flavou?r|preservative|sweetener|syrup|hydrogenated|emulsifier)\b/i
const PROCESSED_ESCALATE_CATEGORIES = new Set<ProductCategory>(['candy', 'drink', 'gum', 'condiment'])

export function shouldEscalateNaturalFlavor(
  ctx: NaturalFlavorContext
): { escalate: boolean; reason: string } {
  const ingredient = String(ctx.ingredientName ?? '').trim().toLowerCase()
  if (!NATURAL_FLAVOR_RE.test(ingredient)) {
    return { escalate: false, reason: 'not_natural_flavor' }
  }

  const haystack = String(ctx.fullLabelHaystack ?? '').toLowerCase()
  const hasAllergenSupport = ALLERGEN_SUPPORT_RE.test(haystack)
  if (hasAllergenSupport) {
    return { escalate: true, reason: 'allergen_context' }
  }

  const hasRiskyPair = RISKY_PAIR_RE.test(haystack)
  if (hasRiskyPair) {
    return { escalate: true, reason: 'paired_risky_signals' }
  }

  if (ctx.productCategory && ESCALATE_CATEGORIES.has(ctx.productCategory)) {
    return { escalate: true, reason: `category_${ctx.productCategory}` }
  }

  return { escalate: false, reason: 'insufficient_context' }
}

export function shouldEscalateProcessingSignal(
  ctx: NaturalFlavorContext
): { escalate: boolean; reason: string } {
  const ingredient = String(ctx.ingredientName ?? '').trim().toLowerCase()
  const isCaramel = CARAMEL_RE.test(ingredient)
  const isMaltodextrin = MALTODEXTRIN_RE.test(ingredient)
  const isModifiedStarch = MODIFIED_STARCH_RE.test(ingredient)
  if (!isCaramel && !isMaltodextrin && !isModifiedStarch) {
    return { escalate: false, reason: 'not_target_signal' }
  }

  const haystack = String(ctx.fullLabelHaystack ?? '').toLowerCase()

  if (isCaramel && GLUTEN_SUPPORT_RE.test(haystack)) {
    return { escalate: true, reason: 'gluten_context' }
  }

  if (ULTRA_PROCESSED_SUPPORT_RE.test(haystack)) {
    return { escalate: true, reason: 'paired_processed_signals' }
  }

  if (ctx.productCategory && PROCESSED_ESCALATE_CATEGORIES.has(ctx.productCategory)) {
    return { escalate: true, reason: `category_${ctx.productCategory}` }
  }

  return { escalate: false, reason: 'insufficient_context' }
}

