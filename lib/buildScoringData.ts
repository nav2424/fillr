/**
 * Builds deterministic scoring input from a ScanResult + profile.
 */

import type { DietaryProfile, IngredientExplanation, IngredientRating, ScanResult } from '../types'
import { runCeliacCheck, getCeliacSeverity } from './allergenEngine/matcher'
import type { FillrScoringInput } from './fillrScoring'
import { buildProfileMatches } from './buildProfileMatches'

function ratingOf(i: IngredientExplanation): IngredientRating {
  return (i.ingredientRating ?? 'okay') as IngredientRating
}

function normName(name: string): string {
  return String(name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[#'"().]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const ARTIFICIAL_SWEETENER_RE =
  /\b(sucralose|aspartame|acesulfame(?:\s+potassium)?|acesulfame k|saccharin|neotame|advantame|splenda|sodium cyclamate|cyclamate)\b/i

const SUGAR_SIGNAL_RE =
  /\b(sugar|sucrose|fructose|dextrose|glucose|maltose|lactose|honey|molasses|agave|corn syrup|hfcs|high[\s-]*fructose|malt syrup|brown rice syrup|evaporated cane|invert sugar|maltodextrin)\b/i

const SEED_OIL_RE =
  /\b(canola oil|rapeseed oil|soybean oil|corn oil|cottonseed oil|sunflower oil|safflower oil|grapeseed oil|vegetable oil|palm oil|palm kernel oil)\b/i

const EMULSIFIER_RE =
  /\b(carrageenan|polysorbate|mono[\s-]?and[\s-]?diglycerides|diglyceride|monoglyceride|xanthan gum|guar gum|carboxymethylcellulose|cellulose gum|soy lecithin|sunflower lecithin|\blecithin\b)\b/i

const PRO_INFLAMMATORY_RE =
  /\b(high fructose corn syrup|\bhfcs\b|partially hydrogenated|hydrogenated oil|carrageenan|tbhq|bht|bha|sodium nitrite|sodium nitrate|artificial color|artificial colour|red\s*40|yellow\s*5|yellow\s*6|soybean oil|corn oil|sunflower oil|canola oil)\b/i

/** Well-known confection brands / product lines (name often omits "chocolate bar"). */
const CANDY_BRAND_OR_PRODUCT_RE =
  /\b(kit\s*kat|snickers|twix|m\s*&\s*m'?s?|m\s+and\s+m|reeses?|hershey'?s?|skittles|starburst|milky\s+way|butterfinger|junior\s+mints|nerds|jolly\s+rancher|airheads|sour\s+patch|warheads|smarties|maltesers|bounty|mars\s+bar|3\s*musketeers|payday|almond\s+joy|mounds|rolos|whoppers|heath\s+bar|crunch\s+bar|100\s+grand|take\s*5|baby\s+ruth|toblerone|ferrero|lindt|ghirardelli|godiva|cadbury|haribo|sour\s+strips|peeps|jelly\s+beans?|jellybean)\b/i

const CONFECTION_LABEL_RE =
  /\b(candy|chocolate bar|chocolatier|confectionery|confectioner'?s?\s+glaze|gummy|gummies|caramel|lollipop|sour candy|hard candy|fudge|toffee|nougat|praline|bonbon|truffle|marshmallow treat|wafer bar)\b/i

const CHOCOLATE_PRODUCT_RE =
  /\b(milk chocolate|dark chocolate|white chocolate|chocolate coating|chocolate flavou?r(?:ing)?)\b/i

const CHOCOLATE_FORM_RE =
  /\bchocolate\b.*\b(bar|wafer|finger|bites?|minis?|pieces|drops|truffles?)\b|\b(bar|wafer|finger|bites?|minis?|pieces|drops|truffles?)\b.*\bchocolate\b/i

function looksLikeSugarFirstConfection(normalizedNames: string[], hay: string): boolean {
  if (normalizedNames.length < 2 || normalizedNames.length > 15) return false
  if (/\b(protein bar|protein brownie|protein cookie|whey protein|pea protein|protein isolate|protein concentrate)\b/.test(hay)) {
    return false
  }
  const first = normalizedNames[0] ?? ''
  const sugarFirst = /^(sugar|sucrose|glucose|fructose|dextrose|invert sugar|brown sugar|icing sugar)/.test(first)
  if (!sugarFirst) return false
  return normalizedNames.some((n) =>
    /\b(cocoa mass|cocoa butter|chocolate|wafer|fudge|toffee|caramel|confectioner|nougat|praline|ganache|glucose syrup|invert sugar)\b/.test(n)
  )
}

function isCandyCategory(hay: string, normalizedNames: string[]): boolean {
  return (
    CONFECTION_LABEL_RE.test(hay) ||
    CANDY_BRAND_OR_PRODUCT_RE.test(hay) ||
    CHOCOLATE_PRODUCT_RE.test(hay) ||
    CHOCOLATE_FORM_RE.test(hay) ||
    looksLikeSugarFirstConfection(normalizedNames, hay)
  )
}

export function detectProductCategoryFromSignals(
  sourceText: string,
  normalizedNames: string[]
): FillrScoringInput['productCategory'] {
  const hay = `${sourceText} ${normalizedNames.join(' ')}`
    .toLowerCase()
    .trim()
  if (/\b(chewing\s+gum|gum base|bubble\s+gum|pur gum)\b/.test(hay)) return 'gum'
  if (/\b(protein bar|protein brownie|protein cookie|whey protein|pea protein|protein isolate|protein concentrate)\b/.test(hay)) {
    return 'protein_bar'
  }
  // Candy before dairy — chocolate bars often list milk fat / milk solids as ingredients.
  if (isCandyCategory(hay, normalizedNames)) return 'candy'
  if (
    /\b(cream|coffee cream|creamer|creamers|half[\s-]and[\s-]half|table cream|coffee whitener|whitener|whole milk|skim milk|yogurt|yoghurt|kefir|fromage|lait|creme|cr[eè]me fraiche)\b/.test(
      hay
    ) ||
    /\b(?<!milk\s)(?<!non-)\bmilk\b(?! fat)(?! solids)(?! powder)\b/.test(hay)
  ) {
    return 'dairy'
  }
  if (/\b(soda|soft drink|energy drink|sports drink|juice drink|sparkling water|beverage)\b/.test(hay)) return 'drink'
  if (/\b(ketchup|mustard|mayonnaise|mayo|dressing|sauce|dip|spread|salsa|condiment)\b/.test(hay)) return 'condiment'
  if (
    normalizedNames.length > 0 &&
    normalizedNames.length <= 3 &&
    normalizedNames.every((n) => !INDUSTRIAL_STRONG_NAME.test(n) && !INDUSTRIAL_MEDIUM_NAME.test(n))
  ) {
    return 'whole_food'
  }
  if (
    normalizedNames.length > 0 &&
    normalizedNames.length <= 8 &&
    !normalizedNames.some((n) => INDUSTRIAL_STRONG_NAME.test(n)) &&
    normalizedNames.filter((n) => INDUSTRIAL_MEDIUM_NAME.test(n)).length <= 1
  ) {
    return 'clean_snack'
  }
  return undefined
}

function detectProductCategory(scan: ScanResult, normalizedNames: string[]): FillrScoringInput['productCategory'] {
  const sourceText = `${scan.product.name ?? ''} ${scan.product.ingredientText ?? ''}`
  return detectProductCategoryFromSignals(sourceText, normalizedNames)
}

function estimateCaffeineMgForScoring(scan: ScanResult): number {
  const n = scan.product.nutritionJson
  if (n && typeof n === 'object') {
    const o = n as Record<string, unknown>
    const tryNum = (v: unknown): number => {
      const x = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN
      return Number.isFinite(x) ? x : 0
    }
    for (const k of ['caffeine_serving', 'caffeine', 'caffeine_value']) {
      const v = tryNum(o[k])
      if (v > 0) return v
    }
  }
  const text = `${scan.product.ingredientText || ''} ${scan.product.name || ''}`.toLowerCase()
  if (/\bdecaffeinated\b|\bdecaf\b/.test(text)) return 0
  if (/\bcaffeine\b/.test(text) || /\bguarana\b/.test(text)) {
    return 120
  }
  return 0
}

/**
 * Strong industrial / UPF signals. If the model still has the line as `clean`, we bump the tier
 * for **scoring only** so Fillr Fit + processing slider aren’t fooled (e.g. Doritos-like lists).
 */
const INDUSTRIAL_STRONG_NAME =
  /\b(monosodium\s+glutamate|\bmsg\b|m[o]?altodextrin|modextrin|dextrose\b|disodium\s+inosinate|disodium\s+guanylate|disodium\s+phosphate|artificial\s+(color|colour|flavor|flavour)|natural\s+and\s+artificial|red\s*40|yellow\s*5|yellow\s*6|caramel\s+color|caramel\s+colour|tbhq|bht|bha|polysorbate|calcium\s+silicate|silicon\s+dioxide|sodium\s+nitrite|sodium\s+benzoate|potassium\s+sorbate|sorbic\s+acid|calcium\s+disodium\s+edta|disodium\s+calcium\s+edta|disodium\s+edta|trisodium\s+edta|yeast\s+extract|high[\s-]*fructose|\bhfcs\b|partially\s+hydrogenated)\b/i

const INDUSTRIAL_MEDIUM_NAME =
  /\b(citric\s+acid|lactic\s+acid|lactose\b|corn\s+syrup|glucose\s+syrup|modified\s+(?:corn|potato|tapioca|rice)\s+starch|modified\s+starch\b|xanthan\s+gum|carrageenan|hydrolyzed|hydrolysed|whey\s+protein|lecithin|natural\s+flavor|natural\s+flavour|enzymes?\b|malt\s+extract)\b/i

/**
 * Effective tier for deterministic scores when barcode/AI mis-labels obvious industrial lines as `clean`.
 */
export function effectiveTierForScoringCounts(i: IngredientExplanation): IngredientRating {
  const r = ratingOf(i)
  if (r === 'avoid' || r === 'concerning' || r === 'okay') return r
  const name = normName(i.name)
  if (INDUSTRIAL_STRONG_NAME.test(name)) return 'concerning'
  if (INDUSTRIAL_MEDIUM_NAME.test(name)) return 'okay'
  return 'clean'
}

export function buildScoringData(
  scanResult: ScanResult,
  ingredients: IngredientExplanation[],
  profile: DietaryProfile
): FillrScoringInput {
  const ingredientCounts = { natural: 0, processed: 0, additive: 0, flagged: 0 }
  for (const ing of ingredients) {
    const t = effectiveTierForScoringCounts(ing)
    if (t === 'clean') ingredientCounts.natural++
    else if (t === 'okay') ingredientCounts.processed++
    else if (t === 'concerning') ingredientCounts.additive++
    else ingredientCounts.flagged++
  }

  const totalIngredients = ingredients.length

  const allergyFromScan = scanResult.matchedAllergens.map((m) => m.allergenName).filter(Boolean)

  const allergyMatches = [...new Set([...allergyFromScan])]

  let celiacSeverity: 'SAFE' | 'CAUTION' | 'AVOID' = 'SAFE'
  if (profile.celiacStrictGluten) {
    if (scanResult.celiac?.celiacModeEnabled) {
      celiacSeverity = scanResult.celiac.celiacSeverity
    } else {
      const safety = scanResult.product.ingredientTextSafetyHaystack?.trim()
      const display = scanResult.product.ingredientText ?? ''
      const haystack = safety && safety.length > 0 ? safety : display
      const segments = haystack.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
      const celiacMatches = runCeliacCheck(segments, haystack)
      celiacSeverity = getCeliacSeverity(celiacMatches)
    }
  }

  const sensitivityFromScan = scanResult.matchedSensitivities.map((m) => m.sensitivityName)
  const sensitivityFromIngredientFlags = ingredients
    .filter((ing) => ing.personalFlag === 'sensitivity' || ing.flagDriver === 'sensitivity')
    .map((ing) => ing.name)
    .filter((name): name is string => Boolean(String(name ?? '').trim()))

  const sensitivityMatches = [...new Set([...sensitivityFromScan, ...sensitivityFromIngredientFlags])]

  const normalizedNames = ingredients.map((i) => normName(i.name))
  const productCategory = detectProductCategory(scanResult, normalizedNames)
  const eNumberCount = normalizedNames.filter((n) => /\be\d{3}[a-z]{0,3}\b/i.test(n)).length
  const genericFunctionalTermCount = normalizedNames.filter((n) =>
    /\bstabiliser(s)?\b|\bemulsifier(s)?\b|\bacidity regulator(s)?\b|\banticaking agent\b|\bflavouring(s)?\b|\bflavoring(s)?\b/.test(
      n
    )
  ).length
  const industrialSweetenerCount = normalizedNames.filter((n) =>
    /\bglucose syrup\b|\bglucose fructose syrup\b|\bglucose-fructose syrup\b|\bhigh fructose corn syrup\b|\bhfcs\b|\bcorn syrup\b|\bfructose syrup\b/.test(
      n
    )
  ).length
  const hydrogenatedOilCount = normalizedNames.filter((n) =>
    /\bhydrogenated\b|\bpartially hydrogenated\b/.test(n)
  ).length

  let celiacAmbiguousCount = 0
  for (const ing of ingredients) {
    if (ing.personalFlag !== 'celiac') continue
    if (ratingOf(ing) === 'avoid') continue
    celiacAmbiguousCount++
  }

  const sweetenerCount = normalizedNames.filter((n) => ARTIFICIAL_SWEETENER_RE.test(n)).length
  let sugarScore = industrialSweetenerCount * 5
  for (const n of normalizedNames) {
    if (SUGAR_SIGNAL_RE.test(n)) sugarScore += 3
  }
  const hasSeedOils = normalizedNames.some((n) => SEED_OIL_RE.test(n))
  const emulsifierCount = normalizedNames.filter((n) => EMULSIFIER_RE.test(n)).length
  const proInflammatoryCount = normalizedNames.filter((n) => PRO_INFLAMMATORY_RE.test(n)).length
  const caffeineMg = estimateCaffeineMgForScoring(scanResult)

  const profileHaystack =
    scanResult.product.ingredientTextSafetyHaystack?.trim() ||
    scanResult.product.ingredientText ||
    ''

  const profileMatches = buildProfileMatches(
    {
      ...profile,
      preferences: profile.scoringPreferenceKeys?.length
        ? [...profile.scoringPreferenceKeys]
        : [...(profile.preferences ?? [])],
    },
    ingredients.map((i) => i.name),
    profileHaystack
  )

  return {
    labelHaystack: profileHaystack,
    allergyMatches,
    celiacSeverity,
    celiacStrictGluten: !!profile.celiacStrictGluten,
    celiacAmbiguousCount,
    sensitivityMatches: [
      ...new Set([
        ...profileMatches.sensitivityMatches,
        ...sensitivityMatches,
      ]),
    ],
    avoidingMatches: profileMatches.avoidingMatches,
    goalMatches: profileMatches.goalMatches,
    goalConflicts: profileMatches.goalConflicts,
    goalConflictDetails: profileMatches.goalConflictDetails,
    ingredientCounts,
    totalIngredients,
    eNumberCount,
    genericFunctionalTermCount,
    industrialSweetenerCount,
    hydrogenatedOilCount,
    scoringPreferenceKeys: profile.scoringPreferenceKeys ?? [],
    sweetenerCount,
    sugarScore,
    hasSeedOils,
    emulsifierCount,
    caffeineMg,
    proInflammatoryCount,
    productCategory,
  }
}
