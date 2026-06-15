import type { FillrScoringInput, ProductCategory } from './fillrScoring'
import {
  computeIngredientQualityScore,
  computeNutritionFitScore,
  scoreToShortVerdict,
} from './fillrScoring'
import { extractNutritionFacts, nutritionFactsHasData, type NutritionFacts } from './extractNutritionFacts'
import { buildCategoryNutritionInsight } from './nutritionCategoryBenchmarks'
import { getGoalDisplayLabel } from './profileDisplayLabels'
import { detectProductPatterns } from './productPatternDetection'
import { mergedNutritionTargets, type NutritionTargets } from './nutritionTargets'
import type { ProductAnalysis, ScanResult } from '../types'

/** FDA Daily Values on a 2,000 cal diet (reference labels). */
const DV = {
  calories: 2000,
  fatG: 78,
  carbsG: 275,
  sugarsG: 50,
  proteinG: 50,
  sodiumMg: 2300,
} as const

export type NutritionMacroRow = {
  key: string
  label: string
  value: number
  unit: string
  display: string
  dvPercent?: number
  barPercent: number
  tone: 'good' | 'warn' | 'bad' | 'neutral'
  callout?: string
}

export type NutritionIntelligenceBlock = {
  sweetenerStack?: string
  sodiumSources: string[]
  hiddenSugarNote?: string
}

export type NutritionTargetVerdict = {
  status: 'pass' | 'warn' | 'fail'
  headline: string
  issues: string[]
}

export type NutritionLensScores = {
  ingredientQuality: number
  nutritionFit: number
  ingredientLabel: string
  nutritionLabel: string
}

export type NutritionViewModel = {
  hasData: boolean
  servingLabel?: string
  macros: NutritionMacroRow[]
  callouts: string[]
  intelligence: NutritionIntelligenceBlock
  categoryContext?: { line: string; categoryLabel: string }
  targetVerdict?: NutritionTargetVerdict
  lensScores: NutritionLensScores
}

const SODIUM_SOURCE_RE =
  /\b(salt|sodium|soy sauce|shoyu|tamari|miso|msg|monosodium glutamate|broth|stock|baking soda|bicarbonate|sodium benzoate|sodium nitrite)\b/i

function pctDv(value: number, dv: number): number {
  if (dv <= 0) return 0
  return Math.round((value / dv) * 100)
}

function barFromDv(dvPercent: number): number {
  return Math.min(100, Math.max(4, dvPercent))
}

function scoringInputFromScan(
  scan: ScanResult,
  scoringData?: FillrScoringInput | null
): FillrScoringInput {
  const facts = extractNutritionFacts(scan)
  return {
    ...(scoringData ?? {}),
    productCategory: scoringData?.productCategory,
    caloriesPerServing: facts.calories ?? scoringData?.caloriesPerServing,
    sodiumMgPerServing: facts.sodiumMg ?? scoringData?.sodiumMgPerServing,
    fatGPerServing: facts.fatG ?? scoringData?.fatGPerServing,
    proteinGPerServing: facts.proteinG ?? scoringData?.proteinGPerServing,
    sugarsGPerServing: facts.sugarsG ?? scoringData?.sugarsGPerServing,
    carbsGPerServing: facts.carbsG ?? scoringData?.carbsGPerServing,
    sugarScore: scoringData?.sugarScore,
  }
}

function detectSodiumSources(ingredientNames: string[]): string[] {
  const hits: string[] = []
  const seen = new Set<string>()
  for (const raw of ingredientNames) {
    const name = raw.trim()
    if (!name || !SODIUM_SOURCE_RE.test(name)) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    hits.push(name)
  }
  return hits.slice(0, 4)
}

function countSugarIngredientHits(names: string[]): number {
  return names.filter((n) =>
    /\b(sugar|sucrose|fructose|dextrose|glucose|maltose|honey|molasses|syrup|maltodextrin)\b/i.test(n)
  ).length
}

function buildSweetenerStackText(
  sugarSources: string[],
  ingredientNames: string[],
  productAnalysis?: ProductAnalysis | null
): string | undefined {
  const fromAnalysis = (productAnalysis?.sugarSources ?? []).map((s) => s.trim()).filter(Boolean)
  const sources = fromAnalysis.length > 0 ? fromAnalysis : sugarSources
  if (sources.length === 0) return undefined

  const sugarLineCount = countSugarIngredientHits(ingredientNames)
  const parts: string[] = []
  if (sugarLineCount >= 2) {
    parts.push(`Sugar appears ${sugarLineCount}× on the label`)
  } else if (sources.length >= 2) {
    parts.push(`Sweetness from ${sources.slice(0, 3).join(', ')}`)
  } else {
    parts.push(sources[0])
  }

  const hidden = productAnalysis?.hiddenIngredients?.[0]?.name?.trim()
  if (hidden && /flavou?r/i.test(hidden)) {
    parts.push(`plus ${hidden} (undisclosed sub-ingredients)`)
  }

  return parts.join('; ')
}

