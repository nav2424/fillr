// Evidence-based Allergen Detection Engine
// Deterministic, no AI, every alert cites exact match + source
// Never mark SAFE when ingredients are missing → UNKNOWN
// EXCEPTION: Plain water is scientifically impossible to be allergenic → always SAFE

import type {
  DetectionInput,
  DetectionOutput,
  UserAllergenConfig,
  CustomAllergenRule,
  MatchedAllergen,
} from './types'
import { parseSections } from './textParser'
import { runMatching } from './matcher'
import { BUILTIN_ALLERGENS, getBuiltinById } from './builtinDictionary'
import { getProductNameHints } from './productNameHints'

export type { DetectionOutput, MatchedAllergen, OverallStatus, UserAllergenConfig } from './types'
export { BUILTIN_ALLERGENS, getBuiltinById } from './builtinDictionary'

/** Map user allergy strings to our builtin IDs */
const USER_ALLERGY_TO_BUILTIN: Record<string, string> = {
  'milk': 'milk', 'dairy': 'milk', 'lactose': 'milk',
  'egg': 'eggs', 'eggs': 'eggs',
  'wheat': 'wheat', 'gluten': 'wheat',
  'soy': 'soy', 'soya': 'soy', 'soybean': 'soy',
  'peanut': 'peanuts', 'peanuts': 'peanuts',
  'tree_nuts': 'tree_nuts', 'tree nut': 'tree_nuts', 'nuts': 'tree_nuts',
  'fish': 'fish', 'shellfish': 'shellfish',
  'sesame': 'sesame', 'mustard': 'mustard', 'sulfites': 'sulfites',
  'sulphites': 'sulfites', 'celery': 'celery', 'lupin': 'lupin', 'lupine': 'lupin',
}

/** Build UserAllergenConfig from user's raw allergies array */
export function buildUserAllergenConfig(allergies: string[]): UserAllergenConfig {
  const builtin_ids: string[] = []
  const custom_rules: CustomAllergenRule[] = []

  for (const a of allergies) {
    const norm = a.toLowerCase().trim().replace(/\s+/g, '_')
    const builtinId = USER_ALLERGY_TO_BUILTIN[norm] ?? (getBuiltinById(norm) ? norm : null)
    if (builtinId && !builtin_ids.includes(builtinId)) {
      builtin_ids.push(builtinId)
    } else if (!builtinId) {
      custom_rules.push({
        id: `custom_${norm.replace(/[^a-z0-9_]/g, '')}`,
        name: a,
        match_mode: 'EXACT_PHRASE',
        terms: [a],
        enabled_sections: ['ingredients', 'contains', 'may_contain'],
        severity_level: 'allergy',
      })
    }
  }
  return { builtin_ids, custom_rules }
}

/** Map OFF tags to our built-in IDs */
const OFF_TAG_TO_ID: Record<string, string> = {
  'milk': 'milk', 'en:milk': 'milk', 'fr:lait': 'milk',
  'eggs': 'eggs', 'en:eggs': 'eggs', 'fr:oeufs': 'eggs',
  'wheat': 'wheat', 'en:wheat': 'wheat', 'fr:ble': 'wheat',
  'gluten': 'wheat', 'en:gluten': 'wheat',
  'soy': 'soy', 'en:soybeans': 'soy', 'en:soy': 'soy', 'fr:soja': 'soy',
  'peanuts': 'peanuts', 'en:peanuts': 'peanuts', 'fr:arachides': 'peanuts',
  'tree-nuts': 'tree_nuts', 'en:tree-nuts': 'tree_nuts', 'en:cashews': 'tree_nuts',
  'en:almonds': 'tree_nuts', 'en:walnuts': 'tree_nuts', 'en:hazelnuts': 'tree_nuts',
  'fish': 'fish', 'en:fish': 'fish', 'fr:poisson': 'fish',
  'shellfish': 'shellfish', 'en:shellfish': 'shellfish',
  'sesame': 'sesame', 'en:sesame-seeds': 'sesame', 'en:sesame': 'sesame', 'fr:sesame': 'sesame',
}

function normalizeOFFTag(tag: string): string | null {
  const plain = tag.replace(/^[a-z]{2}:/, '').toLowerCase().replace(/-/g, '_')
  return OFF_TAG_TO_ID[tag] ?? OFF_TAG_TO_ID[plain] ?? (BUILTIN_ALLERGENS.some(b => b.id === plain) ? plain : null)
}

