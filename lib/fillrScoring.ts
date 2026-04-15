/**
 * Deterministic Fillr Fit scoring — no AI, no network.
 */

export type FillrIngredientCounts = {
  natural: number
  processed: number
  additive: number
  flagged: number
}

export type FillrScoringInput = {
  allergyMatches?: string[]
  celiacSeverity?: 'SAFE' | 'CAUTION' | 'AVOID'
  sensitivityMatches?: string[]
  avoidingMatches?: string[]
  goalMatches?: string[]
  goalConflicts?: string[]
  ingredientCounts?: FillrIngredientCounts
  totalIngredients?: number
  eNumberCount?: number
  genericFunctionalTermCount?: number
  industrialSweetenerCount?: number
  hydrogenatedOilCount?: number
}

export type FillrFitComputed = {
  score: number
  verdict: string
  verdictColor: string
  progressColor: string
  reason: string
  tier: 1 | 2 | 3
}

function formatList(arr: string[]): string {
  if (arr.length === 0) return ''
  if (arr.length === 1) return arr[0]
  if (arr.length === 2) return `${arr[0]} and ${arr[1]}`
  return `${arr[0]}, ${arr[1]} and ${arr.length - 2} more`
}

export function formatGoalName(slug: string): string {
  const map: Record<string, string> = {
    understand: 'understanding what you eat',
    lose_weight: 'weight loss',
    build_muscle: 'building muscle',
    eat_cleaner: 'eating cleaner',
    improve_health: 'improving health',
    low_carb: 'keto / low carb',
    keto: 'keto',
    high_protein: 'high protein',
    low_sugar: 'low sugar',
    low_calorie: 'low calorie',
    vegan: 'vegan',
    vegetarian: 'vegetarian',
    plant_based: 'plant-based',
    less_processed: 'eating cleaner',
    paleo: 'paleo',
    'keto-conflict': 'keto',
    'paleo-heavy': 'paleo',
  }
  const k = slug.trim().toLowerCase()
  return map[k] ?? slug
}

function hasLactoseSignal(sensitivityMatches: string[]): boolean {
  return sensitivityMatches.some((s) => /lactose|milk|dairy|whey|casein/i.test(String(s)))
}

