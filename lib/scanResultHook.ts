import type { IngredientRating } from '../types'
import type { ProductAnalysis } from '../types'

export type RatingCounts = {
  clean: number
  okay: number
  concerning: number
  avoid: number
}

/**
 * Primary insight line for the results hero. Prefer AI viralHook when it fits;
 * otherwise deterministic fallbacks aligned with product policy.
 */
export function buildInsightHook(params: {
  viralHook?: string
  productVerdict?: string
  matchedAllergenNames: string[]
  celiacAvoid: boolean
  celiacReason?: string
  ratingCounts: RatingCounts
  sugarSourceCount: number
  regulatoryEUHint: boolean
  goalConflictsCount?: number
  ingredientCount?: number
  eNumberCount?: number
  genericFunctionalTermCount?: number
}): string {
  const {
    viralHook,
    productVerdict,
    matchedAllergenNames,
    celiacAvoid,
    celiacReason,
    ratingCounts,
    sugarSourceCount,
    regulatoryEUHint,
    goalConflictsCount = 0,
    ingredientCount = 0,
    eNumberCount = 0,
    genericFunctionalTermCount = 0,
  } = params

  if (matchedAllergenNames.length > 0) {
    const a = matchedAllergenNames.join(' and ')
    return `Contains ${a} — flagged against your allergy profile.`
  }

  if (celiacAvoid) {
    return 'Not safe for your profile.'
  }

  if (viralHook?.trim()) return viralHook.trim()
  if (regulatoryEUHint) {
    return 'One ingredient here is banned in the EU. Still legal in Canada.'
  }
  if (sugarSourceCount >= 2) {
    return `${sugarSourceCount} forms of sugar hidden across this label.`
  }

  const nasty = ratingCounts.concerning + ratingCounts.avoid
  const allClean = nasty === 0 && ratingCounts.clean + ratingCounts.okay > 0
  const scoreHint = ratingCounts.clean * 6 + ratingCounts.okay * 3 - ratingCounts.concerning * 8 - ratingCounts.avoid * 15
  const hasNoAdditives = ratingCounts.concerning === 0
  const hasNoFlagged = ratingCounts.avoid === 0
  const ingredientCountOk = ingredientCount > 0 && ingredientCount <= 8
  const cleanTaglineAllowed =
    hasNoAdditives &&
    hasNoFlagged &&
    eNumberCount === 0 &&
    genericFunctionalTermCount === 0 &&
    ingredientCountOk &&
    goalConflictsCount === 0

  if (scoreHint >= 85 && allClean && cleanTaglineAllowed) {
    return 'Every ingredient here is something your great-grandmother would recognize.'
  }
  if (scoreHint >= 70 && ratingCounts.avoid === 0) {
    return 'Mostly clean — a few processed ingredients but nothing alarming.'
  }
  if (ratingCounts.avoid > 0 && scoreHint >= 50) {
    return `${ratingCounts.avoid} ingredient${ratingCounts.avoid > 1 ? 's' : ''} flagged — worth a closer look.`
  }
  if (goalConflictsCount > 0) {
    return 'Conflicts with your nutrition goal.'
  }
  if (nasty >= 1) {
    return `${nasty} ingredients of concern in this product.`
  }

  if (productVerdict?.trim()) return productVerdict.trim()

  return 'Plain-English decode of every line on this label — scroll for the full breakdown.'
}

export function regulatoryMentionsEU(analysis: ProductAnalysis | undefined): boolean {
  const flags = analysis?.regulatoryFlags ?? []
  return flags.some((f) => {
    const blob = `${f.issue} ${f.regions}`.toLowerCase()
    return /\beu\b|europe|european|banned.*eu/i.test(blob)
  })
}

export type SortableRating = IngredientRating | 'safe'

const RANK: Record<string, number> = {
  avoid: 0,
  concerning: 1,
  okay: 2,
  clean: 3,
  safe: 3,
}

export function ingredientSortRank(
  rating: SortableRating,
  hasPersonalSafety: boolean
): [number, number] {
  const base = RANK[rating] ?? 3
  return [base, hasPersonalSafety ? 0 : 1]
}
