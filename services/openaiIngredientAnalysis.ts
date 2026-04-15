/**
 * OpenAI ingredient analysis + merge with allergen/sensitivity scan data.
 */

import type {
  ScanResult,
  IngredientExplanation,
  IngredientRating,
  MatchedAllergen,
  ProductAnalysis,
  LabelVsRealityItem,
  DietaryProfile,
  HiddenIngredientInsight,
  RegulatoryFlagInsight,
} from '../types'
import {
  INGREDIENT_ANALYSIS_SYSTEM_PROMPT,
  OCR_INGREDIENT_ANALYSIS_PREFIX,
  buildPersonalizationSystemAppend,
  buildIngredientAnalysisUserPrompt,
  buildPartialIngredientAnalysisUserPrompt,
  buildSingleIngredientRepairUserPrompt,
  formatNutritionJsonForPrompt,
  type ProductIngredientAnalysisResponse,
  type IngredientAnalysisItem,
} from './openaiIngredientAnalysisPrompt'
import {
  parseIngredients,
  buildFallbackIngredientExplanation,
  isIngredientCopyBoilerplate,
  prepareIngredientTextForAnalysis,
} from '../lib/fillrAdapter'
import { applyAllergenPersonalizedProductCopy } from '../lib/personalizationEngine'
import { lookupIngredientAmbiguity } from '../lib/ingredientAmbiguity'
import {
  analysisItemToSaveInput,
  getIngredientsFromCacheBatch,
  knowledgeRowToAnalysisItem,
  saveIngredientToCache,
  type CacheBatchResult,
} from '../lib/ingredientKnowledge'
import type { IngredientTextParseSource } from '../lib/ingredientParseSource'

// CommonJS module (lib/ingredientMatcher.js) — Metro + deterministic overrides
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  applyDeterministicRatings,
  recalculateProductSummary,
  applyPersonalizedRatings,
  normalizeForMatch,
} = require('../lib/ingredientMatcher.js') as {
  applyDeterministicRatings: (
    items: IngredientAnalysisItem[],
    fullLabelHaystack?: string
  ) => IngredientAnalysisItem[]
  recalculateProductSummary: (items: IngredientAnalysisItem[]) => {
    clean: number
    okay: number
    concerning: number
    avoid: number
  }
  applyPersonalizedRatings: (items: IngredientAnalysisItem[], profile: DietaryProfile) => IngredientAnalysisItem[]
  normalizeForMatch: (name: string) => string
}

/** Belt-and-suspenders: same priority as ingredientMatcher (avoid → concerning → clean → okay). Uses normalized names (FD&C Yellow #5, etc.). */
const NUCLEAR_FORCE_CONCERNING = [
  'high fructose corn syrup',
  'hfcs',
  'glucose-fructose syrup',
  'glucose fructose syrup',
  'isoglucose',
  'carrageenan',
  'maltodextrin',
  'sodium nitrite',
  'sodium nitrate',
  'bha',
  'bht',
  'xanthan gum',
  'carnauba wax',
  'soy lecithin',
  'sunflower lecithin',
  'polysorbate 60',
  'polysorbate 80',
  'modified corn starch',
  'natural flavor',
  'natural flavour',
  'artificial flavor',
  'artificial flavour',
  'msg',
  'monosodium glutamate',
  'acesulfame',
  'sucralose',
  'aspartame',
  'caramel color',
  'caramel colour',
]

const NUCLEAR_FORCE_AVOID = [
  'yellow 5',
  'tartrazine',
  'yellow 6',
  'red 40',
  'allura red',
  'blue 1',
  'blue 2',
  'red 3',
  'green 3',
  'titanium dioxide',
  'potassium bromate',
  'brominated vegetable oil',
  'bvo',
  'tbhq',
  'propyl gallate',
  'partially hydrogenated',
]

const NUCLEAR_FORCE_CLEAN = [
  'roasted peanuts',
  'peanuts',
  'oats',
  'almonds',
  'water',
  'honey',
  'olive oil',
  'coconut oil',
  'eggs',
  'whole milk',
  'vanilla extract',
  'cocoa',
  'cinnamon',
  'blueberries',
  'banana',
  'quinoa',
]

const NUCLEAR_FORCE_OKAY = [
  'sugar',
  'cane sugar',
  'salt',
  'sea salt',
  'baking soda',
  'citric acid',
  'vinegar',
  'corn starch',
  'vegetable oil',
  'canola oil',
]

const NUCLEAR_REASON =
  'Fillr applies a deterministic safety rule for this ingredient name, overriding the model rating when they disagree.'

function applyNuclearForceRatings(items: IngredientAnalysisItem[]): IngredientAnalysisItem[] {
  return items.map((ingredient) => {
    const n = normalizeForMatch(String(ingredient.name ?? ''))
    if (!n) return ingredient

    if (NUCLEAR_FORCE_AVOID.some((t) => n.includes(t))) {
      if (__DEV__) console.log(`FORCED AVOID: ${ingredient.name}`)
      return {
        ...ingredient,
        rating: 'avoid',
        ratingOverridden: true,
        ratingSource: 'deterministic',
        ratingReason: NUCLEAR_REASON,
      }
    }
    if (NUCLEAR_FORCE_CONCERNING.some((t) => n.includes(t))) {
      if (__DEV__) console.log(`FORCED CONCERNING: ${ingredient.name}`)
      return {
        ...ingredient,
        rating: 'concerning',
        ratingOverridden: true,
        ratingSource: 'deterministic',
        ratingReason: NUCLEAR_REASON,
      }
    }
    if (NUCLEAR_FORCE_CLEAN.some((t) => n.includes(t))) {
      if (__DEV__) console.log(`FORCED CLEAN: ${ingredient.name}`)
      return {
        ...ingredient,
        rating: 'clean',
        ratingOverridden: true,
        ratingSource: 'deterministic',
        ratingReason: NUCLEAR_REASON,
      }
    }
    if (NUCLEAR_FORCE_OKAY.some((t) => n.includes(t))) {
      if (__DEV__) console.log(`FORCED OKAY: ${ingredient.name}`)
      return {
        ...ingredient,
        rating: 'okay',
        ratingOverridden: true,
        ratingSource: 'deterministic',
        ratingReason: NUCLEAR_REASON,
      }
    }
    return ingredient
  })
}

