/**
 * Personalization Engine
 * Filters and adapts scan results based on user's allergies, sensitivities, preferences, and goals
 */

import type {
  ScanResult,
  MatchedAllergen,
  MatchedSensitivity,
  SafetyStatus,
  CeliacResult,
} from '../types'
import { SENSITIVITY_OPTIONS } from '../types'
import { PREFERENCE_SIGNALS, SENSITIVITY_SIGNALS } from './profileSignals'
import {
  buildUserAllergenConfig,
  detectAllergensEvidenceBased,
  type MatchedAllergen as EngineMatchedAllergen,
} from './allergenEngine'
import { getCeliacSeverity, runCeliacCheck } from './allergenEngine/matcher'
import { englishPrimarySegment } from './bilingualDisplay'
import { getIngredientExplanation } from '../services/ingredientExplanations'

export interface UserProfile {
  allergies: string[]
  sensitivities: string[]
  preferences: string[]
  goal: string
  celiacStrictGluten?: boolean
}

function normalizeSensitivityKey(raw: string): string {
  const key = String(raw || '').toLowerCase().trim().replace(/\s+/g, '_')
  if (SENSITIVITY_SIGNALS[key]) return key
  const byLabel = SENSITIVITY_OPTIONS.find((o) => o.label.toLowerCase() === String(raw || '').toLowerCase().trim())
  return byLabel?.key ?? key
}

/** Check if ingredient text contains any of the given terms */
function ingredientMatchesPattern(ingredientText: string, pattern: RegExp): boolean {
  return pattern.test(ingredientText)
}

/** Find which sensitivities match the product's ingredients */
function matchSensitivities(
  ingredientText: string,
  userSensitivities: string[]
): MatchedSensitivity[] {
  const matches: MatchedSensitivity[] = []

  for (const rawKey of userSensitivities) {
    const key = normalizeSensitivityKey(rawKey)
    const signal = SENSITIVITY_SIGNALS[key]
    if (!signal) continue

    const ingredients = ingredientText.split(/[,;]/).map((s) => s.trim())
    for (const ing of ingredients) {
      if (ingredientMatchesPattern(ing, signal.ingredientPattern)) {
        const opt = SENSITIVITY_OPTIONS.find((o) => o.key === key)
        matches.push({
          sensitivityKey: key,
          sensitivityName: opt?.label ?? key,
          matchedIngredient: ing,
          explanation: getSensitivityExplanation(key, ing),
        })
        break
      }
    }
  }

  return matches
}

function getSensitivityExplanation(key: string, ingredient: string): string {
  const explanations: Record<string, string> = {
    lactose: 'Contains lactose or dairy. If you have lactose intolerance, you may want to limit or avoid.',
    gluten_sensitivity: 'Contains gluten or gluten-containing grains. Consider if you need to avoid.',
    artificial_sweeteners: 'Contains artificial sweeteners. Some people prefer to avoid these.',
    high_sodium: 'Contains sodium. If you\'re watching sodium intake, check the nutrition label.',
    msg: 'Contains MSG or glutamate. Some people are sensitive to these.',
    sulfites: 'Contains sulfites. Some people are sensitive to sulfites.',
    caffeine: 'Contains caffeine or common caffeine sources. Consider if you limit stimulants.',
    fructose: 'Contains fructose or high-fructose inputs. Relevant if you malabsorb fructose.',
    histamine: 'May be histamine-relevant (fermented / aged / preserved cues on the label).',
    nightshades: 'Contains nightshade-family ingredients (e.g. tomato, potato, pepper).',
    fodmaps: 'Contains ingredients often flagged on low-FODMAP diets (check tolerance).',
  }
  return explanations[key] ?? `Relevant for your ${key} sensitivity.`
}

/** Filter allergens to only those in user's allergy list */
function filterAllergensForUser(
  matchedAllergens: MatchedAllergen[],
  userAllergies: string[]
): MatchedAllergen[] {
  if (userAllergies.length === 0) return []
  const userSet = new Set(userAllergies.map((a) => a.toLowerCase()))
  return matchedAllergens.filter((m) => userSet.has(m.allergenKey.toLowerCase()))
}