function buildHiddenSugarNote(facts: NutritionFacts, sugarSources: string[], sugarScore?: number): string | undefined {
  const labelSugars = facts.sugarsG ?? 0
  const sourceCount = sugarSources.length
  if (sourceCount >= 2 && labelSugars >= 8) {
    return `Label lists ${labelSugars}g sugar, but ${sourceCount} sweetener sources suggest higher total sweetener load.`
  }
  if ((sugarScore ?? 0) >= 12 && labelSugars >= 6) {
    return `Ingredient pattern suggests more sweetener impact than the ${labelSugars}g line alone.`
  }
  return undefined
}

function macroTone(
  key: string,
  value: number,
  goalKey: string,
  targets: NutritionTargets
): 'good' | 'warn' | 'bad' | 'neutral' {
  if (key === 'sugars' && (targets.maxSugarG != null || /less_sugar|low_sugar|blood/i.test(goalKey))) {
    const max = targets.maxSugarG ?? 8
    if (value <= max - 2) return 'good'
    if (value <= max) return 'warn'
    return 'bad'
  }
  if (key === 'protein' && (targets.minProteinG != null || /more_protein|muscle|high_protein/i.test(goalKey))) {
    const min = targets.minProteinG ?? 10
    if (value >= min + 3) return 'good'
    if (value >= min) return 'warn'
    return 'bad'
  }
  if (key === 'sodium' && (targets.maxSodiumMg != null || /lower_sodium/i.test(goalKey))) {
    const max = targets.maxSodiumMg ?? 400
    if (value <= max - 80) return 'good'
    if (value <= max) return 'warn'
    return 'bad'
  }
  if (key === 'sodium' && value >= 480) return 'bad'
  if (key === 'sugars' && value >= 12) return 'bad'
  if (key === 'sugars' && value >= 8) return 'warn'
  return 'neutral'
}

function macroCallout(
  key: string,
  value: number,
  unit: string,
  goalKey: string,
  targets: NutritionTargets,
  dvPercent?: number
): string | undefined {
  const goalLabel = getGoalDisplayLabel(goalKey)
  if (key === 'sugars' && /less_sugar|low_sugar|blood/i.test(goalKey)) {
    if (value >= 10) return `${value}${unit} sugar — high for your ${goalLabel} goal`
    if (value >= 6) return `${value}${unit} sugar — moderate for your ${goalLabel} goal`
  }
  if (key === 'protein' && /more_protein|muscle|high_protein/i.test(goalKey)) {
    if (value < 6) return `${value}${unit} protein — weak for your ${goalLabel} goal`
    if (value >= 10) return `${value}${unit} protein — solid for your ${goalLabel} goal`
  }
  if (key === 'sodium') {
    if (dvPercent != null && dvPercent >= 20) {
      return `${value}${unit} sodium — ${dvPercent}% DV`
    }
    if (/lower_sodium/i.test(goalKey) && value >= 400) {
      return `${value}${unit} sodium — high for your ${goalLabel} goal`
    }
  }
  if (key === 'sodium' && dvPercent != null && dvPercent >= 15) {
    return `${value}${unit} sodium — ${dvPercent}% DV`
  }
  if (targets.maxSugarG != null && key === 'sugars' && value > targets.maxSugarG) {
    return `Over your ${targets.maxSugarG}g sugar target`
  }
  if (targets.minProteinG != null && key === 'protein' && value < targets.minProteinG) {
    return `Below your ${targets.minProteinG}g protein target`
  }
  if (targets.maxSodiumMg != null && key === 'sodium' && value > targets.maxSodiumMg) {
    return `Over your ${targets.maxSodiumMg}mg sodium target`
  }
  return undefined
}

function buildMacroRows(facts: NutritionFacts, goalKey: string, targets: NutritionTargets): NutritionMacroRow[] {
  const rows: NutritionMacroRow[] = []
  const push = (
    key: string,
    label: string,
    value: number | undefined,
    unit: string,
    dvKey?: keyof typeof DV
  ) => {
    if (value == null || value <= 0) return
    const dvPercent = dvKey ? pctDv(value, DV[dvKey]) : undefined
    const tone = macroTone(key, value, goalKey, targets)
    const callout = macroCallout(key, value, unit, goalKey, targets, dvPercent)
    rows.push({
      key,
      label,
      value,
      unit,
      display: unit === 'mg' ? `${Math.round(value)}${unit}` : `${value}${unit}`,
      dvPercent,
      barPercent: dvKey ? barFromDv(dvPercent ?? 0) : Math.min(100, value * 4),
      tone,
      callout,
    })
  }

  push('calories', 'Calories', facts.calories, '', 'calories')
  push('protein', 'Protein', facts.proteinG, 'g', 'proteinG')
  push('carbs', 'Carbs', facts.carbsG, 'g', 'carbsG')
  push('fat', 'Fat', facts.fatG, 'g', 'fatG')
  push('sugars', 'Sugar', facts.sugarsG, 'g', 'sugarsG')
  push('sodium', 'Sodium', facts.sodiumMg, 'mg', 'sodiumMg')

  return rows
}