/** Faster default; set EXPO_PUBLIC_OPENAI_INGREDIENT_MODEL=gpt-4o if you need maximum depth. */
const DEFAULT_MODEL = 'gpt-4o-mini'
const TEMPERATURE = 0
const MAX_TOKENS = 3072
const MIN_PROSE_LENGTH = 25
const MAX_REPAIR_ATTEMPTS = 1

const PROSE_FIELDS: (keyof IngredientAnalysisItem)[] = [
  'headline',
  'labelDecoder',
  'whatItIs',
  'whatItDoes',
  'bodyEffect',
  'funFact',
  'whyItMattersYou',
  'ratingReason',
]

const GENERIC_FILLER_PATTERNS: RegExp[] = [
  /once eaten.*handled like other foods/i,
  /specifics depend on what the ingredient/i,
  /common processed-food ingredient/i,
  /supports taste, texture, stability/i,
  /made of the same building blocks/i,
  /may affect some people/i,
  /varies from person to person/i,
  /how this manufacturer lists this component/i,
  /manufacturer lists this component on the ingredient panel/i,
  /its role here depends on the recipe/i,
  /texture, sweetness, shelf life, color, or how the line runs/i,
]

/** Last-resort padding so older model output / failed repair still passes UI gates. */
/** When API repair fails, use local deterministic copy (no extra network round-trip). */
function ingredientExplanationToAnalysisItem(fb: IngredientExplanation): IngredientAnalysisItem {
  const r = fb.ingredientRating ?? 'okay'
  const rating: IngredientAnalysisItem['rating'] =
    r === 'avoid' ? 'avoid' : r === 'concerning' ? 'concerning' : r === 'okay' ? 'okay' : 'clean'
  return {
    name: fb.name,
    headline: fb.headline ?? fb.name,
    labelDecoder: fb.labelDecoder ?? '',
    whatItIs: fb.whatItIs ?? '',
    whatItDoes: fb.whatItDoes ?? fb.whyItsUsed ?? '',
    bodyEffect: fb.bodyEffect ?? '',
    funFact: fb.funFact ?? '',
    whyItMattersYou: fb.whyItMatters ?? fb.whatToKnow ?? '',
    rating,
    ratingReason: fb.ratingReason ?? '',
    contextStat: '',
    ratingSource: 'deterministic',
  }
}

export function padTranslatorFields(item: IngredientAnalysisItem): IngredientAnalysisItem {
  let labelDecoder = String(item.labelDecoder ?? '').trim()
  let whyItMattersYou = String(item.whyItMattersYou ?? '').trim()

  if (proseFieldInvalid(labelDecoder)) {
    const h = String(item.headline ?? '').trim()
    const w = String(item.whatItIs ?? '').trim()
    const firstWhat = w ? w.split('.')[0]?.trim() || w.slice(0, 120) : ''
    labelDecoder =
      h && firstWhat
        ? `${h} ${firstWhat}`.trim()
        : firstWhat || h || `This line on the label names a typical packaged-food ingredient used for taste, texture, or shelf life.`
    if (!endsWithSentencePunctuation(labelDecoder)) labelDecoder = `${labelDecoder.trim()}.`
  }

  if (proseFieldInvalid(whyItMattersYou)) {
    const rr = String(item.ratingReason ?? '').trim()
    const firstR = rr ? rr.split('.')[0]?.trim() || rr.slice(0, 140) : ''
    whyItMattersYou = firstR
      ? `For everyday shopping, the main tradeoff is: ${firstR.endsWith('.') ? firstR.slice(0, -1) : firstR}.`
      : `Use this row to compare similar products and see whether ${item.name} is something you want often or only occasionally.`
    if (!endsWithSentencePunctuation(whyItMattersYou)) whyItMattersYou = `${whyItMattersYou.trim()}.`
  }

  return { ...item, labelDecoder, whyItMattersYou }
}

function termsMatch(ingredientLower: string, termLower: string): boolean {
  if (!ingredientLower || !termLower) return false
  return ingredientLower.includes(termLower) || termLower.includes(ingredientLower)
}

function findPoolIndexForLabelName(
  labelName: string,
  pool: IngredientExplanation[],
  usedPool: Set<number>
): number {
  const nl = normalizeForMatch(labelName)
  if (!nl) return -1
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < pool.length; i++) {
      if (usedPool.has(i)) continue
      const pn = normalizeForMatch(pool[i].name)
      if (!pn) continue
      if (pass === 0) {
        if (pn === nl) return i
      } else if (pn.includes(nl) || nl.includes(pn)) {
        return i
      }
    }
  }
  return -1
}