/** One UI row per profile allergen key (merges bilingual / multi-line evidence). */
function dedupeMatchedAllergensForProfile(rows: MatchedAllergen[]): MatchedAllergen[] {
  const m = new Map<string, MatchedAllergen>()
  for (const row of rows) {
    const k = row.allergenKey.toLowerCase()
    const ex = m.get(k)
    if (!ex) {
      m.set(k, { ...row })
      continue
    }
    const parts = new Set<string>()
    for (const blob of [ex.matchedIngredient, row.matchedIngredient]) {
      for (const bit of String(blob ?? '')
        .split(/\s*·\s*/)
        .map((x) => x.trim())
        .filter(Boolean)) {
        parts.add(bit)
      }
    }
    m.set(k, {
      ...ex,
      matchedIngredient: [...parts].join(' · '),
    })
  }
  return [...m.values()]
}

/** Determine safety status based on user-specific matches */
function computeSafetyStatus(
  hasMatchedAllergens: boolean,
  hasHardPreferenceConflict: boolean,
  hasSoftPreferenceConflict: boolean,
  hasMatchedSensitivities: boolean,
  hasIngredientData: boolean
): SafetyStatus {
  if (hasMatchedAllergens) return 'UNSAFE'
  if (hasHardPreferenceConflict) return 'UNSAFE'
  if (hasSoftPreferenceConflict) return 'CAUTION'
  if (hasMatchedSensitivities) return 'CAUTION'
  if (!hasIngredientData) return 'UNKNOWN'
  return 'SAFE'
}

function normalizePreferenceKey(raw: string): string {
  return String(raw || '').toLowerCase().trim().replace(/[\s-]+/g, '_')
}

function classifyPreferenceConflicts(
  profile: UserProfile,
  ingredientText: string
): { hasHardConflict: boolean; hasSoftConflict: boolean } {
  const hardSafetyPreferences = new Set(['vegan', 'vegetarian', 'plant_based', 'halal', 'kosher'])
  let hasHardConflict = false
  let hasSoftConflict = false
  for (const rawKey of profile.preferences ?? []) {
    const key = normalizePreferenceKey(rawKey)
    const signal = PREFERENCE_SIGNALS[key]
    if (!signal?.conflictPattern) continue
    if (!signal.conflictPattern.test(ingredientText)) continue
    if (hardSafetyPreferences.has(key)) hasHardConflict = true
    else hasSoftConflict = true
    if (hasHardConflict && hasSoftConflict) break
  }
  return { hasHardConflict, hasSoftConflict }
}

/** Celiac mode can flag gluten without IgE allergens — fold into stored/list safety. */
export function resolveSafetyStatusWithCeliac(
  status: SafetyStatus,
  profile: Pick<UserProfile, 'celiacStrictGluten'>,
  celiac?: CeliacResult
): SafetyStatus {
  if (!profile.celiacStrictGluten || !celiac?.celiacModeEnabled) return status
  const sev = celiac.celiacSeverity
  if (sev === 'AVOID') return 'UNSAFE'
  if (sev === 'CAUTION') {
    if (status === 'SAFE') return 'CAUTION'
    return status
  }
  return status
}

