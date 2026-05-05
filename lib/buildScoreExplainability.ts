import type { FillrScoringDataSnapshot, GoalConflictDetail, IngredientExplanation } from '../types'

export type ScoreContributor = {
  label: string
  /** Linear score change from this factor (negative = penalty). */
  delta: number
  /**
   * When set, the overall score was limited to this ceiling by the engine — not additive with other `delta` values.
   */
  capMaxScore?: number
}

export type GoalConflictInsight = {
  title: string
  ingredients: string[]
}

function prettyConflictTitle(label: string): string {
  const t = label.toLowerCase()
  if (t.includes('eat more protein')) return 'Low protein quality'
  if (t.includes('less sugar')) return 'Split sweeteners'
  if (t.includes('cleaner') || t.includes('processed')) return 'High additive load'
  return label
}

function uniqueList(items: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of items) {
    const t = item.trim()
    if (!t) continue
    const k = t.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(t)
  }
  return out
}

function pickConflictIngredients(details: GoalConflictDetail[] | undefined): string[] {
  if (!details?.length) return []
  return uniqueList(details.flatMap((d) => d.ingredients)).slice(0, 2)
}

function buildCapContributor(scoringData: FillrScoringDataSnapshot): ScoreContributor | null {
  if ((scoringData.sensitivityMatches ?? []).length > 0) {
    return { label: 'sensitivity match', capMaxScore: 50, delta: 0 }
  }
  if (
    scoringData.celiacSeverity === 'CAUTION' ||
    (scoringData.celiacStrictGluten && (scoringData.celiacAmbiguousCount ?? 0) > 0)
  ) {
    return { label: 'celiac safety', capMaxScore: 50, delta: 0 }
  }
  if ((scoringData.hydrogenatedOilCount ?? 0) > 0 || (scoringData.ingredientCounts?.flagged ?? 0) > 0) {
    return { label: 'high-risk ingredients', capMaxScore: 35, delta: 0 }
  }
  if ((scoringData.goalConflicts ?? []).includes('keto')) {
    return { label: 'keto conflict', capMaxScore: 25, delta: 0 }
  }
  if (
    (scoringData.goalConflicts ?? []).includes('paleo') &&
    (scoringData.goalConflicts ?? []).includes('paleo-heavy')
  ) {
    return { label: 'paleo conflict', capMaxScore: 35, delta: 0 }
  }
  return null
}

export function buildScoreExplainability(params: {
  scoringData?: FillrScoringDataSnapshot
  ingredients?: IngredientExplanation[]
  goalKey?: string
}): {
  contributors: ScoreContributor[]
  goalConflicts: GoalConflictInsight[]
} {
  const { scoringData, ingredients = [], goalKey = '' } = params
  if (!scoringData) return { contributors: [], goalConflicts: [] }

  const additivePenalty =
    (scoringData.ingredientCounts?.additive ?? 0) * 5 +
    (scoringData.eNumberCount ?? 0) * 5 +
    (scoringData.genericFunctionalTermCount ?? 0) * 3 +
    (scoringData.hydrogenatedOilCount ?? 0) * 10

  const sweetenerPenalty =
    (scoringData.industrialSweetenerCount ?? 0) * 8 +
    Math.max(0, (scoringData.sugarScore ?? 0) - 6) +
    Math.max(0, (scoringData.sweetenerCount ?? 0) * 4)

  const proteinConflictDetail =
    scoringData.goalConflictDetails?.find((d) => /eat more protein/i.test(d.label)) ?? null
  const proteinPenalty =
    /more_protein|build_muscle/i.test(goalKey) && proteinConflictDetail
      ? Math.min(30, Math.max(12, proteinConflictDetail.ingredients.length * 11))
      : 0

  const contributors: ScoreContributor[] = []
  const capContributor = buildCapContributor(scoringData)
  if (capContributor) contributors.push(capContributor)
  if (additivePenalty > 0) {
    contributors.push({
      label: scoringData.productCategory === 'gum' ? 'gum processing baseline' : 'additive load',
      delta: -additivePenalty,
    })
  }
  if (proteinPenalty > 0) contributors.push({ label: 'protein quality mismatch', delta: -proteinPenalty })
  if (sweetenerPenalty > 0) contributors.push({ label: 'sweetener strategy', delta: -sweetenerPenalty })
  contributors.sort((a, b) => {
    const ac = a.capMaxScore != null ? 1 : 0
    const bc = b.capMaxScore != null ? 1 : 0
    if (ac !== bc) return bc - ac
    return Math.abs(b.delta) - Math.abs(a.delta)
  })

  const goalConflicts: GoalConflictInsight[] = []
  for (const d of scoringData.goalConflictDetails ?? []) {
    goalConflicts.push({
      title: prettyConflictTitle(d.label),
      ingredients: uniqueList(d.ingredients).slice(0, 2),
    })
  }
  if (!goalConflicts.length && additivePenalty >= 12) {
    const refs = ingredients
      .filter((i) => (i.ingredientRating ?? 'okay') === 'concerning' || (i.ingredientRating ?? 'okay') === 'avoid')
      .map((i) => i.name)
      .slice(0, 2)
    goalConflicts.push({
      title: scoringData.productCategory === 'gum' ? 'Processed category tradeoff' : 'High additive load',
      ingredients: refs,
    })
  }
  if (!goalConflicts.length && sweetenerPenalty >= 10) {
    goalConflicts.push({
      title: 'Split sweeteners',
      ingredients: pickConflictIngredients(scoringData.goalConflictDetails),
    })
  }

  return { contributors: contributors.slice(0, 3), goalConflicts: goalConflicts.slice(0, 3) }
}