function findAiIndexForLabelName(
  labelName: string,
  aiItems: IngredientAnalysisItem[],
  usedAi: Set<number>
): number {
  const nl = normalizeForMatch(labelName)
  if (!nl) return -1
  for (let i = 0; i < aiItems.length; i++) {
    if (usedAi.has(i)) continue
    if (normalizeForMatch(aiItems[i].name) === nl) return i
  }
  let best = -1
  let bestLen = -1
  for (let i = 0; i < aiItems.length; i++) {
    if (usedAi.has(i)) continue
    const an = normalizeForMatch(aiItems[i].name)
    if (!an) continue
    if (an.includes(nl) || nl.includes(an)) {
      if (an.length > bestLen) {
        best = i
        bestLen = an.length
      }
    }
  }
  return best
}

function parseSourceFromScan(scanSource: ScanResult['scanSource']): 'barcode' | 'ocr' {
  return scanSource === 'ocr' ? 'ocr' : 'barcode'
}

/** Ensures one breakdown row per label segment; reuses existing rows when names align. */
export function expandBreakdownToFullLabel(
  ingredientText: string,
  current: IngredientExplanation[],
  parseSource: 'barcode' | 'ocr' = 'barcode'
): IngredientExplanation[] {
  const labelNames = parseIngredients(ingredientText, parseSource)
  if (labelNames.length === 0) return current

  const pool = [...current]
  const usedPool = new Set<number>()
  const out: IngredientExplanation[] = []

  for (const labelName of labelNames) {
    const idx = findPoolIndexForLabelName(labelName, pool, usedPool)
    if (idx >= 0) {
      usedPool.add(idx)
      out.push(pool[idx])
    } else {
      out.push(buildFallbackIngredientExplanation(labelName))
    }
  }
  return out
}

function mergeAiBreakdownWithLabel(
  base: ScanResult,
  ai: ProductIngredientAnalysisResponse
): IngredientExplanation[] {
  const labelNames = parseIngredients(base.product.ingredientText)
  const aiItems = ai.ingredients
  if (labelNames.length === 0) {
    return aiItems.map((item) => aiItemToExplanation(item))
  }

  const pool = [...base.ingredientBreakdown]
  const usedPool = new Set<number>()
  const usedAi = new Set<number>()
  const out: IngredientExplanation[] = []

  for (const labelName of labelNames) {
    const aiIdx = findAiIndexForLabelName(labelName, aiItems, usedAi)
    if (aiIdx >= 0) {
      usedAi.add(aiIdx)
      out.push(aiItemToExplanation(aiItems[aiIdx]))
      continue
    }
    const pIdx = findPoolIndexForLabelName(labelName, pool, usedPool)
    if (pIdx >= 0) {
      usedPool.add(pIdx)
      out.push(pool[pIdx])
    } else {
      out.push(buildFallbackIngredientExplanation(labelName))
    }
  }
  return out
}

function mapRatingToVerdict(
  r: IngredientRating
): 'SAFE' | 'NEUTRAL' | 'LIMIT' {
  if (r === 'avoid') return 'LIMIT'
  if (r === 'clean') return 'SAFE'
  return 'NEUTRAL'
}

function normalizeIngredientRating(
  raw: string | undefined
): IngredientRating | null {
  const x = String(raw || '')
    .toLowerCase()
    .trim()
  if (x === 'clean' || x === 'okay' || x === 'concerning' || x === 'avoid') return x
  if (x === 'safe') return 'clean'
  return null
}

/** Swap lazy model / legacy filler prose for deterministic ingredient-specific copy. */
function replaceBoilerplateIngredientProse(ing: IngredientExplanation): IngredientExplanation {
  const blob = `${ing.labelDecoder ?? ''}\n${ing.whatItIs ?? ''}\n${ing.explanation ?? ''}`
  if (!isIngredientCopyBoilerplate(blob)) return ing
  const fb = buildFallbackIngredientExplanation(ing.name)
  return {
    ...ing,
    headline: fb.headline,
    labelDecoder: fb.labelDecoder,
    whatItIs: fb.whatItIs,
    whyItsUsed: fb.whyItsUsed,
    whatItDoes: fb.whatItDoes,
    bodyEffect: fb.bodyEffect,
    whatToKnow: fb.whatToKnow,
    explanation: fb.explanation,
    funFact: fb.funFact,
    quickSummary: fb.quickSummary,
    bullets: fb.bullets,
    whereItComeFrom: fb.whereItComeFrom,
    whyItMatters: fb.whyItMatters,
  }
}

function aiItemToExplanation(item: IngredientAnalysisItem): IngredientExplanation {
  const rating = normalizeIngredientRating(item.rating) ?? 'okay'
  const name = (item.name ?? 'Ingredient').trim()
  const contextStat = (item.contextStat ?? '').trim()
  return {
    name,
    headline: item.headline ?? '',
    labelDecoder: item.labelDecoder ?? '',
    whatItIs: item.whatItIs ?? '',
    whatItDoes: item.whatItDoes ?? '',
    bodyEffect: item.bodyEffect ?? '',
    funFact: item.funFact ?? '',
    ratingReason: item.ratingReason ?? '',
    whyItMatters: item.whyItMattersYou ?? '',
    whyItsUsed: item.whatItDoes ?? '',
    whatToKnow: item.ratingReason ?? '',
    ingredientRating: rating,
    verdict: mapRatingToVerdict(rating),
    quickSummary: item.headline ?? '',
    ...(contextStat ? { contextStat } : {}),
    ...(item.ratingSource ? { ratingSource: item.ratingSource } : {}),
    ...(item.ratingOverridden != null ? { ratingOverridden: item.ratingOverridden } : {}),
    ...(item.personalFlag ? { personalFlag: item.personalFlag } : {}),
    ...(item.personalMessage?.trim() ? { personalMessage: item.personalMessage.trim() } : {}),
    fromCache: item.from_cache === true,
  }
}