/** Build personalized smart summary */
function buildSmartSummary(
  base: ScanResult,
  profile: UserProfile,
  filteredAllergens: MatchedAllergen[],
  matchedSensitivities: MatchedSensitivity[]
): string {
  const parts: string[] = []

  if (filteredAllergens.length > 0) {
    const names = [
      ...new Map(filteredAllergens.map((m) => [m.allergenKey.toLowerCase(), m.allergenName])).values(),
    ]
    parts.push(`Not safe for you — contains ${names.map((n) => n.toLowerCase()).join(' and ')} from your allergy list.`)
  }

  if (matchedSensitivities.length > 0 && filteredAllergens.length === 0) {
    parts.push(
      `Heads up: this product may affect your ${matchedSensitivities.map((m) => m.sensitivityName.toLowerCase()).join(' and ')} sensitivity.`
    )
  }

  if (filteredAllergens.length === 0 && matchedSensitivities.length === 0) {
    const celiacOn =
      profile.celiacStrictGluten && base.celiac?.celiacModeEnabled ? base.celiac : undefined
    if (celiacOn?.celiacSeverity === 'AVOID') {
      parts.push(
        'Not safe for celiac disease — gluten-containing sources were detected in the ingredient list.'
      )
    } else if (celiacOn?.celiacSeverity === 'CAUTION') {
      parts.push(
        'Celiac mode: some ingredients may need a careful look for gluten before you rely on this product.'
      )
    } else {
      parts.push(
        'Based on your allergy and sensitivity profile, nothing obvious jumped out from the list we have.'
      )
    }
  }

  // Add goal/preference-specific insights
  const ingText = base.product.ingredientText.toLowerCase()
  const hasProcessed = /maltodextrin|modified starch|hydrogenated|preservative|artificial/i.test(ingText)
  const hasAddedSugar = /sugar|sucrose|fructose|corn syrup|dextrose/i.test(ingText)
  const hasHighProtein = /protein isolate|whey|soy protein|pea protein/i.test(ingText)

  if (profile.goal === 'eat_cleaner' && hasProcessed) {
    parts.push('Contains processed ingredients. May not align with eating cleaner.')
  }
  if (profile.goal === 'lose_weight' && hasAddedSugar) {
    parts.push('Contains added sugars. Consider if this fits your goals.')
  }
  if (profile.preferences.includes('low_sugar') && hasAddedSugar) {
    parts.push('Contains added sugars.')
  }
  if (profile.preferences.includes('high_protein') && hasHighProtein) {
    parts.push('Good protein content for your goals.')
  }
  if (profile.preferences.includes('less_processed') && hasProcessed) {
    parts.push('Several processed ingredients present.')
  }

  return parts.length > 0 ? parts.join(' ') : base.smartSummary
}

function mapEngineAllergen(m: EngineMatchedAllergen): MatchedAllergen {
  const evidenceSection =
    m.section === 'may_contain'
      ? 'may_contain'
      : m.section === 'contains'
        ? 'contains'
        : 'ingredients'
  const offStyle = /^en:|^fr:/i.test(m.match_text)
  return {
    allergenKey: m.allergen_id,
    allergenName: m.allergen_name,
    matchedIngredient: englishPrimarySegment(m.match_text),
    explanation:
      getIngredientExplanation(m.match_text)?.whatToKnow ??
      `Contains ${m.allergen_name} from your allergy list — not safe for you.`,
    severity: m.severity,
    evidenceSection: offStyle ? 'open_food_facts' : evidenceSection,
    evidenceText: m.match_text,
  }
}

/**
 * Re-run deterministic profile-sensitive safety signals over stored label text before
 * applying personalization. Cached/history results may have been scanned under an old profile.
 */
export function refreshScanProfileSafety(base: ScanResult, profile: Pick<UserProfile, 'allergies' | 'celiacStrictGluten'>): ScanResult {
  const ingredientText = base.product.ingredientText ?? ''
  const safetyHaystack = base.product.ingredientTextSafetyHaystack?.trim() || ingredientText
  const containsText = base.declaredAllergensLabel ?? ''
  const mayContainText = (base.crossContactWarnings ?? []).join(' ')
  const output = detectAllergensEvidenceBased(
    {
      product_name: base.product.name,
      ingredients_text: ingredientText,
      ingredients_text_safety: safetyHaystack,
      contains_text: containsText,
      may_contain_text: mayContainText,
      allergens_tags: base.product.allergensTags ?? [],
      traces_tags: base.product.tracesTags ?? [],
    },
    buildUserAllergenConfig(profile.allergies ?? [])
  )

  let celiac: CeliacResult | undefined
  if (profile.celiacStrictGluten) {
    const fullText = [safetyHaystack, containsText, mayContainText].filter(Boolean).join(' ')
    const celiacMatches = runCeliacCheck(
      (safetyHaystack || ingredientText).split(/[,;]/).map((s) => s.trim()).filter(Boolean),
      fullText || safetyHaystack || ingredientText
    )
    celiac = {
      celiacModeEnabled: true,
      matchedGlutenSignals: celiacMatches.map((m) => ({
        ingredient: m.ingredient,
        signalType: m.signalType,
        severity: m.severity,
        reason: m.reason,
      })),
      celiacSeverity: getCeliacSeverity(celiacMatches),
    }
  }

  const productNameHints = output.product_name_hints?.map((h) => ({
    allergenName: h.allergen_name,
    hintText: h.hint_text,
  }))

  const { celiac: _oldCeliac, productNameHints: _oldHints, ...rest } = base
  return {
    ...rest,
    matchedAllergens: output.matched_allergens.map(mapEngineAllergen),
    ...(celiac ? { celiac } : {}),
    ...(output.scan_log?.source_coverage_score != null
      ? { ingredientDataQualityScore: output.scan_log.source_coverage_score }
      : {}),
    ...(productNameHints?.length ? { productNameHints } : {}),
  }
}