/** One row per built-in allergen: merge OFF tags + text evidence; prefer CONTAINS over MAY_CONTAIN. */
function dedupeMatchedAllergens(matches: MatchedAllergen[]): MatchedAllergen[] {
  const byId = new Map<string, MatchedAllergen>()
  const rank = (s: MatchedAllergen['severity']) => (s === 'CONTAINS' ? 0 : 1)

  for (const m of matches) {
    const cur = byId.get(m.allergen_id)
    if (!cur) {
      byId.set(m.allergen_id, { ...m })
      continue
    }
    const winner =
      rank(m.severity) < rank(cur.severity) ? m : rank(m.severity) > rank(cur.severity) ? cur : cur
    const loser = winner === m ? cur : m
    const parts = new Set<string>()
    for (const blob of [winner.match_text, loser.match_text]) {
      for (const bit of String(blob ?? '')
        .split(/\s*·\s*/)
        .map((x) => x.trim())
        .filter(Boolean)) {
        parts.add(bit)
      }
    }
    byId.set(m.allergen_id, {
      ...winner,
      severity: rank(winner.severity) <= rank(loser.severity) ? winner.severity : loser.severity,
      match_text: [...parts].join(' · '),
    })
  }
  return [...byId.values()]
}

/**
 * Plain water products (bottled, mineral, spring, etc.) have zero allergens.
 * It is scientifically impossible to be allergic to water. Always return SAFE.
 * Shared by BarcodeService and allergen engine for consistency.
 */
export function isPlainWaterProduct(productName: string): boolean {
  if (!productName?.trim()) return false
  const n = productName.toLowerCase().trim()
  const hasWater = /\b(water|eau|aqua|agua|wasser|voda|mineral water|spring water|sparkling water|seltzer|carbonated water|mineralwasser|purified water|distilled water|drinking water|still water|aquafina|evian|dasani|smartwater)\b/.test(n)
  const hasExclusions = /\b(flavor|flavoured|flavored|juice|soda|lemonade|vitamin|electrolyte|sports drink|energy drink|iced tea|coffee|tea|coconut|coco|fruit)\b/.test(n)
  return hasWater && !hasExclusions
}

/**
 * Ingredients list is ONLY water (no additives). Safe for allergies.
 */
function isIngredientsOnlyWater(ingredientsText: string): boolean {
  const cleaned = ingredientsText.toLowerCase().replace(/^(ingredients?|ingrédients?)\s*[:\.]\s*/i, '').trim()
  return /^(water|eau|aqua|h2o|agua)$/.test(cleaned)
}

/**
 * Main detection function - evidence-based, deterministic.
 * NEVER returns SAFE when ingredients_text is missing/empty.
 * EXCEPTION: Plain water (by product name or ingredients-only-water) → always SAFE.
 */
