import type { IngredientExplanation, IngredientRating } from '../types'

const SEED_OIL_RE =
  /\b(canola|rapeseed|soybean|sunflower|safflower|grapeseed|cottonseed)\s+oil\b|\bvegetable oil\b|\bcorn oil\b|\bpalm oil\b|\bpalm kernel oil\b/i

const MODIFIED_STARCH_RE = /\bmodified\b.*\bstarch\b/i

/** Synthetic sorbates — often rated okay; still belongs in “real concerns” for processing callouts. */
const SORBATE_RE = /\bsorbic\s+acid\b|\bpotassium\s+sorbate\b/i

function normRating(ing: IngredientExplanation): IngredientRating {
  return ing.ingredientRating ?? 'okay'
}

/**
 * Groups ingredients for the Summary tab “processing” callouts: industrial / borderline first,
 * then everything that reads as simple label lines (including ambiguous “natural flavour”).
 */
export function splitProcessingSummary(ings: IngredientExplanation[]): {
  concerns: IngredientExplanation[]
  fine: IngredientExplanation[]
} {
  const concerns: IngredientExplanation[] = []
  const fine: IngredientExplanation[] = []
  for (const ing of ings) {
    const r = normRating(ing)
    const n = ing.name.toLowerCase()
    if (r === 'avoid' || r === 'concerning') {
      concerns.push(ing)
    } else if (r === 'okay' && (SEED_OIL_RE.test(n) || MODIFIED_STARCH_RE.test(n) || SORBATE_RE.test(n))) {
      concerns.push(ing)
    } else {
      fine.push(ing)
    }
  }
  return { concerns, fine }
}
