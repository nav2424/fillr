import type { ProductAnalysis } from '../types'
import type { IngredientAnalysisItem } from '../services/openaiIngredientAnalysisPrompt'
import type { ProductPatternDetection } from './productPatternDetection'
import type { ProductCategory } from './fillrScoring'

type NutritionLike = Record<string, unknown> | null | undefined

function countRatings(items: IngredientAnalysisItem[]) {
  const out = { clean: 0, okay: 0, concerning: 0, avoid: 0 }
  for (const it of items) {
    const r = String(it.rating ?? '').toLowerCase()
    if (r === 'clean' || r === 'okay' || r === 'concerning' || r === 'avoid') out[r]++
  }
  return out
}

function sugarFromNutrition(nutrition: NutritionLike): number | null {
  if (!nutrition) return null
  const v = nutrition['sugars_100g']
  return typeof v === 'number' ? v : null
}

function hasAnyName(items: IngredientAnalysisItem[], re: RegExp): boolean {
  return items.some((it) => re.test(String(it.name ?? '').toLowerCase()))
}

function clampSentence(s: string): string {
  const t = s.trim()
  if (!t) return ''
  return /[.!?]$/.test(t) ? t : `${t}.`
}

export function composeDeterministicProductSummary(
  ingredients: IngredientAnalysisItem[],
  patterns: ProductPatternDetection,
  nutrition?: NutritionLike,
  existing?: ProductAnalysis,
  productCategory?: ProductCategory
): ProductAnalysis {
  const categoryLabel =
    productCategory === 'dairy'
      ? 'dairy product'
      : productCategory === 'condiment'
        ? 'condiment'
        : productCategory === 'drink'
          ? 'beverage'
          : 'product'
  const counts = countRatings(ingredients)
  const riskCount = counts.concerning + counts.avoid
  const hasRisk = riskCount > 0
  const mostlyWholeFoods =
    counts.clean >= Math.max(1, Math.floor(ingredients.length * 0.6)) && counts.okay <= Math.max(2, Math.floor(ingredients.length * 0.25))
  const sugar100g = sugarFromNutrition(nutrition)
  const hasRefinedCarbBase = hasAnyName(
    ingredients,
    /\b(enriched|refined)\s+flour\b|\bwheat flour\b|\bwhite flour\b|\brice flour\b|\bcorn flour\b|\bstarch\b/
  )
  const hasArtificialAdditives = hasAnyName(
    ingredients,
    /\bartificial (flavo[u]?r|color|colour)\b|\bred 40\b|\byellow 5\b|\byellow 6\b|\bblue 1\b|\bblue 2\b|\btitanium dioxide\b/
  )
  const isFunctionalLayer = patterns.hasProteinIsolates || patterns.hasFiberAdditives
  const isEngineeredTexture = patterns.hasEmulsifiers || patterns.hasModifiedOils
  const sugarStackedStrong = patterns.sugarCount >= 3 || (patterns.hasStackedSugars && (sugar100g ?? 0) >= 12)
  const candyLike =
    productCategory !== 'dairy' &&
    sugarStackedStrong &&
    (hasRefinedCarbBase || hasArtificialAdditives || riskCount >= 2)
  const cleanWholeFood =
    mostlyWholeFoods && !patterns.hasStackedSugars && !isEngineeredTexture && !isFunctionalLayer && riskCount === 0

  let viralHook = 'This is a mixed formula that combines recognizable ingredients with processing systems for convenience.'
  let bottomLine =
    'You are getting a blend of whole-food signals and industrial helpers for texture, shelf life, or sweetness.'

  if (cleanWholeFood) {
    viralHook = 'This is a simple whole-food product with minimal processing.'
    bottomLine =
      'The ingredient list is short and recognizable, without the usual emulsifier or additive systems. What you see is mostly what you are eating.'
  } else if (candyLike) {
    viralHook = 'This is a stacked sugar system with engineered fats and additives designed for taste, not nutrition.'
    bottomLine =
      'This formula combines multiple sugars with refined bases and processing helpers to optimize flavor and texture. It is built for easy repeat eating more than satiety.'
  } else if (isFunctionalLayer && (patterns.hasStackedSugars || isEngineeredTexture)) {
    viralHook =
      `This is a functional ${categoryLabel} built on a mix of real ingredients and processed add-ons.`
    bottomLine =
      'This product adds protein and fiber, but still uses processing systems for texture and stability. It is better than candy, but still not a whole-food staple.'
  } else if (isEngineeredTexture && hasRefinedCarbBase) {
    viralHook = `This is a texture-engineered ${categoryLabel} built from refined carbs and industrial oils.`
    bottomLine =
      'Refined starch bases plus oil/emulsifier systems are doing most of the work for crunch and shelf life. This is engineered for taste consistency, not lasting fullness.'
  } else if (patterns.hasStackedSugars || (sugar100g != null && sugar100g >= 18)) {
    viralHook = `This ${categoryLabel} looks healthier than candy, but the sweetness system is still doing heavy lifting.`
    bottomLine =
      `Even with some better ingredients, sugars/syrups are still prominent in the build. It is better framed as a sweet ${categoryLabel} than a clean staple.`
  }

  if (patterns.hasStackedSugars && !/stacked sugar/i.test(viralHook)) {
    bottomLine = `${bottomLine} This includes a stacked sugar system rather than a single sweetener source.`
  }
  if (isEngineeredTexture && !/texture|shelf/i.test(bottomLine)) {
    bottomLine = `${bottomLine} Emulsifier/oil choices point to texture and shelf-life engineering.`
  }
  if (isFunctionalLayer && !/functional/i.test(bottomLine)) {
    bottomLine = `${bottomLine} Added protein/fiber creates a functional nutrition layer on top.`
  }

  const ingredientOrderInsight = patterns.hasStackedSugars
    ? 'Multiple sugar-like ingredients can split labels while still producing a high overall sweetener load.'
    : 'Ingredient order still matters: earlier lines usually indicate higher weight in the final formula.'

  return {
    ...(existing ?? {}),
    sugarSources: patterns.sugarSources,
    viralHook: clampSentence(viralHook),
    bottomLine: clampSentence(bottomLine),
    ingredientOrderInsight: clampSentence(ingredientOrderInsight),
    ratingCounts: counts,
    ...(existing?.labelVsReality ? { labelVsReality: existing.labelVsReality } : {}),
    ...(existing?.redFlags ? { redFlags: existing.redFlags } : {}),
    ...(existing?.whoShouldAvoid ? { whoShouldAvoid: existing.whoShouldAvoid } : {}),
    ...(existing?.whatTheyDontTellYou ? { whatTheyDontTellYou: existing.whatTheyDontTellYou } : {}),
    ...(existing?.hiddenIngredients ? { hiddenIngredients: existing.hiddenIngredients } : {}),
    ...(existing?.regulatoryFlags ? { regulatoryFlags: existing.regulatoryFlags } : {}),
    ...(existing?.labelClaims ? { labelClaims: existing.labelClaims } : {}),
    // surfaced for caller convenience if needed
    ...(existing ? {} : {}),
  } satisfies ProductAnalysis
}