export function detectAllergensEvidenceBased(
  input: DetectionInput,
  userConfig: UserAllergenConfig
): DetectionOutput {
  const { builtin_ids, custom_rules } = userConfig
  const enabledBuiltinIds = builtin_ids.filter(id => getBuiltinById(id))

  // 0. PLAIN WATER: Always SAFE (even with no ingredient data).
  if (input.product_name && isPlainWaterProduct(input.product_name)) {
    return {
      overall_status: 'SAFE',
      matched_allergens: [],
      scan_log: {
        ingredients_text_used: input.ingredients_text || '',
        contains_text_used: input.contains_text || '',
        may_contain_text_used: input.may_contain_text || '',
        has_ingredient_data: true,
        source_coverage_score: 100,
      },
    }
  }

  // 0b. Ingredients list is ONLY water → SAFE (use stripped/card text only)
  const strippedForCards = input.ingredients_text || ''
  if (isIngredientsOnlyWater(strippedForCards)) {
    return {
      overall_status: 'SAFE',
      matched_allergens: [],
      scan_log: {
        ingredients_text_used: strippedForCards,
        contains_text_used: input.contains_text || '',
        may_contain_text_used: input.may_contain_text || '',
        has_ingredient_data: true,
        source_coverage_score: 100,
      },
    }
  }

  const safetyHaystack = input.ingredients_text_safety?.trim() || ''
  const ingredientsForMatching = safetyHaystack || strippedForCards
  const safetyLog =
    safetyHaystack.length > 0 ? { ingredients_text_safety_used: safetyHaystack } : {}

  // 1. Extract sections — safety haystack keeps parenthetical sub-ingredients for matching
  const parsed = parseSections(ingredientsForMatching)

  // 2. Collect OFF structured matches (CONTAINS / MAY_CONTAIN)
  const offContainsMatches: Array<{ id: string; tag: string }> = []
  if (input.allergens_tags?.length) {
    for (const tag of input.allergens_tags) {
      const id = normalizeOFFTag(tag)
      if (id && enabledBuiltinIds.includes(id)) {
        offContainsMatches.push({ id, tag: tag.replace(/^[a-z]{2}:/, '') })
      }
    }
  }
  const offMayContainMatches: Array<{ id: string; tag: string }> = []
  if (input.traces_tags?.length) {
    for (const tag of input.traces_tags) {
      const id = normalizeOFFTag(tag)
      if (id && enabledBuiltinIds.includes(id)) {
        offMayContainMatches.push({ id, tag: tag.replace(/^[a-z]{2}:/, '') })
      }
    }
  }

  // 3. Add ingredients from structured arrays if text empty
  if (!parsed.ingredients_text.trim() && input.ingredients?.length) {
    parsed.ingredients_text = input.ingredients
      .map(i => i.text)
      .filter(Boolean)
      .join(', ')
  }
  if (!parsed.ingredients_text.trim() && input.ingredients_tags?.length) {
    parsed.ingredients_text = input.ingredients_tags
      .map(t => t.replace(/^[a-z]{2}:/, ''))
      .join(', ')
  }
  if (!parsed.contains_text.trim() && input.contains_text?.trim()) {
    parsed.contains_text = input.contains_text.trim()
  }
  if (!parsed.may_contain_text.trim() && input.may_contain_text?.trim()) {
    parsed.may_contain_text = input.may_contain_text.trim()
  }

  const hasIngredientData = Boolean(
    parsed.ingredients_text.trim() ||
    parsed.contains_text.trim() ||
    parsed.may_contain_text.trim() ||
    (input.allergens_tags?.length ?? 0) > 0 ||
    (input.traces_tags?.length ?? 0) > 0
  )

  // Coverage score: +60 ingredients_text, +20 allergens_tags, +10 traces_tags, +10 structured ingredients
  const coverageScore = (() => {
    let s = 0
    if (parsed.ingredients_text.trim()) s += 60
    if ((input.allergens_tags?.length ?? 0) > 0) s += 20
    if ((input.traces_tags?.length ?? 0) > 0) s += 10
    if ((input.ingredients?.length ?? 0) > 0 || (input.ingredients_tags?.length ?? 0) > 0) s += 10
    return s
  })()

  // 4. FAILSAFE: No ingredient data → UNKNOWN (never SAFE)
  if (!hasIngredientData) {
    const product_name_hints = getProductNameHints(input.product_name, enabledBuiltinIds)
    return {
      overall_status: 'UNKNOWN',
      matched_allergens: [],
      product_name_hints: product_name_hints.length > 0 ? product_name_hints : undefined,
      scan_log: {
        ingredients_text_used: strippedForCards,
        ...safetyLog,
        contains_text_used: parsed.contains_text,
        may_contain_text_used: parsed.may_contain_text,
        has_ingredient_data: false,
        source_coverage_score: coverageScore,
      },
      fallback_ctas: {
        scan_label_photo: true,
        paste_ingredients_manually: true,
      },
    }
  }

  // 5. Run deterministic matching on text sections
  const textMatches = runMatching(parsed, enabledBuiltinIds, custom_rules)

  // 6. Merge OFF structured matches into matched_allergens
  for (const m of offContainsMatches) {
    const builtin = getBuiltinById(m.id)
    if (!builtin) continue
    textMatches.push({
      allergen_id: m.id,
      allergen_name: builtin.name,
      severity: 'CONTAINS',
      section: 'contains',
      match_text: m.tag,
    })
  }
  for (const m of offMayContainMatches) {
    const builtin = getBuiltinById(m.id)
    if (!builtin) continue
    textMatches.push({
      allergen_id: m.id,
      allergen_name: builtin.name,
      severity: 'MAY_CONTAIN',
      section: 'may_contain',
      match_text: m.tag,
    })
  }

  // 7. Decide overall status
  const hasContains = textMatches.some(m => m.severity === 'CONTAINS')
  const hasMayContain = textMatches.some(m => m.severity === 'MAY_CONTAIN')

  const overall_status: DetectionOutput['overall_status'] =
    hasContains ? 'CONTAINS'
      : hasMayContain ? 'MAY_CONTAIN'
        : 'SAFE'

  // 8. Return output (dedupe: same allergen from ingredients + Contains: line + OFF tags)
  return {
    overall_status,
    matched_allergens: dedupeMatchedAllergens(textMatches),
    scan_log: {
      ingredients_text_used: strippedForCards,
      ...safetyLog,
      contains_text_used: parsed.contains_text,
      may_contain_text_used: parsed.may_contain_text,
      has_ingredient_data: true,
      source_coverage_score: coverageScore,
    },
  }
}

