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
  buildCompactIngredientAnalysisSystemPrompt,
  buildPersonalizationSystemAppend,
  buildPartialIngredientAnalysisUserPrompt,
  buildSingleIngredientRepairUserPrompt,
  formatDetectedPatternsForPrompt,
  formatNutritionJsonForPrompt,
  type ProductIngredientAnalysisResponse,
  type IngredientAnalysisItem,
} from './openaiIngredientAnalysisPrompt'
import { parseIngredients, prepareIngredientTextForAnalysis } from '../lib/fillrAdapter'
import {
  createAwaitingDecodeAnalysisItem,
  createAwaitingDecodeIngredientExplanation,
  createOfflineOrTimeoutIngredientExplanation,
} from '../lib/ingredientDecodePlaceholder'
import {
  applyAllergenPersonalizedProductCopy,
  applySensitivityPersonalizedProductCopy,
} from '../lib/personalizationEngine'
import { lookupIngredientAmbiguity } from '../lib/ingredientAmbiguity'
import { stripPersonalizationNotInProfile } from '../lib/stripProfilePersonalization'
import { ensureDistinctIngredientExplanation } from '../lib/ingredientProseHydration'
import { buildFallbackIngredientExplanation } from '../lib/fillrAdapter'
import {
  analysisItemToSaveInput,
  getIngredientsFromCacheBatch,
  knowledgeRowToAnalysisItem,
  saveIngredientToCache,
  type CacheBatchResult,
} from '../lib/ingredientKnowledge'
import {
  looksLikeFrenchIngredientName,
  mapIngredientNameForLookup,
  normalizeIngredientName,
} from '../lib/ingredientNameNormalization'
import { buildIngredientTemplateItem } from '../lib/ingredientTemplates'
import type { IngredientTextParseSource } from '../lib/ingredientParseSource'
import { assignLabelsToAiItemsGreedy } from '../lib/ingredientLabelAiMerge'
import { detectProductPatterns } from '../lib/productPatternDetection'
import { validateIngredientAnalysisOutput } from '../lib/ingredientAnalysisValidation'
import { detectProductCategoryFromSignals } from '../lib/buildScoringData'
import { getGoalDisplayLabel } from '../lib/profileDisplayLabels'
import {
  isProductLevelGoal,
  stripProductLevelGoalFromIngredient,
} from '../lib/goalApplicability'
import {
  composeDeterministicProductSummary,
  composeDeterministicProductVerdict,
} from '../lib/productSummaryComposer'
import type { ProductCategory } from '../lib/fillrScoring'
import {
  INGREDIENT_GENERIC_PROSE_PATTERNS,
  ingredientAnalysisItemFailsGenericGate,
  ingredientExplanationFailsQualityGate,
} from '../lib/ingredientCopyQuality'
import {
  shouldEscalateNaturalFlavor,
  shouldEscalateProcessingSignal,
} from '../lib/naturalFlavorDisambiguation'

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
  'artificial flavor',
  'artificial flavour',
  'msg',
  'monosodium glutamate',
  'acesulfame',
  'sucralose',
  'aspartame',
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
  // Salt / sea salt: do not list here — `ingredientMatcher` ALWAYS_CLEAN already
  // rates them `clean`. Nuclear `includes('salt')` would override that to `okay`
  // (PROCESSED in the UI), which reads wrong for plain salt.
  'baking soda',
  'citric acid',
  'vinegar',
  'corn starch',
  'vegetable oil',
  'canola oil',
]

const NUCLEAR_REASON =
  'Fillr applies a deterministic safety rule for this ingredient name, overriding the model rating when they disagree.'