export function composeDeterministicProductVerdict(
  ingredients: IngredientAnalysisItem[],
  patterns: ProductPatternDetection,
  nutrition?: NutritionLike,
  productCategory?: ProductCategory
): string {
  const categoryLabel =
    productCategory === 'dairy'
      ? 'dairy product'
      : productCategory === 'condiment'
        ? 'condiment'
        : productCategory === 'drink'
          ? 'beverage'
          : 'product'
  const counts = countRatings(ingredients)
  const riskCount = counts.concerning + counts.avoid
  const sugar100g = sugarFromNutrition(nutrition)
  const hasRefinedCarbBase = hasAnyName(
    ingredients,
    /\b(enriched|refined)\s+flour\b|\bwheat flour\b|\bwhite flour\b|\brice flour\b|\bcorn flour\b|\bstarch\b/
  )
  const hasArtificialAdditives = hasAnyName(
    ingredients,
    /\bartificial (flavo[u]?r|color|colour)\b|\bred 40\b|\byellow 5\b|\byellow 6\b|\bblue 1\b|\bblue 2\b|\btitanium dioxide\b/
  )
  const cleanWholeFood =
    counts.clean >= Math.max(1, Math.floor(ingredients.length * 0.6)) &&
    riskCount === 0 &&
    !patterns.hasStackedSugars &&
    !patterns.hasEmulsifiers &&
    !patterns.hasModifiedOils &&
    !patterns.hasProteinIsolates &&
    !patterns.hasFiberAdditives

  if (cleanWholeFood) {
    return 'A genuinely clean option — aligned with whole-food eating and easy to trust.'
  }
  if ((patterns.sugarCount >= 3 && (hasRefinedCarbBase || hasArtificialAdditives)) || riskCount >= 3) {
    if (productCategory === 'dairy') {
      return 'A shelf-stable dairy-style formula — stabilizers and emulsifiers support texture and consistency; fine as an occasional add-in, not a whole-food staple.'
    }
    return 'This is an ultra-processed treat — fine occasionally, but not something to rely on for energy or satiety.'
  }
  if ((patterns.hasProteinIsolates || patterns.hasFiberAdditives) && (patterns.hasStackedSugars || riskCount > 0)) {
    return `A middle-ground ${categoryLabel} — better than candy, but still a processed product, not a whole-food staple.`
  }
  if (patterns.hasEmulsifiers || patterns.hasModifiedOils || riskCount > 0 || (sugar100g != null && sugar100g >= 18)) {
    return `A classic processed ${categoryLabel} — enjoyable occasionally, but not a daily staple for long-term health.`
  }
  return 'A mixed convenience product — reasonable in rotation, but still better treated as occasional than foundational.'
}