function buildTargetVerdict(
  facts: NutritionFacts,
  targets: NutritionTargets
): NutritionTargetVerdict | undefined {
  const issues: string[] = []
  if (targets.maxSugarG != null && facts.sugarsG != null && facts.sugarsG > targets.maxSugarG) {
    issues.push(`Over on sugar (${facts.sugarsG}g vs ${targets.maxSugarG}g target)`)
  }
  if (targets.minProteinG != null && facts.proteinG != null && facts.proteinG < targets.minProteinG) {
    issues.push(`Low protein (${facts.proteinG}g vs ${targets.minProteinG}g target)`)
  }
  if (targets.maxSodiumMg != null && facts.sodiumMg != null && facts.sodiumMg > targets.maxSodiumMg) {
    issues.push(`Over on sodium (${facts.sodiumMg}mg vs ${targets.maxSodiumMg}mg target)`)
  }

  if (issues.length === 0) {
    const anyTarget = targets.maxSugarG != null || targets.minProteinG != null || targets.maxSodiumMg != null
    if (!anyTarget) return undefined
    return { status: 'pass', headline: 'Meets your nutrition targets', issues: [] }
  }

  return {
    status: issues.length >= 2 ? 'fail' : 'warn',
    headline: issues.length >= 2 ? 'Misses multiple targets' : 'One target missed',
    issues,
  }
}

export function buildNutritionViewModel(args: {
  scan: ScanResult
  scoringData?: FillrScoringInput | null
  goalKey?: string
  nutritionTargets?: NutritionTargets | null
  productAnalysis?: ProductAnalysis | null
}): NutritionViewModel {
  const { scan, scoringData, goalKey = '', productAnalysis } = args
  const targets = mergedNutritionTargets(goalKey, args.nutritionTargets)
  const facts = extractNutritionFacts(scan)
  const hasData = nutritionFactsHasData(facts)

  const input = scoringInputFromScan(scan, scoringData)
  const ingredientQuality = computeIngredientQualityScore(input)
  const nutritionFit = computeNutritionFitScore(input, {
    goalKey,
    maxSugarG: targets.maxSugarG,
    minProteinG: targets.minProteinG,
    maxSodiumMg: targets.maxSodiumMg,
  })

  const ingredientVerdict = scoreToShortVerdict(ingredientQuality)
  const nutritionVerdict = scoreToShortVerdict(nutritionFit || ingredientQuality)

  const ingredientNames = scan.ingredientBreakdown.map((i) => i.name)
  const patterns = detectProductPatterns(ingredientNames, scan.product.nutritionJson)
  const sodiumSources = detectSodiumSources(ingredientNames)

  const intelligence: NutritionIntelligenceBlock = {
    sweetenerStack: buildSweetenerStackText(patterns.sugarSources, ingredientNames, productAnalysis),
    sodiumSources,
    hiddenSugarNote: buildHiddenSugarNote(facts, patterns.sugarSources, scoringData?.sugarScore),
  }

  const macros = buildMacroRows(facts, goalKey, targets)
  const callouts = macros.map((m) => m.callout).filter(Boolean) as string[]

  const categoryContext = buildCategoryNutritionInsight(
    (scoringData?.productCategory ?? input.productCategory) as ProductCategory | undefined,
    {
      sugarsG: facts.sugarsG,
      sodiumMg: facts.sodiumMg,
      calories: facts.calories,
      proteinG: facts.proteinG,
    }
  )

  return {
    hasData,
    servingLabel: facts.servingSize ? `Per ${facts.servingSize}` : 'Per serving',
    macros,
    callouts,
    intelligence,
    categoryContext: categoryContext ?? undefined,
    targetVerdict: buildTargetVerdict(facts, targets),
    lensScores: {
      ingredientQuality,
      nutritionFit: nutritionFit || 0,
      ingredientLabel: ingredientVerdict.label,
      nutritionLabel: nutritionFit > 0 ? nutritionVerdict.label : 'No data',
    },
  }
}

/** Tags for history filtering. */
export function nutritionScanTags(scan: ScanResult): {
  highSugar: boolean
  highSodium: boolean
  goodProtein: boolean
} {
  const facts = extractNutritionFacts(scan)
  const sugars = facts.sugarsG ?? 0
  const sodium = facts.sodiumMg ?? 0
  const protein = facts.proteinG ?? 0
  return {
    highSugar: sugars >= 10,
    highSodium: sodium >= 400,
    goodProtein: protein >= 10,
  }
}

export function countScansOverSugarTarget(scans: ScanResult[], maxSugarG: number): number {
  return scans.filter((s) => (extractNutritionFacts(s).sugarsG ?? 0) > maxSugarG).length
}