function applyNuclearForceRatings(
  items: IngredientAnalysisItem[],
  fullLabelHaystack?: string,
  productCategory?: ProductCategory
): IngredientAnalysisItem[] {
  return items.map((ingredient) => {
    const n = normalizeForMatch(String(ingredient.name ?? ''))
    if (!n) return ingredient

    if (n.includes('natural flavor') || n.includes('natural flavour')) {
      const flavorDecision = shouldEscalateNaturalFlavor({
        ingredientName: ingredient.name,
        fullLabelHaystack,
        productCategory,
      })
      if (!flavorDecision.escalate) {
        return {
          ...ingredient,
          rating: ingredient.rating === 'avoid' ? 'concerning' : ingredient.rating,
          ratingSource: ingredient.ratingSource ?? 'ai',
          ratingReason:
            ingredient.ratingReason ??
            'Natural flavor was not auto-escalated because no strong risk context was detected.',
        }
      }
    }

    if (
      n.includes('caramel color') ||
      n.includes('caramel colour') ||
      n.includes('maltodextrin') ||
      n.includes('modified starch') ||
      n.includes('modified food starch')
    ) {
      const processDecision = shouldEscalateProcessingSignal({
        ingredientName: ingredient.name,
        fullLabelHaystack,
        productCategory,
      })
      if (!processDecision.escalate) {
        return {
          ...ingredient,
          rating: ingredient.rating === 'avoid' ? 'concerning' : ingredient.rating,
          ratingSource: ingredient.ratingSource ?? 'ai',
          ratingReason:
            ingredient.ratingReason ??
            `${ingredient.name} was not auto-escalated because strong processing-risk context was not detected.`,
        }
      }
    }

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

/** Fast default; set EXPO_PUBLIC_OPENAI_INGREDIENT_MODEL=gpt-4o for higher-quality (slower) scans. */
const DEFAULT_MODEL = 'gpt-4o-mini'
const TEMPERATURE = 0
const MAX_TOKENS = 3072
const MIN_PROSE_LENGTH = 25
const MAX_REPAIR_ATTEMPTS = 2

const PROSE_FIELDS: (keyof IngredientAnalysisItem)[] = [
  'labelDecoder',
  'whatItIs',
  'whatItDoes',
  'bodyEffect',
  'funFact',
  'whyItMattersYou',
  'ratingReason',
]

const GENERIC_FILLER_PATTERNS: RegExp[] = [
  ...INGREDIENT_GENERIC_PROSE_PATTERNS,
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
  /\bif you avoid\b/i,
  /\bsome people\b/i,
  /\bnot suitable for\b/i,
  /\bthose with\b/i,
  /\bpeople with\b/i,
  /\byou may want to\b/i,
  /\bworth noting\b/i,
  /neutral for most people/i,
]

const GENERIC_COHORT_PATTERNS: RegExp[] = [
  /\bnot suitable for\b/i,
  /\bpeople with\b/i,
  /\bthose with\b/i,
  /\bindividuals with\b/i,
  /\byou with (allergies|sensitivities|restrictions|goals?)\b/i,
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
    ...(fb.shortLabel?.trim() ? { shortLabel: fb.shortLabel.trim() } : {}),
    ...(fb.whyItMattersBullets ? { whyItMattersBullets: fb.whyItMattersBullets } : {}),
    ...(fb.systemJudgment?.trim() ? { systemJudgment: fb.systemJudgment.trim() } : {}),
    ...(fb.impactForYou?.trim() ? { impactForYou: fb.impactForYou.trim() } : {}),
    ...(fb.flagDriver ? { flagDriver: fb.flagDriver } : {}),
    ...(fb.profileAnchor?.trim() ? { profileAnchor: fb.profileAnchor.trim() } : {}),
    ...(fb.actionability ? { actionability: fb.actionability } : {}),
    ...(fb.intelligenceConfidence ? { intelligenceConfidence: fb.intelligenceConfidence } : {}),
  }
}

export function padTranslatorFields(item: IngredientAnalysisItem): IngredientAnalysisItem {
  const name = (item.name ?? '').trim() || 'Ingredient'
  const fb = buildFallbackIngredientExplanation(name)
  let labelDecoder = String(item.labelDecoder ?? '').trim()
  let whatItIs = String(item.whatItIs ?? '').trim()
  let whatItDoes = String(item.whatItDoes ?? '').trim()
  let bodyEffect = String(item.bodyEffect ?? '').trim()
  let funFact = String(item.funFact ?? '').trim()
  let whyItMattersYou = String(item.whyItMattersYou ?? '').trim()

  if (proseFieldInvalid(labelDecoder)) {
    labelDecoder = fb.labelDecoder ?? fb.whatItIs.split('.')[0] ?? ''
    if (!endsWithSentencePunctuation(labelDecoder)) labelDecoder = `${labelDecoder.trim()}.`
  }
  if (proseFieldInvalid(whatItIs)) {
    whatItIs = fb.whatItIs
    if (!endsWithSentencePunctuation(whatItIs)) whatItIs = `${whatItIs.trim()}.`
  }
  if (proseFieldInvalid(whatItDoes)) {
    whatItDoes = fb.whatItDoes ?? fb.whyItsUsed ?? ''
    if (!endsWithSentencePunctuation(whatItDoes)) whatItDoes = `${whatItDoes.trim()}.`
  }
  if (proseFieldInvalid(bodyEffect)) {
    bodyEffect = fb.bodyEffect ?? ''
    if (!endsWithSentencePunctuation(bodyEffect)) bodyEffect = `${bodyEffect.trim()}.`
  }
  if (proseFieldInvalid(funFact)) {
    funFact = fb.funFact ?? ''
    if (!endsWithSentencePunctuation(funFact)) funFact = `${funFact.trim()}.`
  }
  if (proseFieldInvalid(whyItMattersYou)) {
    whyItMattersYou = fb.whyItMatters ?? fb.whatToKnow ?? ''
    if (!endsWithSentencePunctuation(whyItMattersYou)) whyItMattersYou = `${whyItMattersYou.trim()}.`
  }

  return { ...item, labelDecoder, whatItIs, whatItDoes, bodyEffect, funFact, whyItMattersYou }
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
      out.push(createAwaitingDecodeIngredientExplanation(labelName))
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
  const assignment = assignLabelsToAiItemsGreedy(labelNames, aiItems)
  const out: IngredientExplanation[] = []

  for (let li = 0; li < labelNames.length; li++) {
    const labelName = labelNames[li]
    const aiIdx = assignment.get(li)
    if (aiIdx != null && aiIdx >= 0) {
      out.push(aiItemToExplanation(aiItems[aiIdx], labelName))
      continue
    }
    const pIdx = findPoolIndexForLabelName(labelName, pool, usedPool)
    if (pIdx >= 0) {
      usedPool.add(pIdx)
      out.push(pool[pIdx])
    } else {
      out.push(createAwaitingDecodeIngredientExplanation(labelName))
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

function buildQuickSummaryFallback(ing: {
  name?: string
  quickSummary?: string
  headline?: string
  labelDecoder?: string
  whyItMatters?: string
  whyItMattersYou?: string
  ratingReason?: string
}): string {
  const candidates = [
    ing.quickSummary,
    ing.headline,
    ing.whyItMatters,
    ing.whyItMattersYou,
    ing.labelDecoder,
    ing.ratingReason,
  ]
    .map((s) => String(s ?? '').trim())
    .filter(Boolean)

  const first = candidates[0]
  if (first) {
    const short = first.length > 140 ? `${first.slice(0, 137).trim()}...` : first
    return endsWithSentencePunctuation(short) ? short : `${short}.`
  }

  const name = String(ing.name ?? 'This ingredient').trim() || 'This ingredient'
  return `${name} appears on the label; review this line with your goals and sensitivities in mind.`
}

function aiItemToExplanation(item: IngredientAnalysisItem, labelLine?: string): IngredientExplanation {
  const rating = normalizeIngredientRating(item.rating) ?? 'okay'
  const name = (labelLine ?? item.name ?? 'Ingredient').trim() || 'Ingredient'
  const contextStat = (item.contextStat ?? '').trim()
  const quickSummary = buildQuickSummaryFallback({
    name,
    headline: item.headline,
    labelDecoder: item.labelDecoder,
    whyItMattersYou: item.whyItMattersYou,
    ratingReason: item.ratingReason,
  })
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
    quickSummary,
    ...(contextStat ? { contextStat } : {}),
    ...(item.ratingSource ? { ratingSource: item.ratingSource } : {}),
    ...(item.ratingOverridden != null ? { ratingOverridden: item.ratingOverridden } : {}),
    ...(item.personalFlag ? { personalFlag: item.personalFlag } : {}),
    ...(item.personalMessage?.trim() ? { personalMessage: item.personalMessage.trim() } : {}),
    fromCache: item.from_cache === true,
    ...(item.shortLabel?.trim() ? { shortLabel: item.shortLabel.trim() } : {}),
    ...(item.whyItMattersBullets ? { whyItMattersBullets: item.whyItMattersBullets } : {}),
    ...(item.systemJudgment?.trim() ? { systemJudgment: item.systemJudgment.trim() } : {}),
    ...(item.impactForYou?.trim() ? { impactForYou: item.impactForYou.trim() } : {}),
    ...(item.flagDriver ? { flagDriver: item.flagDriver } : {}),
    ...(item.profileAnchor?.trim() ? { profileAnchor: item.profileAnchor.trim() } : {}),
    ...(item.actionability ? { actionability: item.actionability } : {}),
    ...(item.intelligenceConfidence ? { intelligenceConfidence: item.intelligenceConfidence } : {}),
    ...(item.decodeStatus ? { ingredientDecodeStatus: item.decodeStatus } : {}),
    evidenceTrace: {
      ruleMatched:
        item.evidenceRuleMatched ??
        (item.personalFlag
          ? `personal_${item.personalFlag}`
          : item.ratingSource === 'deterministic'
            ? 'deterministic_rule'
            : 'model_analysis'),
      source:
        item.evidenceSource ??
        (item.from_cache ? 'ingredient_knowledge' : item.ratingSource === 'deterministic' ? 'rule_engine' : 'ai'),
      confidence:
        item.evidenceConfidence ??
        (item.intelligenceConfidence === 'high'
          ? 'high'
          : item.intelligenceConfidence === 'medium'
            ? 'medium'
            : item.from_cache
              ? 'medium'
              : 'low'),
      ...(item.evidenceLastVerifiedAt ? { lastVerifiedAt: item.evidenceLastVerifiedAt } : {}),
    },
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

function pickStrRow(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

/**
 * Normalizes a single model ingredient object (supports snake_case intelligence keys).
 */
function coerceIngredientRow(row: unknown): IngredientAnalysisItem {
  if (!row || typeof row !== 'object') {
    return {
      name: 'Ingredient',
      headline: 'Ingredient line',
      labelDecoder:
        'This ingredient entry could not be parsed from the model JSON reliably, so treat the physical label as the source of truth.',
      whatItIs: 'Fillr keeps the raw label line and flags this row until the scan is repeated.',
      whatItDoes: 'It appears in the product formula in the order shown on your scan.',
      bodyEffect: 'Impact depends on the specific compound behind this listing.',
      funFact: 'Re-run the scan if packaging text differs from what Fillr read.',
      whyItMattersYou:
        'Incomplete model output means less confidence in this specific card until the label is confirmed.',
      rating: 'concerning',
      ratingReason:
        'Fillr used a cautious default because the API returned a malformed ingredient row.',
      contextStat: '',
    }
  }

  const r = row as Record<string, unknown>
  const ingredient_name = pickStrRow(r, 'ingredient_name') || undefined
  const name = pickStrRow(r, 'name') || ingredient_name || 'Ingredient'
  const shortLabel = pickStrRow(r, 'short_label', 'shortLabel') || undefined
  const systemJudgment = pickStrRow(r, 'system_judgment', 'systemJudgment') || undefined
  const impactForYou = pickStrRow(r, 'impact_for_you', 'impactForYou') || undefined
  const confRaw = pickStrRow(r, 'confidence', 'intelligenceConfidence').toLowerCase()
  const intelligenceConfidence: 'high' | 'medium' | undefined =
    confRaw === 'high' || confRaw === 'medium' ? confRaw : undefined
  const flagDriverRaw = pickStrRow(r, 'flag_driver', 'flagDriver').toLowerCase()
  const flagDriver: IngredientAnalysisItem['flagDriver'] =
    flagDriverRaw === 'allergy' ||
    flagDriverRaw === 'sensitivity' ||
    flagDriverRaw === 'goal' ||
    flagDriverRaw === 'preference' ||
    flagDriverRaw === 'processing'
      ? flagDriverRaw
      : undefined
  const profileAnchor = pickStrRow(r, 'profile_anchor', 'profileAnchor') || undefined
  const actionabilityRaw = pickStrRow(r, 'actionability').toLowerCase()
  const actionability: IngredientAnalysisItem['actionability'] =
    actionabilityRaw === 'avoid' || actionabilityRaw === 'limit' || actionabilityRaw === 'okay'
      ? actionabilityRaw
      : undefined

  const rawWim = r.why_it_matters ?? r.whyItMatters
  let whyItMattersBullets: readonly [string, string] | undefined
  if (Array.isArray(rawWim) && rawWim.length >= 2) {
    const a = String(rawWim[0] ?? '').trim()
    const b = String(rawWim[1] ?? '').trim()
    if (a && b) whyItMattersBullets = [a, b]
  }

  const ratingNorm = normalizeIngredientRating(pickStrRow(r, 'rating'))
  const rating: IngredientAnalysisItem['rating'] = ratingNorm ?? 'okay'

  const pfRaw = pickStrRow(r, 'personalFlag').toLowerCase()
  const personalFlag: IngredientAnalysisItem['personalFlag'] | undefined =
    pfRaw === 'allergy' ||
    pfRaw === 'sensitivity' ||
    pfRaw === 'avoiding' ||
    pfRaw === 'preference_conflict' ||
    pfRaw === 'celiac'
      ? pfRaw
      : undefined

  const rs = r.ratingSource
  const ratingSource =
    rs === 'ai' || rs === 'deterministic' || rs === 'personal' ? rs : undefined

  return {
    name,
    ...(ingredient_name && ingredient_name !== name ? { ingredient_name } : {}),
    headline: pickStrRow(r, 'headline') || shortLabel || name,
    labelDecoder: pickStrRow(r, 'labelDecoder'),
    whatItIs: pickStrRow(r, 'whatItIs'),
    whatItDoes: pickStrRow(r, 'whatItDoes'),
    bodyEffect: pickStrRow(r, 'bodyEffect'),
    funFact: pickStrRow(r, 'funFact'),
    whyItMattersYou: pickStrRow(r, 'whyItMattersYou'),
    rating,
    ratingReason: pickStrRow(r, 'ratingReason'),
    contextStat: typeof r.contextStat === 'string' ? r.contextStat : '',
    ...(ratingSource ? { ratingSource } : {}),
    ...(typeof r.ratingOverridden === 'boolean' ? { ratingOverridden: r.ratingOverridden } : {}),
    ...(personalFlag ? { personalFlag } : {}),
    ...(typeof r.personalMessage === 'string' && r.personalMessage.trim()
      ? { personalMessage: r.personalMessage.trim() }
      : {}),
    ...(r.from_cache === true ? { from_cache: true } : {}),
    ...(shortLabel ? { shortLabel } : {}),
    ...(whyItMattersBullets ? { whyItMattersBullets } : {}),
    ...(systemJudgment ? { systemJudgment } : {}),
    ...(impactForYou ? { impactForYou } : {}),
    ...(flagDriver ? { flagDriver } : {}),
    ...(profileAnchor ? { profileAnchor } : {}),
    ...(actionability ? { actionability } : {}),
    ...(intelligenceConfidence ? { intelligenceConfidence } : {}),
  }
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
    o.ingredients = o.ingredients.map((x) => coerceIngredientRow(x))
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

/** Pad compact intelligence strings so legacy prose validators still pass. */
function padShortProse(s: string, extras: string[], ingredientName?: string): string {
  let t = s.replace(/\s+/g, ' ').trim()
  const tail = extras
    .map((e) => e.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((e, idx, arr) => arr.findIndex((x) => x.toLowerCase() === e.toLowerCase()) === idx)
  if (!t) {
    t = tail[0] ?? 'This line is part of your scanned ingredient list.'
  }
  if (!endsWithSentencePunctuation(t)) t = `${t.trim()}.`
  let i = 0
  while (t.length < MIN_PROSE_LENGTH && i < tail.length) {
    const e = tail[i++]
    if (!e || t.toLowerCase().includes(e.toLowerCase().slice(0, 20))) continue
    const chunk = e.endsWith('.') ? e.slice(0, -1) : e
    t = `${t} ${chunk}.`.replace(/\s+/g, ' ')
  }
  if (t.length < MIN_PROSE_LENGTH) {
    const n = (ingredientName ?? '').trim() || 'This ingredient'
    t = `${t} On food labels, "${n}" is the name the manufacturer uses for this part of the recipe.`
  }
  if (!endsWithSentencePunctuation(t)) t = `${t.trim()}.`
  return t
}

/** When the model returns Fillr intelligence, hydrate legacy translator fields before validation. */
function mergeIntelligenceIntoLegacyItem(item: IngredientAnalysisItem): IngredientAnalysisItem {
  const next: IngredientAnalysisItem = { ...item }
  const name = (next.name ?? '').trim() || 'Ingredient'
  const b = next.whyItMattersBullets
  const sj = next.systemJudgment?.trim()
  const sl = next.shortLabel?.trim()
  const ify = next.impactForYou?.trim()
  const local = buildFallbackIngredientExplanation(name)

  if (b?.[0] && b?.[1] && proseFieldInvalid(next.whyItMattersYou)) {
    next.whyItMattersYou = padShortProse(b[1], [ify ?? ''], name)
  }
  if (sj && proseFieldInvalid(next.ratingReason)) {
    next.ratingReason = padShortProse(sj, [b?.[1] ?? ''], name)
  }
  if (proseFieldInvalid(next.labelDecoder)) {
    const ld = sl || local.labelDecoder || b?.[0] || ''
    next.labelDecoder = padShortProse(ld, [], name)
  }
  if (proseFieldInvalid(next.headline)) {
    next.headline = padShortProse(sl || local.headline || name, [], name)
  }
  if (proseFieldInvalid(next.whatItIs)) {
    next.whatItIs = padShortProse(b?.[0] || local.whatItIs, [], name)
  }
  if (proseFieldInvalid(next.whatItDoes)) {
    next.whatItDoes = padShortProse(b?.[1] || local.whatItDoes || local.whyItsUsed, [], name)
  }
  if (proseFieldInvalid(next.bodyEffect)) {
    next.bodyEffect = padShortProse(local.bodyEffect, [], name)
  }
  if (proseFieldInvalid(next.funFact)) {
    next.funFact = padShortProse(local.funFact, [ify ?? ''], name)
  }

  const merged = ingredientExplanationToAnalysisItem(
    ensureDistinctIngredientExplanation(aiItemToExplanation(next, name))
  )
  return {
    ...next,
    ...merged,
    rating: next.rating ?? merged.rating,
    personalFlag: next.personalFlag,
    personalMessage: next.personalMessage,
    ratingSource: next.ratingSource ?? merged.ratingSource,
    ratingOverridden: next.ratingOverridden,
    shortLabel: next.shortLabel ?? merged.shortLabel,
    whyItMattersBullets: next.whyItMattersBullets ?? merged.whyItMattersBullets,
    systemJudgment: next.systemJudgment ?? merged.systemJudgment,
    impactForYou: next.impactForYou ?? merged.impactForYou,
    flagDriver: next.flagDriver ?? merged.flagDriver,
    profileAnchor: next.profileAnchor ?? merged.profileAnchor,
    actionability: next.actionability ?? merged.actionability,
    intelligenceConfidence: next.intelligenceConfidence ?? merged.intelligenceConfidence,
    from_cache: next.from_cache,
    evidenceRuleMatched: next.evidenceRuleMatched,
    evidenceSource: next.evidenceSource,
  }
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
      // Generic `funFact` alone is common for pantry lines (vinegar, spices) after templates/cache.
      // Do not trigger a 20s+ network repair when the rest of the row already has concrete prose.
      if (key === 'funFact') {
        const restOk = PROSE_FIELDS.filter((k) => k !== 'funFact').every((k) => {
          const o = item[k] as string
          return !proseFieldInvalid(o) && !containsGenericFiller(o)
        })
        if (restOk) continue
      }
      reasons.push(`${String(key)}: generic filler`)
    }
  }
  return reasons
}

function ingredientParseLooksInvalid(item: IngredientAnalysisItem): boolean {
  return ingredientInvalidReasons(item).length > 0
}

function normalizeTemplateCompare(s: string | undefined): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function repetitiveTemplateRows(items: IngredientAnalysisItem[]): Set<number> {
  const out = new Set<number>()
  const groups = new Map<string, number[]>()
  items.forEach((it, i) => {
    const key = normalizeTemplateCompare(it.whyItMattersYou || it.impactForYou || it.shortLabel || '')
    if (!key || key.length < 24) return
    const arr = groups.get(key) ?? []
    arr.push(i)
    groups.set(key, arr)
  })
  for (const arr of groups.values()) {
    if (arr.length >= 3) arr.forEach((i) => out.add(i))
  }
  return out
}

function hasGenericCohortPhrase(s: string | undefined): boolean {
  const t = String(s ?? '')
  return GENERIC_COHORT_PATTERNS.some((re) => re.test(t))
}

function hasGenericWarningPhrase(s: string | undefined): boolean {
  const t = String(s ?? '')
  return (
    /\bnot suitable for\b/i.test(t) ||
    /\bif you have\b/i.test(t) ||
    /\bpeople with\b/i.test(t) ||
    /\bthose with\b/i.test(t) ||
    /\bindividuals with\b/i.test(t) ||
    /\bmay react\b/i.test(t) ||
    /\bmay want to avoid\b/i.test(t) ||
    /\bshould avoid\b/i.test(t)
  )
}

function rewriteToSecondPerson(s: string | undefined): string {
  const t = String(s ?? '').trim()
  if (!t) return ''
  return t
    .replace(/\bpeople with\b/gi, 'you with')
    .replace(/\bthose with\b/gi, 'you with')
    .replace(/\bindividuals with\b/gi, 'you with')
    .replace(/\bnot suitable for\b/gi, 'not aligned with')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildFallbackImpactForYou(item: IngredientAnalysisItem, profile: DietaryProfile): string {
  const personalMsg = String(item.personalMessage ?? '').trim()
  if (personalMsg) return rewriteToSecondPerson(personalMsg)
  const goal = String(profile.goal ?? '').trim()
  const hasAllergies = (profile.allergies ?? []).length > 0
  const hasSensitivities = (profile.sensitivities ?? []).length > 0
  if (item.personalFlag === 'allergy' && hasAllergies) {
    return 'Flagged for you because this appears to match an item in your saved allergy profile.'
  }
  if (item.personalFlag === 'celiac') {
    return 'Flagged for you because your strict celiac setting treats this ingredient as a gluten-risk line.'
  }
  if (item.personalFlag === 'sensitivity' && hasSensitivities) {
    return 'Flagged for you because this conflicts with a sensitivity in your saved profile.'
  }
  if (item.personalFlag === 'avoiding') {
    return 'Flagged for you because this appears in ingredients you chose to avoid in your profile.'
  }
  if (item.personalFlag === 'preference_conflict') {
    return 'Flagged for you because this conflicts with one of your saved dietary preferences.'
  }
  if ((profile.scoringPreferenceKeys ?? []).length > 0) {
    return 'Flagged for you because this conflicts with your saved nutrition priorities.'
  }
  return 'Flagged in your results because Fillr marks this as a higher-risk additive or processing ingredient for your current profile.'
}

export function enforcePersonalizedCopy(
  parsed: ProductIngredientAnalysisResponse,
  profile: DietaryProfile
): ProductIngredientAnalysisResponse {
  const out: ProductIngredientAnalysisResponse = {
    ...parsed,
    productVerdict: rewriteToSecondPerson(parsed.productVerdict),
    ingredients: parsed.ingredients.map((ing) => {
      const next: IngredientAnalysisItem = { ...ing }
      next.ratingReason = rewriteToSecondPerson(next.ratingReason)
      next.whyItMattersYou = rewriteToSecondPerson(next.whyItMattersYou)
      next.systemJudgment = rewriteToSecondPerson(next.systemJudgment)
      next.impactForYou = rewriteToSecondPerson(next.impactForYou)

      const isFlagged = next.rating === 'concerning' || next.rating === 'avoid'
      const productGoalOnly = isProductLevelGoal(profile.goal)
      const hasPersonalConflict =
        next.personalFlag === 'allergy' ||
        next.personalFlag === 'sensitivity' ||
        next.personalFlag === 'celiac' ||
        next.personalFlag === 'avoiding' ||
        next.personalFlag === 'preference_conflict' ||
        next.flagDriver === 'allergy' ||
        next.flagDriver === 'sensitivity' ||
        (next.flagDriver === 'goal' && !productGoalOnly) ||
        next.flagDriver === 'preference'
      const impactClaimsNoConflict = /\bno direct conflicts with your current profile\b/i.test(
        next.impactForYou ?? ''
      )
      const needsImpact =
        (hasPersonalConflict && impactClaimsNoConflict) ||
        !next.impactForYou?.trim() ||
        hasGenericWarningPhrase(next.impactForYou) ||
        hasGenericCohortPhrase(next.impactForYou) ||
        !/\b(you|your)\b/i.test(next.impactForYou)
      if (needsImpact) {
        next.impactForYou = isFlagged
          ? buildFallbackImpactForYou(next, profile)
          : 'No direct conflicts with your current profile.'
      }

      const needsWhy =
        (hasPersonalConflict && /\bno direct conflicts with your current profile\b/i.test(next.whyItMattersYou ?? '')) ||
        !next.whyItMattersYou?.trim() ||
        hasGenericWarningPhrase(next.whyItMattersYou) ||
        hasGenericCohortPhrase(next.whyItMattersYou) ||
        !/\b(you|your)\b/i.test(next.whyItMattersYou)
      if (needsWhy) {
        next.whyItMattersYou = next.impactForYou
      }

      // Global policy: never keep generic warning templates in user-facing lines.
      if (hasGenericWarningPhrase(next.ratingReason)) {
        next.ratingReason = isFlagged
          ? 'This ingredient is flagged in your scan due to your profile and Fillr ingredient rules.'
          : 'This ingredient does not create a direct conflict with your saved profile.'
      }
      if (hasGenericWarningPhrase(next.systemJudgment)) {
        next.systemJudgment = isFlagged
          ? 'This line raises a profile-relevant concern in this product.'
          : 'This line is included for context in your ingredient breakdown.'
      }
      if (hasGenericWarningPhrase(next.labelDecoder)) {
        next.labelDecoder = isFlagged
          ? 'This label line maps to a profile-relevant ingredient concern for you.'
          : 'This label line is decoded in plain language for your profile context.'
      }

      if (!next.flagDriver) {
        if (next.personalFlag === 'allergy') next.flagDriver = 'allergy'
        else if (next.personalFlag === 'sensitivity' || next.personalFlag === 'celiac')
          next.flagDriver = 'sensitivity'
        else if (next.personalFlag === 'avoiding' || next.personalFlag === 'preference_conflict')
          next.flagDriver = 'preference'
        else if (isFlagged && !productGoalOnly) next.flagDriver = 'processing'
      }
      if (!next.actionability) {
        next.actionability = next.rating === 'avoid' ? 'avoid' : next.rating === 'concerning' ? 'limit' : 'okay'
      }

      return stripProductLevelGoalFromIngredient(next, profile.goal)
    }),
  }

  if (out.productAnalysis) {
    out.productAnalysis = {
      ...out.productAnalysis,
      ...(typeof out.productAnalysis.viralHook === 'string'
        ? { viralHook: rewriteToSecondPerson(out.productAnalysis.viralHook) }
        : {}),
      ...(typeof out.productAnalysis.whatTheyDontTellYou === 'string'
        ? { whatTheyDontTellYou: rewriteToSecondPerson(out.productAnalysis.whatTheyDontTellYou) }
        : {}),
      ...(typeof out.productAnalysis.whoShouldAvoid === 'string'
        ? { whoShouldAvoid: rewriteToSecondPerson(out.productAnalysis.whoShouldAvoid) }
        : {}),
      ...(typeof out.productAnalysis.bottomLine === 'string'
        ? { bottomLine: rewriteToSecondPerson(out.productAnalysis.bottomLine) }
        : {}),
      ...(typeof out.productAnalysis.ingredientOrderInsight === 'string'
        ? { ingredientOrderInsight: rewriteToSecondPerson(out.productAnalysis.ingredientOrderInsight) }
        : {}),
    }
  }

  return out
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
  dietaryProfile: DietaryProfile,
  productCategory?: ProductCategory
): void {
  const raw = parsed.ingredients
  if (!Array.isArray(raw)) return

  // Hydrate legacy prose from compact intelligence when present, then ratings.
  let corrected = raw.map(mergeIntelligenceIntoLegacyItem) as IngredientAnalysisItem[]
  corrected = applyDeterministicRatings(corrected, ingredientsListForMatcher) as IngredientAnalysisItem[]
  corrected = applyNuclearForceRatings(corrected, ingredientsListForMatcher, productCategory)
  corrected = applyPersonalizedRatings(corrected, dietaryProfile) as IngredientAnalysisItem[]
  corrected = stripPersonalizationNotInProfile(corrected, dietaryProfile) as IngredientAnalysisItem[]
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

type IngredientRequestMeta = {
  model?: string
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  latencyMs: number
  failureReason?:
    | 'missing_env'
    | 'http_error'
    | 'missing_content'
    | 'parse_null'
    | 'timeout'
    | 'request_failed'
}

async function requestIngredientAnalysisJson(
  userContent: string,
  systemContent: string,
  requestOpts?: IngredientAnalysisRequestOpts
): Promise<{ parsed: ProductIngredientAnalysisResponse | null; meta: IngredientRequestMeta }> {
  const started = Date.now()
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim()
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Fillr] ingredient-analysis skipped: missing EXPO_PUBLIC_SUPABASE_URL or ANON_KEY')
    return { parsed: null, meta: { latencyMs: Date.now() - started, failureReason: 'missing_env' } }
  }

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

    if (!res.ok) {
      let errSnippet = ''
      try {
        errSnippet = (await res.text()).slice(0, 240)
      } catch {
        // ignore body parse issues; status is enough to debug
      }
      console.warn(
        `[Fillr] ingredient-analysis returned ${res.status}${errSnippet ? `: ${errSnippet}` : ''}`
      )
      return { parsed: null, meta: { latencyMs: Date.now() - started, failureReason: 'http_error' } }
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
      model?: string
    }
    const text = data?.choices?.[0]?.message?.content
    if (!text || typeof text !== 'string') {
      return {
        parsed: null,
        meta: {
          model: data?.model,
          promptTokens: data?.usage?.prompt_tokens,
          completionTokens: data?.usage?.completion_tokens,
          totalTokens: data?.usage?.total_tokens,
          latencyMs: Date.now() - started,
          failureReason: 'missing_content',
        },
      }
    }
    const parsed = parseIngredientAnalysisJson(text)
    return {
      parsed,
      meta: {
        model: data?.model,
        promptTokens: data?.usage?.prompt_tokens,
        completionTokens: data?.usage?.completion_tokens,
        totalTokens: data?.usage?.total_tokens,
        latencyMs: Date.now() - started,
        ...(parsed ? {} : { failureReason: 'parse_null' as const }),
      },
    }
  } catch (e) {
    const name = e && typeof e === 'object' && 'name' in e ? String((e as Error).name) : ''
    if (name === 'AbortError') {
      return { parsed: null, meta: { latencyMs: Date.now() - started, failureReason: 'timeout' } }
    }
    const msg = e instanceof Error ? e.message : String(e)
    console.warn(`[Fillr] ingredient-analysis request failed: ${msg}`)
    return { parsed: null, meta: { latencyMs: Date.now() - started, failureReason: 'request_failed' } }
  } finally {
    clearTimeout(t)
  }
}

export async function repairIngredientLineWithOpenAI(
  ingredientName: string,
  fullIngredientsList: string,
  systemContent: string
): Promise<IngredientAnalysisItem | null> {
  const userContent = buildSingleIngredientRepairUserPrompt(ingredientName, fullIngredientsList)
  const { parsed } = await requestIngredientAnalysisJson(userContent, systemContent, {
    timeoutMs: 24_000,
    maxTokens: 900,
  })
  if (!parsed) {
    console.warn(`[Fillr] repair re-fetch failed for "${ingredientName}" (null response)`)
    return null
  }
  const first = parsed?.ingredients?.[0]
  if (!first) {
    console.warn(`[Fillr] repair re-fetch returned no ingredient row for "${ingredientName}"`)
    return null
  }
  return first
}

async function validateAndRepairIngredients(
  parsed: ProductIngredientAnalysisResponse,
  ingredientsList: string,
  systemContent: string,
  repairAllowedKeys?: Set<string>,
  maxRepairJobs = MAX_REPAIR_ATTEMPTS * 12
): Promise<ProductIngredientAnalysisResponse> {
  const ingredients = [...parsed.ingredients]
  const repetitive = repetitiveTemplateRows(ingredients)
  type RepairJob = { i: number; targetName: string; reasons: string[] }
  const jobs: RepairJob[] = []
  for (let i = 0; i < ingredients.length; i++) {
    if (repairAllowedKeys) {
      const k = normalizeIngredientName(ingredients[i]?.name ?? '')
      if (!k || !repairAllowedKeys.has(k)) continue
    }
    if (!ingredientParseLooksInvalid(ingredients[i]) && !repetitive.has(i)) continue
    const targetName = (ingredients[i].name ?? '').trim() || `ingredient_${i}`
    const reasons = ingredientInvalidReasons(ingredients[i])
    if (repetitive.has(i)) reasons.push('repetitive template copy')
    jobs.push({ i, targetName, reasons })
  }
  const cappedJobs = jobs.slice(0, Math.max(0, maxRepairJobs))
  const results = await Promise.all(
    cappedJobs.map(async ({ i, targetName, reasons }) => {
      console.warn(
        `[Fillr] Ingredient "${targetName}" failed validation (${reasons.join(', ')}); re-fetching`
      )
      let best = ingredients[i]
      for (let a = 0; a < MAX_REPAIR_ATTEMPTS; a++) {
        const repaired = await repairIngredientLineWithOpenAI(targetName, ingredientsList, systemContent)
        if (!repaired) break
        best = repaired
        if (!ingredientParseLooksInvalid(repaired)) break
      }
      return { i, best, targetName }
    })
  )
  for (const { i, best, targetName } of results) {
    if (!ingredientParseLooksInvalid(best)) {
      ingredients[i] = best
    } else {
      ingredients[i] = createAwaitingDecodeAnalysisItem(targetName)
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

/** Barcode scans: bounded budget; greedy merge + capped repairs keep latency predictable. */
const SCAN_AI_TIMEOUT_MS = 28_000
const SCAN_AI_MAX_TOKENS = 2200
const PARTIAL_AI_PER_ING_TOKENS = 220
const PARTIAL_AI_BASE_TOKENS = 320

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

function markItemsFromCacheFlag(items: IngredientAnalysisItem[], batch: CacheBatchResult): void {
  for (const item of items) {
    const key = normalizeIngredientName(item.name ?? '')
    item.from_cache = Boolean(key && batch.cached.has(key))
  }
}

function mergeTemplateCacheAndAiItems(
  labelOrder: string[],
  batch: CacheBatchResult,
  aiByKey: Map<string, IngredientAnalysisItem[]>
): IngredientAnalysisItem[] {
  return labelOrder.map((labelName) => {
    const templated = buildIngredientTemplateItem(labelName)
    if (templated) return templated

    const key = normalizeIngredientName(labelName)
    const row = batch.cached.get(key)
    if (row) return padTranslatorFields(knowledgeRowToAnalysisItem(row, labelName))

    const queue = aiByKey.get(key)
    const ai = queue?.shift()
    if (ai) return padTranslatorFields({ ...ai, name: labelName.trim(), ingredient_name: labelName.trim() })

    return createAwaitingDecodeAnalysisItem(labelName.trim())
  })
}

function buildLocalFallbackAnalysisItem(labelName: string): IngredientAnalysisItem {
  const name = labelName.trim() || 'Ingredient'
  const key = normalizeIngredientName(name)
  const lower = key || name.toLowerCase()

  let shortLabel = 'Named label ingredient'
  let headline = `${name} is part of this formula.`
  let labelDecoder = `${name} appears directly in the ingredient list.`
  let whatItIs = `${name} is a named food ingredient on this label; its exact role depends on the surrounding formula.`
  let whatItDoes = "Helps build the product's taste, texture, nutrition, or shelf stability."
  let bodyEffect = 'Judge it together with ingredient order, serving size, and the nutrition panel.'
  let whyItMattersYou = 'This line is useful context, but it is not a personal concern unless it matches your profile.'
  let rating: IngredientAnalysisItem['rating'] = 'okay'
  let ratingReason = 'Local fallback rating based on ingredient name and common packaged-food role.'

  if (/\b(oat\s+protein|oat\s+flour|oat\b|oats)\b/.test(lower) && /\bprotein\b/.test(lower)) {
    shortLabel = 'Oat protein'
    headline = 'Oat-derived protein boost.'
    labelDecoder = "Protein extracted from oats and added to raise the product's protein content."
    whatItIs = 'A concentrated oat ingredient with more protein than regular oats.'
    whatItDoes = 'Adds protein and structure, especially in bars, snacks, and plant-based products.'
    bodyEffect = 'Can support fullness better than pure starch, but it is still a processed fraction of oats.'
    whyItMattersYou = 'Relevant if you want higher protein; verify gluten certification if gluten is a strict concern.'
    rating = 'okay'
    ratingReason = 'Recognizable plant protein with processing, generally reasonable unless gluten/cross-contact matters.'
  } else if (/\b(oat\s+fib(?:er|re)|oat\b.*fib(?:er|re))\b/.test(lower)) {
    shortLabel = 'Oat fiber'
    headline = 'Oat-derived fiber ingredient.'
    labelDecoder = 'Fiber separated from oats and added for texture and fiber content.'
    whatItIs = 'The fibrous part of oats, usually used as a concentrated ingredient rather than whole oats.'
    whatItDoes = 'Adds bulk, chew, and fiber without adding much sugar or fat.'
    bodyEffect = 'May support fullness and digestion, but too much added fiber can bother sensitive stomachs.'
    whyItMattersYou = 'Useful if fiber fits your goals; check gluten-free sourcing if you need strict gluten control.'
    rating = 'okay'
    ratingReason = 'Added fiber ingredient with useful function, though less whole-food than intact oats.'
  } else if (/\b(prebiotic|inulin|chicory|soluble\s+fib(?:er|re)|fib(?:er|re))\b/.test(lower)) {
    shortLabel = 'Added fiber'
    headline = 'Fiber added for function.'
    labelDecoder = 'A fiber ingredient used to raise fiber content and change texture.'
    whatItIs = 'A concentrated fiber source, often separated from plants and added back into the recipe.'
    whatItDoes = 'Adds bulk, chew, and fiber while helping the product feel more filling.'
    bodyEffect = 'Can help fullness, but larger amounts may cause gas or bloating for sensitive users.'
    whyItMattersYou = 'Good to notice if you track fiber or have a sensitive gut.'
    rating = 'okay'
    ratingReason = 'Functional fiber ingredient; useful but more processed than whole plant foods.'
  } else if (/\b(faba|fava|pea|soy|rice|hemp)\b.*\bprotein\b|\bprotein\b.*\b(faba|fava|pea|soy|rice|hemp)\b/.test(lower)) {
    const source = /\bfaba|fava\b/.test(lower) ? 'faba bean' : /\bpea\b/.test(lower) ? 'pea' : 'plant'
    shortLabel = `${source.charAt(0).toUpperCase()}${source.slice(1)} protein`
    headline = 'Plant protein concentrate.'
    labelDecoder = `Protein separated from ${source}s and added to improve the nutrition profile.`
    whatItIs = `A concentrated ${source}-based protein ingredient, not the whole bean or seed.`
    whatItDoes = 'Raises protein, improves structure, and can make snacks or bars more filling.'
    bodyEffect = 'Usually digests slower than refined carbs, though concentrates can feel heavier for some stomachs.'
    whyItMattersYou = 'Helpful if higher protein is your goal; less relevant if you prioritize only whole-food ingredients.'
    rating = 'okay'
    ratingReason = 'Plant protein concentrate with a useful role but clear processing.'
  } else if (/\bisomaltulose\b/.test(lower)) {
    shortLabel = 'Slow sugar'
    headline = 'Lower-glycemic sweetener.'
    labelDecoder = 'A sugar-type carbohydrate used for sweetness with slower digestion than regular table sugar.'
    whatItIs = 'A processed sweetener made from sucrose, often marketed for steadier energy release.'
    whatItDoes = 'Adds sweetness and carbohydrate energy while keeping texture close to sugar.'
    bodyEffect = 'Still counts as sugar/carbohydrate, but it may raise blood glucose more gradually.'
    whyItMattersYou = 'Most relevant if you are watching sugar load or blood-glucose response.'
    rating = 'okay'
    ratingReason = 'Sweetener with a better glucose profile than standard sugar, but still an added carbohydrate.'
  } else if (/\bmonk\s+fruit\b/.test(lower)) {
    shortLabel = 'High-intensity sweetener'
    headline = 'Sweetener from monk fruit.'
    labelDecoder = 'A very sweet extract used to add sweetness without much sugar.'
    whatItIs = 'A concentrated sweetener extract; tiny amounts can taste very sweet.'
    whatItDoes = 'Boosts sweetness while helping keep sugar grams lower.'
    bodyEffect = 'Usually contributes little sugar, but it can signal a formula built around sweetener engineering.'
    whyItMattersYou = 'Useful for low-sugar goals, but watch the full sweetener stack around it.'
    rating = 'okay'
    ratingReason = 'Low-sugar sweetener; processing concern depends on how many sweeteners are stacked.'
  } else if (/\b(milk|cream|butter|whey|casein|lactose|cheese|yogurt|yoghurt)\b/.test(lower)) {
    shortLabel = 'Dairy ingredient'
    headline = 'Dairy-based ingredient.'
    labelDecoder = 'A dairy ingredient used for creaminess, flavor, protein, fat, or milk solids.'
    whatItIs = 'A milk-derived food ingredient rather than an industrial additive.'
    whatItDoes = 'Adds dairy flavor, richness, body, and texture to the product.'
    bodyEffect = 'Relevant for milk allergy, lactose sensitivity, vegan preferences, and saturated-fat context.'
    whyItMattersYou = 'This is a dairy ingredient, so it directly matters for milk allergy, lactose sensitivity, and dairy-free preferences.'
    rating = 'clean'
    ratingReason = 'Recognizable dairy food ingredient; concern depends mainly on personal dairy restrictions.'
  } else if (/\b(mono|diglyceride|lecithin|polysorbate|carrageenan|xanthan|guar|cellulose gum|emulsifier)\b/.test(lower)) {
    shortLabel = 'Texture additive'
    headline = 'Emulsifier or texture helper.'
    labelDecoder = 'A processing helper used to keep fat, water, and solids blended consistently.'
    whatItIs = 'A functional additive used for texture control rather than core nutrition.'
    whatItDoes = 'Improves smoothness, prevents separation, and helps the product hold its structure over shelf life.'
    bodyEffect = 'Usually present in small amounts, but it is a processing signal if you prefer simpler formulas.'
    whyItMattersYou = 'Worth noticing when you are comparing a simple ingredient list against a more engineered one.'
    rating = 'concerning'
    ratingReason = 'Functional emulsifier category flagged as a processing signal by Fillr.'
  } else if (/\b(sodium citrate|citric acid|citrate|phosphate|carbonate|bicarbonate)\b/.test(lower)) {
    shortLabel = 'Acidity/stability helper'
    headline = 'Acidity and texture control ingredient.'
    labelDecoder = 'A mineral salt or acid regulator used to manage acidity, texture, and product stability.'
    whatItIs = 'A standard food-processing helper, not a whole-food ingredient.'
    whatItDoes = 'Helps maintain consistency, melt, tang, or shelf stability depending on the product.'
    bodyEffect = 'Typically low concern in normal amounts, but it does add to the processed-formula signal.'
    whyItMattersYou = 'Mostly useful as a processing clue, not usually the main health driver by itself.'
    rating = 'okay'
    ratingReason = 'Common stabilizing or acidity-control ingredient with moderate processing relevance.'
  } else if (/\b(flavor|flavour|color|colour|dye|red 40|yellow 5|yellow 6|blue 1)\b/.test(lower)) {
    shortLabel = 'Flavor/color system'
    headline = 'Taste or color engineering.'
    labelDecoder = 'A flavoring or coloring line used to make the product taste, smell, or look more consistent.'
    whatItIs = 'A sensory additive rather than a nutrient-dense ingredient.'
    whatItDoes = 'Boosts flavor, aroma, or appearance across production batches.'
    bodyEffect = 'Adds little nutrition and may matter if you avoid artificial colors, flavors, or low-transparency additives.'
    whyItMattersYou = 'A useful signal when you are trying to choose simpler, more transparent products.'
    rating = 'concerning'
    ratingReason = 'Low-transparency sensory additive category flagged as a processing signal.'
  } else if (/\b(sugar|syrup|dextrose|fructose|maltodextrin|glucose|sucrose)\b/.test(lower)) {
    shortLabel = 'Sweetener'
    headline = 'Sweetener or fast carbohydrate.'
    labelDecoder = 'A sweetener or refined carbohydrate used for sweetness, browning, bulk, or texture.'
    whatItIs = 'A concentrated carbohydrate ingredient rather than a whole-food base.'
    whatItDoes = 'Raises sweetness and can make the product more palatable.'
    bodyEffect = 'Can add quick-digesting carbohydrate load, especially when several sweeteners appear together.'
    whyItMattersYou = 'Most important if you track sugar, blood-glucose swings, or daily snack frequency.'
    rating = 'okay'
    ratingReason = 'Common sweetener/refined carbohydrate; impact depends on amount and frequency.'
  }

  return {
    name,
    ingredient_name: name,
    shortLabel,
    whyItMattersBullets: [whatItDoes, whyItMattersYou] as readonly [string, string],
    systemJudgment: whyItMattersYou,
    impactForYou: whyItMattersYou,
    profileAnchor: key,
    actionability: rating === 'concerning' ? 'limit' : 'okay',
    intelligenceConfidence: 'medium',
    headline,
    labelDecoder,
    whatItIs,
    whatItDoes,
    bodyEffect,
    funFact: 'This explanation was generated locally because live AI enrichment did not return in time.',
    whyItMattersYou,
    rating,
    ratingReason,
    contextStat: '',
    ratingSource: 'deterministic',
    from_cache: false,
    ...(ingredientAnalysisItemFailsGenericGate({
      name,
      ingredient_name: name,
      shortLabel,
      headline,
      labelDecoder,
      whatItIs,
      whatItDoes,
      bodyEffect,
      funFact: '',
      whyItMattersYou,
      ratingReason,
      contextStat: '',
      rating,
    })
      ? { decodeStatus: 'unavailable' as const }
      : {}),
  }
}

function buildLocalFallbackAnalysis(
  labelOrder: string[],
  batch: CacheBatchResult,
  patternSignals: ReturnType<typeof detectProductPatterns>,
  nutritionJson: Record<string, unknown> | undefined,
  profile: DietaryProfile,
  productCategory?: ProductCategory
): ProductIngredientAnalysisResponse {
  const ingredients = labelOrder.map((labelName) => {
    const templated = buildIngredientTemplateItem(labelName)
    if (templated) return templated

    const key = normalizeIngredientName(labelName)
    const row = key ? batch.cached.get(key) : null
    if (row) return padTranslatorFields(knowledgeRowToAnalysisItem(row, labelName))

    return buildLocalFallbackAnalysisItem(labelName)
  })

  const fallback: ProductIngredientAnalysisResponse = {
    productVerdict: 'This product was decoded locally because live AI enrichment did not return in time.',
    productAnalysis: {} as ProductAnalysis,
    ingredients,
  }
  applyDeterministicPipeline(fallback, labelOrder.join(', '), profile, productCategory)
  fallback.productAnalysis = composeDeterministicProductSummary(
    fallback.ingredients,
    patternSignals,
    nutritionJson,
    fallback.productAnalysis,
    productCategory
  )
  fallback.productVerdict = composeDeterministicProductVerdict(
    fallback.ingredients,
    patternSignals,
    nutritionJson,
    productCategory
  )
  return enforcePersonalizedCopy(fallback, profile)
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
    /** Cap parallel per-line OpenAI repairs (barcode enrich uses a small number). */
    maxRepairJobs?: number
    /** Resolve templates + shared cache only; return null if any line still needs OpenAI. */
    localOnly?: boolean
  }
): Promise<ProductIngredientAnalysisResponse | null> {
  const devDecodeLog = (stage: string, extra?: Record<string, unknown>) => {
    if (!__DEV__) return
    console.log('[Fillr][decode]', stage, extra ?? {})
  }
  const t0 = Date.now()
  const profile = dietaryProfile ?? EMPTY_DIETARY
  const systemContent =
    INGREDIENT_ANALYSIS_SYSTEM_PROMPT + buildPersonalizationSystemAppend(profile)
  const compactSystemContent = buildCompactIngredientAnalysisSystemPrompt(profile)
  const parseSource: IngredientTextParseSource =
    options?.ingredientParseSource ?? (options?.fromOcr ? 'ocr' : 'barcode')
  const cleanedLabel = prepareIngredientTextForAnalysis(ingredientsList)
  const ingredientNames = parseIngredients(ingredientsList, parseSource)
  devDecodeLog('decode_request_started', {
    parseSource,
    ingredientCount: ingredientNames.length,
    hasNutrition: Boolean(options?.nutritionJson),
  })
  const patternSignals = detectProductPatterns(ingredientNames, options?.nutritionJson)
  const normalizedIngredientNames = ingredientNames.map((n) => normalizeIngredientName(n))
  const productCategory = detectProductCategoryFromSignals(cleanedLabel, normalizedIngredientNames)
  const nutritionAppend = formatNutritionJsonForPrompt(options?.nutritionJson)
  const detectedPatternsAppend = formatDetectedPatternsForPrompt(patternSignals)
  const contextAppend = `${nutritionAppend}${detectedPatternsAppend}`
  if (ingredientNames.length === 0) return null

  const templateKeys = new Set<string>()
  const nonTemplateNames: string[] = []
  let templateHitCount = 0
  for (const name of ingredientNames) {
    const templated = buildIngredientTemplateItem(name)
    if (templated) {
      templateHitCount++
      templateKeys.add(normalizeIngredientName(name))
    } else {
      nonTemplateNames.push(name)
    }
  }

  const cacheLookupStarted = Date.now()
  const batch = await getIngredientsFromCacheBatch(nonTemplateNames)
  const cacheLookupLatencyMs = Date.now() - cacheLookupStarted
  let cacheHitCount = 0
  for (const name of nonTemplateNames) {
    const k = normalizeIngredientName(name)
    if (k && batch.cached.has(k)) cacheHitCount++
  }
  const unknownNames = batch.uncached
  const unknownNamesForPrompt = unknownNames.map((n) => mapIngredientNameForLookup(n))
  const hasUnmappedFrenchLikeName = unknownNames.some((name, idx) => {
    const mapped = unknownNamesForPrompt[idx]
    return mapped === name && looksLikeFrenchIngredientName(name)
  })
  const aiAnalyzedCount = unknownNames.length
  const skippedCount = templateHitCount + cacheHitCount
  const baseMetrics = {
    event: 'ingredient_scan_metrics',
    stage: 'routing',
    model: '',
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    totalLatencyMs: 0,
    ocrLatencyMs: 0,
    cacheLookupLatencyMs,
    aiLatencyMs: 0,
    ingredientCount: ingredientNames.length,
    cacheHitCount,
    templateHitCount,
    aiIngredientCount: aiAnalyzedCount,
  }

  if (options?.localOnly && aiAnalyzedCount > 0) {
    return null
  }

  if (aiAnalyzedCount === 0) {
    devDecodeLog('decode_cache_only', {
      ingredientCount: ingredientNames.length,
      cacheHitCount,
      templateHitCount,
    })
    const ingredients = mergeTemplateCacheAndAiItems(ingredientNames, batch, new Map<string, IngredientAnalysisItem[]>())
    markItemsFromCacheFlag(ingredients, batch)
    const fromTemplateOrCache: ProductIngredientAnalysisResponse = {
      productVerdict:
        'These ingredient lines were resolved locally from Fillr templates and shared ingredient knowledge.',
      productAnalysis: {} as ProductAnalysis,
      ingredients,
      ...(templateHitCount === 0 && cacheHitCount === ingredientNames.length
        ? { _fillrIngredientDecodeMeta: { allIngredientsFromCache: true } }
        : {}),
    }
    applyDeterministicPipeline(fromTemplateOrCache, cleanedLabel, profile, productCategory)
    const composed = composeDeterministicProductSummary(
      fromTemplateOrCache.ingredients,
      patternSignals,
      options?.nutritionJson,
      fromTemplateOrCache.productAnalysis,
      productCategory
    )
    fromTemplateOrCache.productAnalysis = composed
    fromTemplateOrCache.productVerdict = composeDeterministicProductVerdict(
      fromTemplateOrCache.ingredients,
      patternSignals,
      options?.nutritionJson,
      productCategory
    )
    console.log(
      JSON.stringify({
        ...baseMetrics,
        totalLatencyMs: Date.now() - t0,
        stage: 'cache_template_only',
      })
    )
    return enforcePersonalizedCopy(fromTemplateOrCache, profile)
  }

  const ocrPrePartial = options?.fromOcr ? OCR_INGREDIENT_ANALYSIS_PREFIX : ''
  const partialUser =
    ocrPrePartial +
    buildPartialIngredientAnalysisUserPrompt(unknownNamesForPrompt, contextAppend, {
      productCategory,
      hasUnmappedFrenchLikeName,
    })
  const quick = options?.skipIngredientRepair === true
  const partialMaxTokens = Math.min(
    SCAN_AI_MAX_TOKENS,
    PARTIAL_AI_BASE_TOKENS + unknownNames.length * PARTIAL_AI_PER_ING_TOKENS
  )
  const timeoutMs = options?.requestTimeoutMs ?? (quick ? SCAN_AI_TIMEOUT_MS : 55_000)
  const requestedMax = options?.maxTokens ?? MAX_TOKENS
  const maxTokens = Math.min(requestedMax, partialMaxTokens)

  const { parsed: parsedPartial, meta: aiMeta } = await requestIngredientAnalysisJson(partialUser, compactSystemContent, {
    timeoutMs,
    maxTokens,
  })
  devDecodeLog('decode_http_result', {
    latencyMs: aiMeta.latencyMs,
    model: aiMeta.model ?? 'unknown',
    failureReason: aiMeta.failureReason ?? null,
    parsed: Boolean(parsedPartial),
  })
  if (!parsedPartial || !Array.isArray(parsedPartial.ingredients)) {
    console.warn(
      `[Fillr] ingredient-analysis unavailable; using local fallback for ${ingredientNames.length} ingredients`
    )
    devDecodeLog('decode_fallback_reason', {
      reason: aiMeta.failureReason ?? 'parsed_partial_invalid',
      ingredientCount: ingredientNames.length,
    })
    return buildLocalFallbackAnalysis(
      ingredientNames,
      batch,
      patternSignals,
      options?.nutritionJson,
      profile,
      productCategory
    )
  }

  let partialFixed = parsedPartial
  if (productVerdictInvalid(partialFixed.productVerdict)) {
    partialFixed = {
      ...partialFixed,
      productVerdict:
        'These ingredient lines were decoded for this product—see each card below for plain-English detail.',
    }
  }

  const aiByKey = new Map<string, IngredientAnalysisItem[]>()
  const partialRows = partialFixed.ingredients.slice(0, unknownNamesForPrompt.length)
  const greedyAssignment = assignLabelsToAiItemsGreedy(unknownNamesForPrompt, partialRows)
  const assignedAiIndices = new Set<number>()
  for (let li = 0; li < unknownNamesForPrompt.length; li++) {
    const labelName = unknownNamesForPrompt[li]
    const aiIdx = greedyAssignment.get(li)
    if (aiIdx == null || aiIdx < 0 || aiIdx >= partialRows.length) continue
    assignedAiIndices.add(aiIdx)
    const key = normalizeIngredientName(labelName)
    const item = partialRows[aiIdx]
    if (!key || !item) continue
    const q = aiByKey.get(key)
    if (q) q.push(item)
    else aiByKey.set(key, [item])
  }
  const missingNames = unknownNamesForPrompt.filter((name, li) => {
    const key = normalizeIngredientName(name)
    return !key || !aiByKey.has(key)
  })
  if (missingNames.length > 0) {
    console.warn(
      `[Fillr] partial decode missing ${missingNames.length}/${unknownNamesForPrompt.length} ingredient rows; repairing`
    )
  }
  const repairedMissingRows = await Promise.all(
    missingNames.map((missingName) =>
      repairIngredientLineWithOpenAI(missingName, ingredientsList, systemContent).then((row) => ({
        missingName,
        row,
      }))
    )
  )
  for (const { missingName, row: repairedMissing } of repairedMissingRows) {
    if (!repairedMissing) continue
    const key = normalizeIngredientName(missingName)
    if (!key) continue
    const q = aiByKey.get(key)
    if (q) q.push(repairedMissing)
    else aiByKey.set(key, [repairedMissing])
  }

  const mergedItems = mergeTemplateCacheAndAiItems(ingredientNames, batch, aiByKey)
  markItemsFromCacheFlag(mergedItems, batch)
  let parsed: ProductIngredientAnalysisResponse = {
    productVerdict: partialFixed.productVerdict,
    ingredients: mergedItems,
    productAnalysis: partialFixed.productAnalysis ?? ({} as ProductAnalysis),
  }
  const repairAllowedKeys = new Set(unknownNames.map((n) => normalizeIngredientName(n)).filter(Boolean))
  const maxRepairJobs = options?.maxRepairJobs ?? (quick ? 0 : MAX_REPAIR_ATTEMPTS * 12)
  let repaired = quick
    ? parsed
    : await validateAndRepairIngredients(
        parsed,
        ingredientsList,
        systemContent,
        repairAllowedKeys,
        maxRepairJobs
      )
  const validation = validateIngredientAnalysisOutput(ingredientNames, repaired)
  if (validation.failedRowNames.length > 0 && maxRepairJobs > 0) {
    const forceRepairKeys = new Set(
      validation.failedRowNames.map((n) => normalizeIngredientName(n)).filter(Boolean)
    )
    repaired = await validateAndRepairIngredients(
      repaired,
      ingredientsList,
      systemContent,
      forceRepairKeys,
      Math.min(maxRepairJobs, validation.failedRowNames.length)
    )
  }
  applyDeterministicPipeline(repaired, cleanedLabel, profile, productCategory)
  devDecodeLog('decode_parsed_ok', {
    ingredientRows: repaired.ingredients.length,
    totalLatencyMs: Date.now() - t0,
  })
  repaired.productAnalysis = composeDeterministicProductSummary(
    repaired.ingredients,
    patternSignals,
    options?.nutritionJson,
    repaired.productAnalysis,
    productCategory
  )
  repaired.productVerdict = composeDeterministicProductVerdict(
    repaired.ingredients,
    patternSignals,
    options?.nutritionJson,
    productCategory
  )
  const cacheWriteTasks: Promise<void>[] = []
  for (const item of repaired.ingredients) {
    const key = normalizeIngredientName(item.name)
    const shouldSkip =
      !key ||
      item.from_cache === true ||
      templateKeys.has(key) ||
      ingredientParseLooksInvalid(item) ||
      ingredientAnalysisItemFailsGenericGate(item)
    if (shouldSkip) continue
    cacheWriteTasks.push(saveIngredientToCache(analysisItemToSaveInput(item)))
  }
  if (cacheWriteTasks.length > 0) {
    void Promise.allSettled(cacheWriteTasks)
  }
  console.log(
    JSON.stringify({
      ...baseMetrics,
      stage: 'ai_partial',
      model: aiMeta.model ?? '',
      promptTokens: aiMeta.promptTokens ?? 0,
      completionTokens: aiMeta.completionTokens ?? 0,
      totalTokens: aiMeta.totalTokens ?? 0,
      aiLatencyMs: aiMeta.latencyMs,
      totalLatencyMs: Date.now() - t0,
    })
  )
  return enforcePersonalizedCopy(repaired, profile)
}

const POST_MERGE_REPAIR_VERDICT_STUB =
  'This product scan includes ingredient lines that were individually refreshed when the first pass needed a clearer decode.'

/**
 * Second pass after merge: re-fetch any card that still looks like template / filler / empty decode.
 * By default attempts up to one repair per ingredient line (capped at 200 for extreme lists).
 */
export async function repairScanIngredientBreakdownGaps(
  scan: ScanResult,
  ingredientsList: string,
  dietaryProfile: DietaryProfile | null,
  options?: { maxRepairs?: number }
): Promise<ScanResult> {
  const n = scan.ingredientBreakdown.length
  const defaultMax = n > 0 ? n : 1
  const maxRepairs = Math.min(options?.maxRepairs ?? defaultMax, 200)
  const profile = dietaryProfile ?? EMPTY_DIETARY
  const systemContent =
    INGREDIENT_ANALYSIS_SYSTEM_PROMPT + buildPersonalizationSystemAppend(profile)
  const cleanedLabel = prepareIngredientTextForAnalysis(ingredientsList)
  const productCategory = detectProductCategoryFromSignals(
    cleanedLabel,
    parseIngredients(ingredientsList, 'barcode').map((n) => normalizeIngredientName(n))
  )
  const breakdown = [...scan.ingredientBreakdown]
  let repairedCount = 0

  for (let i = 0; i < breakdown.length && repairedCount < maxRepairs; i++) {
    const prev = breakdown[i]
    if (!ingredientExplanationFailsQualityGate(prev)) continue
    const labelName = (prev.name ?? '').trim() || `line_${i}`
    const row = await repairIngredientLineWithOpenAI(labelName, ingredientsList, systemContent)
    if (!row) continue

    const wrapped: ProductIngredientAnalysisResponse = {
      productVerdict: POST_MERGE_REPAIR_VERDICT_STUB,
      ingredients: [row],
    }
    applyDeterministicPipeline(wrapped, cleanedLabel, profile, productCategory)
    const item = wrapped.ingredients[0]
    if (!item || ingredientParseLooksInvalid(item) || ingredientAnalysisItemFailsGenericGate(item)) {
      continue
    }
    breakdown[i] = ensureDistinctIngredientExplanation(aiItemToExplanation(item, labelName))
    repairedCount++
  }

  return { ...scan, ingredientBreakdown: breakdown }
}

export function mergeAiAnalysisWithScan(
  ai: ProductIngredientAnalysisResponse,
  base: ScanResult
): ScanResult {
  let ingredients = mergeAiBreakdownWithLabel(base, ai)

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
  const productCategory = detectProductCategoryFromSignals(
    fullLabelHaystack,
    breakdown.map((i) => normalizeIngredientName(i.name))
  )
  corrected = applyNuclearForceRatings(corrected, fullLabelHaystack, productCategory)
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

/**
 * Fast-scan path wipes copy until OpenAI returns. If enrich never fills `whatItIs`,
 * use honest offline copy (not encyclopedia filler).
 */
function hydrateEmptyIngredientExplanations(ing: IngredientExplanation): IngredientExplanation {
  // Keep explicit pending state untouched so UI shows "Decoding..." while AI is still in flight.
  if (ing.aiDecodePending) return ing
  if (ing.whatItIs?.trim()) return ing
  const template = buildIngredientTemplateItem(ing.name)
  const base = template
    ? aiItemToExplanation(template, ing.name)
    : createOfflineOrTimeoutIngredientExplanation(ing.name)
  return {
    ...base,
    name: ing.name,
    ingredientRating: ing.ingredientRating ?? base.ingredientRating,
    verdict: ing.verdict ?? base.verdict,
    personalizedNote: ing.personalizedNote,
    personalMessage: ing.personalMessage,
    personalFlag: ing.personalFlag,
    sourceAmbiguity: ing.sourceAmbiguity,
    ratingSource: ing.ratingSource ?? base.ratingSource,
    ratingOverridden: ing.ratingOverridden,
    shortLabel: ing.shortLabel,
    whyItMattersBullets: ing.whyItMattersBullets,
    systemJudgment: ing.systemJudgment,
    impactForYou: ing.impactForYou,
    intelligenceConfidence: ing.intelligenceConfidence,
    ingredientDecodeStatus: base.ingredientDecodeStatus,
    aiDecodePending: false,
  }
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
    const base = amb ? { ...ing, sourceAmbiguity: amb } : ing
    const hydrated = ensureDistinctIngredientExplanation(hydrateEmptyIngredientExplanations(base))
    return {
      ...hydrated,
      quickSummary: buildQuickSummaryFallback({
        name: hydrated.name,
        quickSummary: hydrated.quickSummary,
        headline: hydrated.headline,
        labelDecoder: hydrated.labelDecoder,
        whyItMatters: hydrated.whyItMatters,
        ratingReason: hydrated.ratingReason,
      }),
    }
  })
  const productVerdict =
    result.productVerdict ??
    buildLocalProductVerdict(resorted, result.product.name, result.matchedAllergens)
  const withAllergenCopy = applyAllergenPersonalizedProductCopy({
    ...result,
    productVerdict,
    ingredientBreakdown: resorted,
  })
  return applySensitivityPersonalizedProductCopy(withAllergenCopy)
}
