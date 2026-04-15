import type { IngredientExplanation, IngredientRating } from '../types'

function normalizeLegacyRating(r: IngredientRating | 'safe' | undefined): IngredientRating {
  if (r === 'safe') return 'clean'
  if (r === 'clean' || r === 'okay' || r === 'concerning' || r === 'avoid') return r
  return 'clean'
}

/** Same logic as ingredient cards — used for sorting and personalized scoring. */
export function resolveIngredientDisplayRating(
  ingredient: IngredientExplanation,
  allergyMatch?: boolean,
  sensitivityMatch?: boolean
): IngredientRating {
  if (ingredient.personalFlag === 'allergy' || allergyMatch) return 'avoid'
  if (ingredient.personalFlag === 'sensitivity' || sensitivityMatch) {
    const r =
      ingredient.ingredientRating != null
        ? normalizeLegacyRating(ingredient.ingredientRating)
        : ingredient.verdict === 'LIMIT'
          ? 'avoid'
          : ingredient.verdict === 'NEUTRAL'
            ? 'okay'
            : 'clean'
    if (r === 'clean' || r === 'okay') return 'concerning'
    return r
  }
  if (ingredient.ingredientRating != null) return normalizeLegacyRating(ingredient.ingredientRating)
  if (ingredient.verdict === 'LIMIT') return 'avoid'
  if (ingredient.verdict === 'NEUTRAL') return 'okay'
  return 'clean'
}