export function countRatings(ings: IngredientExplanation[]): {
  clean: number
  okay: number
  concerning: number
  avoid: number
} {
  const o = { clean: 0, okay: 0, concerning: 0, avoid: 0 }
  for (const ing of ings) {
    let r = (ing.ingredientRating ?? 'clean') as string
    if (r === 'safe') r = 'clean'
    if (r in o) o[r as keyof typeof o]++
  }
  return o
}

const SEVERITY: Record<IngredientRating, number> = {
  avoid: 0,
  concerning: 1,
  okay: 2,
  clean: 3,
}

function normRating(r: string | undefined): IngredientRating {
  const x = (r ?? 'clean') as string
  if (x === 'safe') return 'clean'
  if (x === 'clean' || x === 'okay' || x === 'concerning' || x === 'avoid') return x
  return 'clean'
}

export function sortIngredientsBySeverity(
  ings: IngredientExplanation[]
): IngredientExplanation[] {
  return [...ings].sort((a, b) => {
    const ra = normRating(a.ingredientRating)
    const rb = normRating(b.ingredientRating)
    return SEVERITY[ra] - SEVERITY[rb]
  })
}

export function buildLocalProductVerdict(
  ingredients: IngredientExplanation[],
  productName: string,
  matchedAllergens: MatchedAllergen[]
): string {
  if (matchedAllergens.length > 0) {
    const names = [
      ...new Map(matchedAllergens.map((m) => [m.allergenKey.toLowerCase(), m.allergenName])).values(),
    ]
    return `This product is not safe for you — it contains ${names.join(' and ')} from your allergy list.`
  }
  const c = countRatings(ingredients)
  if (c.avoid > 0) {
    return `Worth a careful look — ${c.avoid} ingredient${c.avoid === 1 ? '' : 's'} rated avoid, listed first below.`
  }
  if (c.concerning > 0) {
    return `Mostly manageable, but ${c.concerning} ingredient${c.concerning === 1 ? '' : 's'} deserve a second read.`
  }
  return `Typical packaged formulation — scan the order below; earlier lines usually mean more of that ingredient by weight.`
}

/** Strip fences, trim, then keep only the outermost JSON object or array substring. */
function normalizeProductAnalysis(raw: unknown): ProductAnalysis | undefined {
  if (raw == null || typeof raw !== 'object') return undefined
  const p = raw as Record<string, unknown>
  const out: ProductAnalysis = {}
  if (typeof p.viralHook === 'string' && p.viralHook.trim()) {
    out.viralHook = p.viralHook.trim()
  }
  if (Array.isArray(p.labelVsReality)) {
    const items: LabelVsRealityItem[] = []
    for (const item of p.labelVsReality) {
      if (!item || typeof item !== 'object') continue
      const x = item as Record<string, unknown>
      const claim = String(x.claim ?? '').trim()
      const reality = String(x.reality ?? '').trim()
      if (!claim && !reality) continue
      const ex = x.example
      const row: LabelVsRealityItem = { claim, reality }
      if (typeof ex === 'string' && ex.trim()) row.example = ex.trim()
      items.push(row)
    }
    if (items.length) out.labelVsReality = items
  }
  if (Array.isArray(p.redFlags)) {
    const flags = p.redFlags.map((s) => String(s ?? '').trim()).filter(Boolean)
    if (flags.length) out.redFlags = flags
  }
  if (typeof p.whatTheyDontTellYou === 'string' && p.whatTheyDontTellYou.trim()) {
    out.whatTheyDontTellYou = p.whatTheyDontTellYou.trim()
  }
  if (typeof p.whoShouldAvoid === 'string' && p.whoShouldAvoid.trim()) {
    out.whoShouldAvoid = p.whoShouldAvoid.trim()
  }
  if (typeof p.bottomLine === 'string' && p.bottomLine.trim()) {
    out.bottomLine = p.bottomLine.trim()
  }
  if (Array.isArray(p.sugarSources)) {
    const sugarSources = p.sugarSources.map((s) => String(s ?? '').trim()).filter(Boolean)
    if (sugarSources.length) out.sugarSources = sugarSources
  }
  if (Array.isArray(p.hiddenIngredients)) {
    const hi: HiddenIngredientInsight[] = []
    for (const item of p.hiddenIngredients) {
      if (!item || typeof item !== 'object') continue
      const x = item as Record<string, unknown>
      const name = String(x.name ?? '').trim()
      const whatItReallyIs = String(x.whatItReallyIs ?? '').trim()
      if (!name && !whatItReallyIs) continue
      hi.push({ name: name || 'Ingredient', whatItReallyIs: whatItReallyIs || 'See label context.' })
    }
    if (hi.length) out.hiddenIngredients = hi
  }
  if (Array.isArray(p.regulatoryFlags)) {
    const rf: RegulatoryFlagInsight[] = []
    for (const item of p.regulatoryFlags) {
      if (!item || typeof item !== 'object') continue
      const x = item as Record<string, unknown>
      const ingredient = String(x.ingredient ?? '').trim()
      const issue = String(x.issue ?? '').trim()
      const regions = String(x.regions ?? '').trim()
      if (!ingredient || !issue) continue
      rf.push({ ingredient, issue, regions })
    }
    if (rf.length) out.regulatoryFlags = rf
  }
  if (Array.isArray(p.labelClaims)) {
    const lc = p.labelClaims.map((s) => String(s ?? '').trim()).filter(Boolean)
    if (lc.length) out.labelClaims = lc
  }
  if (typeof p.ingredientOrderInsight === 'string' && p.ingredientOrderInsight.trim()) {
    out.ingredientOrderInsight = p.ingredientOrderInsight.trim()
  }
  return Object.keys(out).length ? out : undefined
}