/** Personalize a scan result for a specific user */
export function personalizeScanResult(
  base: ScanResult,
  profile: UserProfile
): ScanResult {
  const ingredientText =
    base.product.ingredientTextSafetyHaystack?.trim() || base.product.ingredientText || ''
  const filteredAllergens = dedupeMatchedAllergensForProfile(
    filterAllergensForUser(base.matchedAllergens, profile.allergies)
  )
  const matchedSensitivities = matchSensitivities(
    ingredientText,
    profile.sensitivities
  )
  const preferenceConflict = classifyPreferenceConflicts(profile, ingredientText)

  let safetyStatus = computeSafetyStatus(
    filteredAllergens.length > 0,
    preferenceConflict.hasHardConflict,
    preferenceConflict.hasSoftConflict,
    matchedSensitivities.length > 0,
    ingredientText.length > 0
  )
  safetyStatus = resolveSafetyStatusWithCeliac(safetyStatus, profile, base.celiac)

  const smartSummary = buildSmartSummary(
    base,
    profile,
    filteredAllergens,
    matchedSensitivities
  )

  // Filter insights to be relevant to user
  const insights = [...base.insights]
  if (filteredAllergens.length > 0) {
    const allergenInsights = filteredAllergens.map(
      (m) => `${m.allergenName}-derived ingredient detected`
    )
    // Replace generic allergen insights with user-specific
    const filtered = insights.filter(
      (i) => !i.includes('-derived ingredient detected')
    )
    insights.length = 0
    insights.push(...allergenInsights, ...filtered)
  }

  return {
    ...base,
    safetyStatus,
    matchedAllergens: filteredAllergens,
    matchedSensitivities,
    smartSummary,
    insights: [...new Set(insights)],
  }
}

/** When the user's profile allergens match, force second-person productAnalysis lines. */
export function applyAllergenPersonalizedProductCopy(result: ScanResult): ScanResult {
  if (!result.matchedAllergens.length) return result
  const pa = result.productAnalysis
  const patch = {
    whoShouldAvoid: 'Based on your profile, you should avoid this.',
    bottomLine: 'This product is not safe for you.',
  }
  if (!pa) {
    return { ...result, productAnalysis: patch }
  }
  return {
    ...result,
    productAnalysis: {
      ...pa,
      ...patch,
    },
  }
}

/** When only sensitivities match (no profile allergens), force stable second-person copy. Allergen hits win if present. */
export function applySensitivityPersonalizedProductCopy(result: ScanResult): ScanResult {
  if (result.matchedAllergens.length > 0) return result
  if (!result.matchedSensitivities?.length) return result
  const pa = result.productAnalysis
  const names = result.matchedSensitivities.map((m) => m.sensitivityName).join(', ')
  const patch = {
    whoShouldAvoid: `Based on your profile, this product contains ingredients you're sensitive to (${names}).`,
    bottomLine: `This product conflicts with your sensitivity profile. Proceed with caution.`,
  }
  return {
    ...result,
    productAnalysis: pa ? { ...pa, ...patch } : patch,
  }
}