export function calculateFillrFit(data: FillrScoringInput): FillrFitComputed {
  const {
    allergyMatches = [],
    celiacSeverity = 'SAFE',
    sensitivityMatches = [],
    avoidingMatches = [],
    goalMatches = [],
    goalConflicts = [],
    ingredientCounts = {
      natural: 0,
      processed: 0,
      additive: 0,
      flagged: 0,
    },
    totalIngredients = 0,
    eNumberCount = 0,
    genericFunctionalTermCount = 0,
    industrialSweetenerCount = 0,
    hydrogenatedOilCount = 0,
  } = data

  if (allergyMatches.length > 0) {
    return {
      score: 0,
      verdict: 'Unsafe',
      verdictColor: '#dc2626',
      reason: `Contains ${formatList(allergyMatches)} — on your allergy list`,
      tier: 1,
      progressColor: '#dc2626',
    }
  }

  if (celiacSeverity === 'AVOID') {
    return {
      score: 0,
      verdict: 'Unsafe',
      verdictColor: '#dc2626',
      reason: 'Contains a direct gluten source — unsafe for celiac disease',
      tier: 1,
      progressColor: '#dc2626',
    }
  }

  let isTier2 = false
  let tier2Reason = ''

  if (celiacSeverity === 'CAUTION') {
    isTier2 = true
    tier2Reason = 'Possible gluten risk — verify before consuming'
  }

  if (sensitivityMatches.length > 0 && !isTier2) {
    isTier2 = true
    if (hasLactoseSignal(sensitivityMatches)) {
      tier2Reason = `Contains ${sensitivityMatches[0]} — lactose sensitivity`
    } else {
      tier2Reason = `Contains ${sensitivityMatches[0]} — flagged as your sensitivity`
    }
  }

  const total = totalIngredients || 1

  const cleanRatio =
    (ingredientCounts.natural + ingredientCounts.processed * 0.4) / total

  const flagPenalty =
    (ingredientCounts.flagged * 15 + ingredientCounts.additive * 6) / total

  const qualityScore = Math.max(0, cleanRatio * 100 - flagPenalty)

  const avoidPenalty = avoidingMatches.length * 8

  let goalsScore = 50
  goalsScore += goalMatches.length * 15
  goalsScore -= goalConflicts.length * 20
  goalsScore = Math.max(0, Math.min(100, goalsScore))

  const hasProfile =
    goalMatches.length > 0 ||
    goalConflicts.length > 0 ||
    avoidingMatches.length > 0 ||
    sensitivityMatches.length > 0

  let finalScore: number
  if (!hasProfile) {
    finalScore = qualityScore
  } else {
    finalScore = qualityScore * 0.6 + goalsScore * 0.4 - avoidPenalty
  }

  // Sensitivity penalty is proportional to detected profile-linked triggers.
  finalScore -= sensitivityMatches.length * 15

  // Processing intensity penalties apply regardless of user profile.
  finalScore -= ingredientCounts.additive * 5
  finalScore -= eNumberCount * 5
  finalScore -= genericFunctionalTermCount * 3
  finalScore -= industrialSweetenerCount * 8
  finalScore -= hydrogenatedOilCount * 10

  finalScore = Math.round(Math.max(0, Math.min(100, finalScore)))

  if (isTier2) {
    finalScore = Math.min(finalScore, 50)
  }

  if (goalConflicts.includes('keto')) {
    finalScore = Math.min(finalScore, 25)
  }

  if (goalConflicts.includes('paleo') && goalConflicts.includes('paleo-heavy')) {
    finalScore = Math.min(finalScore, 35)
  }

  let verdict: string
  let verdictColor: string
  let progressColor: string

  if (finalScore >= 80) {
    verdict = 'Great fit'
    verdictColor = '#16a34a'
    progressColor = '#22c55e'
  } else if (finalScore >= 60) {
    verdict = 'Good fit'
    verdictColor = '#16a34a'
    progressColor = '#22c55e'
  } else if (finalScore >= 40) {
    verdict = 'Decent fit'
    verdictColor = '#d97706'
    progressColor = '#f59e0b'
  } else if (finalScore >= 20) {
    verdict = 'Poor fit'
    verdictColor = '#ea580c'
    progressColor = '#fb923c'
  } else {
    verdict = 'Not for you'
    verdictColor = '#dc2626'
    progressColor = '#ef4444'
  }

  let reason = ''

  if (isTier2) {
    reason = tier2Reason
  } else if (avoidingMatches.length > 0 && goalConflicts.length > 0) {
    reason = `Contains ingredients you avoid and conflicts with your ${formatGoalName(goalConflicts[0])} goal`
  } else if (avoidingMatches.length > 0) {
    reason = `Contains ${avoidingMatches.length} ingredient${avoidingMatches.length > 1 ? 's' : ''} you prefer to avoid`
  } else if (goalConflicts.length > 0) {
    reason = `Conflicts with your ${formatGoalName(goalConflicts[0])} goal`
  } else if (ingredientCounts.flagged > 0) {
    reason = `${ingredientCounts.flagged} flagged ingredient${ingredientCounts.flagged > 1 ? 's' : ''} lower the quality score`
  } else if (goalMatches.length > 0 && finalScore >= 70) {
    reason = `Aligns well with your ${formatGoalName(goalMatches[0])} goal`
  } else if (finalScore >= 80) {
    reason = 'Clean ingredient list — matches your profile well'
  } else {
    reason = 'Scored on overall ingredient quality for your profile'
  }

  return {
    score: finalScore,
    verdict,
    verdictColor,
    progressColor,
    reason,
    tier: isTier2 ? 2 : 3,
  }
}