function extractJsonPayload(raw: string): string {
  let s = raw.trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  const firstBrace = s.indexOf('{')
  const lastBrace = s.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return s.slice(firstBrace, lastBrace + 1)
  }
  const firstBracket = s.indexOf('[')
  const lastBracket = s.lastIndexOf(']')
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    return s.slice(firstBracket, lastBracket + 1)
  }
  return s.trim()
}

/**
 * Parses model JSON only. Deterministic rating overrides run afterward in
 * `applyDeterministicPipeline` (see `analyzeIngredientsWithOpenAI`) so repairs
 * use the full `ingredients` array first. The response key must be `ingredients`.
 */
function parseIngredientAnalysisJson(text: string): ProductIngredientAnalysisResponse | null {
  try {
    const payload = extractJsonPayload(text)
    const o = JSON.parse(payload) as ProductIngredientAnalysisResponse
    if (typeof o.productVerdict !== 'string' || !Array.isArray(o.ingredients)) return null
    const normalized = normalizeProductAnalysis(o.productAnalysis)
    if (normalized) o.productAnalysis = normalized
    else delete o.productAnalysis
    return o
  } catch (e) {
    console.warn('[Fillr] ingredient analysis JSON parse failed:', e)
    return null
  }
}

function endsWithSentencePunctuation(s: string): boolean {
  return /[.!?]\s*$/.test(s.trim())
}

function proseFieldInvalid(s: string | undefined): boolean {
  const t = (s ?? '').trim()
  if (t.length < MIN_PROSE_LENGTH) return true
  if (!endsWithSentencePunctuation(t)) return true
  return false
}

function containsGenericFiller(s: string | undefined): boolean {
  const t = s ?? ''
  return GENERIC_FILLER_PATTERNS.some((re) => re.test(t))
}

function ingredientInvalidReasons(item: IngredientAnalysisItem): string[] {
  const reasons: string[] = []
  if (!(item.name ?? '').trim()) reasons.push('empty name')
  if (normalizeIngredientRating(item.rating) == null) reasons.push('bad rating')
  for (const key of PROSE_FIELDS) {
    const v = item[key] as string
    if (proseFieldInvalid(v)) {
      reasons.push(`${String(key)}: length/punctuation`)
    } else if (containsGenericFiller(v)) {
      reasons.push(`${String(key)}: generic filler`)
    }
  }
  return reasons
}

function ingredientParseLooksInvalid(item: IngredientAnalysisItem): boolean {
  return ingredientInvalidReasons(item).length > 0
}

function productVerdictInvalid(v: string | undefined): boolean {
  return proseFieldInvalid(v)
}

function resolveModel(): string {
  return (
    process.env.EXPO_PUBLIC_OPENAI_INGREDIENT_MODEL ??
    process.env.EXPO_PUBLIC_OPENAI_MODEL ??
    DEFAULT_MODEL
  )
}

/**
 * Runs after each successful JSON parse. Mutates `parsed` in place.
 * Pass full label text so substring rules align with the real product string.
 */
function applyDeterministicPipeline(
  parsed: ProductIngredientAnalysisResponse,
  ingredientsListForMatcher: string,
  dietaryProfile: DietaryProfile
): void {
  const raw = parsed.ingredients
  if (!Array.isArray(raw)) return

  // Order: matcher module → nuclear inline (guarantees ratings if Metro/import quirks) → personalization
  let corrected = applyDeterministicRatings(raw, ingredientsListForMatcher) as IngredientAnalysisItem[]
  corrected = applyNuclearForceRatings(corrected)
  corrected = applyPersonalizedRatings(corrected, dietaryProfile) as IngredientAnalysisItem[]
  parsed.ingredients = corrected.map(padTranslatorFields)

  const counts = recalculateProductSummary(corrected)
  if (!parsed.productAnalysis) parsed.productAnalysis = {} as ProductAnalysis
  parsed.productAnalysis.ratingCounts = counts
  // Fillr Fit (`calculateFillrFit`) attaches after merge + `applyPresentationDefaults` in `finalizeScanForPresentation`.

  const overridden = corrected.filter((i) => i.ratingOverridden)
  const personalAllergies = corrected.filter((i) => i.personalFlag === 'allergy')
  if (overridden.length > 0 || personalAllergies.length > 0) {
    const avoidList = corrected.filter((i) => i.rating === 'avoid').map((i) => i.name)
    const concerningList = corrected.filter((i) => i.rating === 'concerning').map((i) => i.name)
    if (avoidList.length > 0) {
      parsed.productAnalysis.viralHook =
        `Contains ${avoidList.join(', ')} — flagged as ingredients to avoid by Fillr.`
    } else if (concerningList.length > 0) {
      parsed.productAnalysis.viralHook = `Contains ${concerningList.length} concerning ingredient${
        concerningList.length > 1 ? 's' : ''
      }: ${concerningList.slice(0, 2).join(', ')}.`
    }
  }
}

type IngredientAnalysisRequestOpts = {
  timeoutMs?: number
  maxTokens?: number
}

async function requestIngredientAnalysisJson(
  userContent: string,
  systemContent: string,
  requestOpts?: IngredientAnalysisRequestOpts
): Promise<ProductIngredientAnalysisResponse | null> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim()
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!supabaseUrl || !supabaseAnonKey) return null

  const timeoutMs = requestOpts?.timeoutMs ?? 55_000
  const maxTokens = requestOpts?.maxTokens ?? MAX_TOKENS
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/ingredient-analysis`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseAnonKey}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({
        model: resolveModel(),
        temperature: TEMPERATURE,
        maxTokens,
        systemContent,
        userContent,
      }),
    })

    if (!res.ok) return null
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const text = data?.choices?.[0]?.message?.content
    if (!text || typeof text !== 'string') return null
    return parseIngredientAnalysisJson(text)
  } catch (e) {
    const name = e && typeof e === 'object' && 'name' in e ? String((e as Error).name) : ''
    if (name === 'AbortError') return null
    return null
  } finally {
    clearTimeout(t)
  }
}

async function repairOneIngredient(
  ingredientName: string,
  fullIngredientsList: string,
  systemContent: string
): Promise<IngredientAnalysisItem | null> {
  const userContent = buildSingleIngredientRepairUserPrompt(ingredientName, fullIngredientsList)
  const parsed = await requestIngredientAnalysisJson(userContent, systemContent, {
    timeoutMs: 24_000,
    maxTokens: 900,
  })
  const first = parsed?.ingredients?.[0]
  if (!first) return null
  return first
}

async function validateAndRepairIngredients(
  parsed: ProductIngredientAnalysisResponse,
  ingredientsList: string,
  systemContent: string
): Promise<ProductIngredientAnalysisResponse> {
  const ingredients = [...parsed.ingredients]
  for (let i = 0; i < ingredients.length; i++) {
    if (!ingredientParseLooksInvalid(ingredients[i])) continue
    const targetName = (ingredients[i].name ?? '').trim() || `ingredient_${i}`
    const reasons = ingredientInvalidReasons(ingredients[i])
    console.warn(
      `[Fillr] Ingredient "${targetName}" failed validation (${reasons.join(', ')}); re-fetching`
    )
    let best = ingredients[i]
    for (let a = 0; a < MAX_REPAIR_ATTEMPTS; a++) {
      const repaired = await repairOneIngredient(targetName, ingredientsList, systemContent)
      if (!repaired) break
      best = repaired
      if (!ingredientParseLooksInvalid(repaired)) break
    }
    if (!ingredientParseLooksInvalid(best)) {
      ingredients[i] = best
    } else {
      ingredients[i] = padTranslatorFields(
        ingredientExplanationToAnalysisItem(buildFallbackIngredientExplanation(targetName))
      )
    }
  }
  return { ...parsed, ingredients }
}

/**
 * Calls the Supabase Edge Function proxy for OpenAI Chat Completions (JSON mode).
 * Uses gpt-4o-mini by default for speed; override with EXPO_PUBLIC_OPENAI_INGREDIENT_MODEL. One repair pass per bad row, then local fallback.
 */
const EMPTY_DIETARY: DietaryProfile = {
  allergies: [],
  sensitivities: [],
  avoiding: [],
  preferences: [],
  scoringPreferenceKeys: [],
}

/** Barcode scans: tighter budget + no sequential repair calls (saves 10–60s on slow networks). */
const SCAN_AI_TIMEOUT_MS = 18_000
const SCAN_AI_MAX_TOKENS = 2200
const PARTIAL_AI_PER_ING_TOKENS = 280
const PARTIAL_AI_BASE_TOKENS = 380

function synthesizeProductVerdictFromSummary(items: IngredientAnalysisItem[]): string {
  const c = recalculateProductSummary(items)
  if (c.avoid > 0) {
    return `Worth a careful look — ${c.avoid} ingredient${c.avoid === 1 ? '' : 's'} rated avoid, listed first below.`
  }
  if (c.concerning > 0) {
    return `Mostly manageable, but ${c.concerning} ingredient${c.concerning === 1 ? '' : 's'} deserve a second read.`
  }
  return `Typical packaged formulation — scan the order below; earlier lines usually mean more of that ingredient by weight.`
}

function mergeCachedAndPartialAi(
  batch: CacheBatchResult,
  labelOrder: string[],
  partial: ProductIngredientAnalysisResponse
): IngredientAnalysisItem[] {
  const aiByKey = new Map<string, IngredientAnalysisItem>()
  for (let i = 0; i < batch.uncached.length; i++) {
    const key = batch.uncached[i].toLowerCase().trim()
    const item = partial.ingredients[i]
    if (item && key) aiByKey.set(key, item)
  }
  return labelOrder.map((labelName) => {
    const key = labelName.toLowerCase().trim()
    const row = batch.cached.get(key)
    if (row) {
      return padTranslatorFields(knowledgeRowToAnalysisItem(row, labelName))
    }
    const ai = aiByKey.get(key)
    if (ai) {
      return padTranslatorFields({ ...ai, name: labelName.trim() })
    }
    return padTranslatorFields(ingredientExplanationToAnalysisItem(buildFallbackIngredientExplanation(labelName)))
  })
}

function markItemsFromCacheFlag(items: IngredientAnalysisItem[], batch: CacheBatchResult): void {
  for (const item of items) {
    const key = (item.name ?? '').toLowerCase().trim()
    item.from_cache = Boolean(key && batch.cached.has(key))
  }
}

export async function analyzeIngredientsWithOpenAI(
  ingredientsList: string,
  dietaryProfile?: DietaryProfile | null,
  options?: {
    nutritionJson?: Record<string, unknown>
    /** When true (barcode flow), skip per-ingredient repair round and use shorter timeout. */
    skipIngredientRepair?: boolean
    /** Label text came from photo OCR — prompt model to fix artifacts. */
    fromOcr?: boolean
    /** Matches `parseIngredients` source (barcode vs ocr). */
    ingredientParseSource?: IngredientTextParseSource
    requestTimeoutMs?: number
    maxTokens?: number
  }
): Promise<ProductIngredientAnalysisResponse | null> {
  const profile = dietaryProfile ?? EMPTY_DIETARY
  const systemContent =
    INGREDIENT_ANALYSIS_SYSTEM_PROMPT + buildPersonalizationSystemAppend(profile)
  const nutritionAppend = formatNutritionJsonForPrompt(options?.nutritionJson)
  const cleanedLabel = prepareIngredientTextForAnalysis(ingredientsList)
  const parseSource: IngredientTextParseSource =
    options?.ingredientParseSource ?? (options?.fromOcr ? 'ocr' : 'barcode')
  const ingredientNames = parseIngredients(cleanedLabel, parseSource)

  if (ingredientNames.length > 0) {
    const batch = await getIngredientsFromCacheBatch(ingredientNames)

    if (batch.allCached) {
      const ingredients = ingredientNames.map((nm) => {
        const key = nm.toLowerCase().trim()
        const row = batch.cached.get(key)!
        return padTranslatorFields(knowledgeRowToAnalysisItem(row, nm))
      })
      const fromCache: ProductIngredientAnalysisResponse = {
        productVerdict:
          'Every ingredient line below was loaded instantly from Fillr’s shared library—still cross-check the physical label if your health needs are strict.',
        ingredients,
        _fillrIngredientDecodeMeta: { allIngredientsFromCache: true },
      }
      applyDeterministicPipeline(fromCache, cleanedLabel, profile)
      return fromCache
    }

    const tryPartialMerge = batch.uncached.length > 0 && batch.cached.size > 0
    if (tryPartialMerge) {
      const ocrPrePartial = options?.fromOcr ? OCR_INGREDIENT_ANALYSIS_PREFIX : ''
      const partialUser =
        ocrPrePartial + buildPartialIngredientAnalysisUserPrompt(batch.uncached, nutritionAppend)
      const quick = options?.skipIngredientRepair === true
      const partialMaxTokens = Math.min(
        SCAN_AI_MAX_TOKENS,
        PARTIAL_AI_BASE_TOKENS + batch.uncached.length * PARTIAL_AI_PER_ING_TOKENS
      )
      const timeoutMs = options?.requestTimeoutMs ?? (quick ? SCAN_AI_TIMEOUT_MS : 55_000)
      const maxTokens = options?.maxTokens ?? (quick ? partialMaxTokens : MAX_TOKENS)

      let parsedPartial = await requestIngredientAnalysisJson(partialUser, systemContent, {
        timeoutMs,
        maxTokens,
      })

      const partialOk =
        parsedPartial != null &&
        Array.isArray(parsedPartial.ingredients) &&
        parsedPartial.ingredients.length === batch.uncached.length

      if (partialOk && parsedPartial) {
        let partialFixed = parsedPartial
        if (productVerdictInvalid(partialFixed.productVerdict)) {
          partialFixed = {
            ...partialFixed,
            productVerdict:
              'These ingredient lines were decoded for this product—see each card below for plain-English detail.',
          }
        }
        const mergedItems = mergeCachedAndPartialAi(batch, ingredientNames, partialFixed)
        markItemsFromCacheFlag(mergedItems, batch)
        let parsed: ProductIngredientAnalysisResponse = {
          productVerdict: partialFixed.productVerdict,
          ingredients: mergedItems,
          productAnalysis: partialFixed.productAnalysis ?? ({} as ProductAnalysis),
        }
        const repaired = quick
          ? parsed
          : await validateAndRepairIngredients(parsed, ingredientsList, systemContent)
        applyDeterministicPipeline(repaired, cleanedLabel, profile)
        repaired.productVerdict = synthesizeProductVerdictFromSummary(repaired.ingredients)
        for (const item of repaired.ingredients) {
          if (!item.from_cache) {
            void saveIngredientToCache(analysisItemToSaveInput(item)).catch(() => {})
          }
        }
        return repaired
      }
    }
  }

  const ocrPre = options?.fromOcr ? OCR_INGREDIENT_ANALYSIS_PREFIX : ''
  const userContent = ocrPre + buildIngredientAnalysisUserPrompt(cleanedLabel, nutritionAppend)
  const quick = options?.skipIngredientRepair === true
  const timeoutMs = options?.requestTimeoutMs ?? (quick ? SCAN_AI_TIMEOUT_MS : 55_000)
  const maxTokens = options?.maxTokens ?? (quick ? SCAN_AI_MAX_TOKENS : MAX_TOKENS)

  let parsed = await requestIngredientAnalysisJson(userContent, systemContent, {
    timeoutMs,
    maxTokens,
  })
  if (!parsed) return null
  if (productVerdictInvalid(parsed.productVerdict)) {
    console.warn('[Fillr] productVerdict failed validation; using local fallback sentence (no extra API call).')
    parsed = {
      ...parsed,
      productVerdict:
        'This product has a long ingredient list—use the cards below to see what each line means in plain English.',
    }
  }
  const repaired = quick
    ? parsed
    : await validateAndRepairIngredients(parsed, ingredientsList, systemContent)
  for (const item of repaired.ingredients) {
    item.from_cache = false
  }
  applyDeterministicPipeline(repaired, cleanedLabel, profile)

  for (const item of repaired.ingredients) {
    void saveIngredientToCache(analysisItemToSaveInput(item)).catch(() => {})
  }

  return repaired
}

export function mergeAiAnalysisWithScan(
  ai: ProductIngredientAnalysisResponse,
  base: ScanResult
): ScanResult {
  let ingredients = mergeAiBreakdownWithLabel(base, ai)

  const matchedAllergenTerms = base.matchedAllergens.map((a) => ({
    termLower: a.matchedIngredient.toLowerCase(),
    allergenName: a.allergenName,
  }))
  const matchedSensitivityTerms = base.matchedSensitivities.map((s) => ({
    termLower: s.matchedIngredient.toLowerCase(),
    sensitivityName: s.sensitivityName,
  }))

  ingredients = ingredients.map((ing) => {
    const il = ing.name.toLowerCase()
    const ma = matchedAllergenTerms.find((t) => termsMatch(il, t.termLower))
    if (ma) {
      return {
        ...ing,
        verdict: 'LIMIT' as const,
        ingredientRating: 'avoid' as const,
        personalizedNote:
          ing.personalMessage ||
          `Because you selected ${ma.allergenName} as an allergy, avoid this ingredient.`,
        ratingReason:
          ing.personalMessage || `Matches your ${ma.allergenName} allergy on the label.`,
      }
    }
    const ms = matchedSensitivityTerms.find((t) => termsMatch(il, t.termLower))
    if (ms) {
      return {
        ...ing,
        verdict: 'NEUTRAL' as const,
        ingredientRating: 'concerning' as const,
        personalizedNote:
          ing.personalMessage ||
          `Because you selected ${ms.sensitivityName} as a sensitivity, consider limiting this.`,
      }
    }
    return ing
  })

  ingredients = ingredients.map(replaceBoilerplateIngredientProse)
  ingredients = sortIngredientsBySeverity(ingredients)

  const cacheMeta = ai._fillrIngredientDecodeMeta

  return {
    ...base,
    productVerdict: ai.productVerdict,
    ...(ai.productAnalysis ? { productAnalysis: ai.productAnalysis } : {}),
    ingredientBreakdown: ingredients,
    ...(cacheMeta?.allIngredientsFromCache
      ? { ingredientDecodeMeta: { allFromCache: true } }
      : {}),
  }
}

/**
 * Mock/offline scans and any breakdown missing `ingredientRating` would otherwise show
 * every line as "Clean" (IngredientCard defaults when rating is absent). Re-apply the
 * same deterministic + nuclear rules used after OpenAI so pills and counts match Fillr policy.
 */
function enforceDeterministicRatingsOnBreakdown(
  breakdown: IngredientExplanation[],
  fullLabelHaystack = ''
): IngredientExplanation[] {
  if (!breakdown.length) return breakdown
  const minimal = breakdown.map(
    (i) =>
      ({
        name: i.name,
        rating: (i.ingredientRating ?? 'okay') as IngredientRating,
      }) as IngredientAnalysisItem
  )
  let corrected = applyDeterministicRatings(minimal, fullLabelHaystack) as IngredientAnalysisItem[]
  corrected = applyNuclearForceRatings(corrected)
  return breakdown.map((ing, idx) => {
    const c = corrected[idx]
    if (!c) return ing
    const rating = normalizeIngredientRating(c.rating as string) ?? 'okay'
    return {
      ...ing,
      ingredientRating: rating,
      verdict: mapRatingToVerdict(rating),
      ...(c.ratingSource ? { ratingSource: c.ratingSource as IngredientExplanation['ratingSource'] } : {}),
      ...(c.ratingOverridden != null ? { ratingOverridden: c.ratingOverridden } : {}),
    }
  })
}

/** When OpenAI is unavailable: sort + attach a local verdict. */
export function applyPresentationDefaults(result: ScanResult): ScanResult {
  const haystack = result.product.ingredientText ?? ''
  const expanded = expandBreakdownToFullLabel(
    haystack,
    result.ingredientBreakdown,
    parseSourceFromScan(result.scanSource)
  )
  const sorted = sortIngredientsBySeverity(expanded)
  const enforced = enforceDeterministicRatingsOnBreakdown(sorted, haystack)
  const resorted = sortIngredientsBySeverity(enforced).map((ing) => {
    const amb = lookupIngredientAmbiguity(ing.name)
    return amb ? { ...ing, sourceAmbiguity: amb } : ing
  })
  const productVerdict =
    result.productVerdict ??
    buildLocalProductVerdict(resorted, result.product.name, result.matchedAllergens)
  return applyAllergenPersonalizedProductCopy({
    ...result,
    productVerdict,
    ingredientBreakdown: resorted,
  })
}
