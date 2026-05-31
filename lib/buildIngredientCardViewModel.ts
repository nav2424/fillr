/**
 * Single source of truth for ingredient row/card display copy.
 * Prefers Fillr Ingredient Intelligence fields; falls back to legacy translator prose when needed.
 */

import type { IngredientExplanation, IngredientRating } from '../types'
import { ensureDistinctIngredientExplanation } from './ingredientProseHydration'
import { isIngredientCopyBoilerplate } from './fillrAdapter'
import { buildIngredientTranslationLine, firstSentencePlain } from './ingredientOneLiner'
import { impactForYouMatchesIngredientProfile } from './ingredientImpactRelevance'
import { ingredientLevelGoalFocusLabels } from './goalApplicability'

const WEAK_COPY_PATTERNS: RegExp[] = [
  /^here is what ["'“”].+["'“”] usually means on a packaged-?food label\.?$/i,
  /many labels use a short or trade name/i,
  /\bif you avoid\b/i,
  /\bsome people\b/i,
  /\byou may want to\b/i,
  /\bworth noting\b/i,
  /neutral for most people/i,
  /\bcommon in food products\b/i,
  /\bused in many products\b/i,
  /\bdepending on context\b/i,
  /\bgenerally recognized as safe\b/i,
  /\bmay affect some people\b/i,
  /\bvaries from person to person\b/i,
  /\bif you have\b.*\b(allergy|allergies|celiac|gluten)\b/i,
  /\bindividuals may react\b/i,
  /\bthose with\b/i,
  /\bpeople with\b/i,
  /\bshould avoid\b/i,
  /\bif you are\b/i,
  /\bmay want to avoid\b/i,
  /\bnot suitable for\b/i,
  /\ba named ingredient in (this|the) (formula|product)\b/i,
  /\bone of the key lines to verify\b/i,
  /\bif dairy is in your profile\b/i,
]

/** Model / repair boilerplate we never want as primary shopper-facing lines. */
const INTERNAL_OR_SYSTEM_PHRASES: RegExp[] = [
  /^decoding\.?\.?$/i,
  /ocr unclear/i,
  /could not be parsed from the model json/i,
  /fillr used a cautious default/i,
  /deterministic safety rule/i,
  /overriding the model rating/i,
  /malformed ingredient row/i,
  /unreadable row/i,
]

const MAX_BULLET_CHARS = 200
/** Collapsed card subtitle: prefer a full sentence; only clamp multi-sentence blobs. */
const COLLAPSED_SUBTITLE_HARD_MAX = 320
const MAX_SECTION_CHARS = 360
const MAX_FALLBACK_BODY_CHARS = 520
const USELESS_NO_CONFLICT_PATTERNS: RegExp[] = [
  /\bno direct conflicts? with your current profile\b/i,
  /\bno direct (conflict|contact) with your profile\b/i,
  /\bno conflicts? with your current profile\b/i,
  /\bno direct profile conflicts?\b/i,
]

function normalizeCompare(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
}

function wordsUpTo(s: string, maxChars: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  if (!t || t.length <= maxChars) return t
  const words = t.split(' ')
  let out = ''
  for (const w of words) {
    const next = out ? `${out} ${w}` : w
    if (next.length > maxChars) break
    out = next
  }
  return out || words[0] || ''
}

function tidyLine(s: string): string {
  let t = s.replace(/\s+/g, ' ').trim()
  t = t.replace(/([.!?])\1+/g, '$1')
  return t
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function stripLeadingIngredientName(raw: string, ingredientName: string): string {
  const t = tidyLine(raw)
  const n = tidyLine(ingredientName)
  if (!t || !n) return t
  const e = escapeRegex(n)
  const patterns = [
    new RegExp(`^["“”']?${e}["“”']?\\s+(is|are|was|were)\\s+`, 'i'),
    new RegExp(`^["“”']?${e}["“”']?\\s+(means|refers to|usually means)\\s+`, 'i'),
    new RegExp(`^["“”']?${e}["“”']?\\s*[:\\-–—]\\s*`, 'i'),
    new RegExp(`^["“”']?${e}["“”']?\\s*,\\s*`, 'i'),
  ]
  for (const p of patterns) {
    if (p.test(t)) return t.replace(p, '')
  }
  return t
}

function autoCapitalizeSentences(raw: string): string {
  const t = tidyLine(raw)
  if (!t) return t
  return t.replace(/(^|[.!?]\s+)([a-z])/g, (_m, p1: string, p2: string) => `${p1}${p2.toUpperCase()}`)
}

function simplifyShopperCopy(raw: string, ingredientName: string): string {
  let t = stripLeadingIngredientName(raw, ingredientName)
  const n = ingredientName.toLowerCase().trim()
  const lower = t.toLowerCase()
  if (!t) return t

  if (
    n === 'milk' &&
    /(stabilizer|buffer|emulsifier|processing ingredient|concentrated extract)/i.test(lower)
  ) {
    return 'Milk ingredient used for protein and texture in processed foods.'
  }

  t = t
    .replace(/processing ingredient/gi, 'processed ingredient')
    .replace(/stabilizer,\s*buffer,\s*emulsifier/gi, 'texture helpers')
    .replace(/concentrated extract/gi, 'concentrated form')
    .replace(/or similar/gi, '')
    .replace(/not a whole food you would cook from scratch/gi, 'not a whole-food ingredient')
    .replace(
      /saturated fat level varies.*?overheated\.?/gi,
      'Refined oils can be heavily processed, so this is better as an occasional ingredient.'
    )
    .replace(
      /processing and reuse of frying oil can form undesirable compounds if overheated\.?/gi,
      'Repeated high-heat processing can make oil quality worse.'
    )
    .replace(/\bundesirable compounds\b/gi, 'harmful by-products')
    .replace(/\be\.g\.,?\s*/gi, '')
    .replace(/;\s*/g, '. ')
    .replace(/\s*,\s*,/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim()

  if (!/[.!?]$/.test(t)) t = `${t}.`
  return autoCapitalizeSentences(t)
}

function isUselessNoConflictText(text: string | null | undefined): boolean {
  const t = String(text ?? '').trim()
  if (!t) return false
  return USELESS_NO_CONFLICT_PATTERNS.some((re) => re.test(t))
}

function isPersonalImpactLine(text: string | null | undefined): boolean {
  const t = String(text ?? '').trim()
  if (!t) return false
  return /\b(your|you've|you have)\b/i.test(t) && /\b(profile|allergy|sensitivity|preference|goal|celiac|gluten)\b/i.test(t)
}

function capLen(s: string, max: number): string {
  const t = tidyLine(s)
  if (t.length <= max) return t
  const clipped = wordsUpTo(t, Math.max(12, max - 2))
  return clipped.endsWith('…') ? clipped : `${clipped}…`
}

function stripSentencePunctuation(s: string): string {
  return s.trim().replace(/[.!?]["']?\s*$/u, '')
}

function prefixEducationalLine(label: 'What it is' | "Why it's here" | 'What it does', raw: string): string {
  const line = stripSentencePunctuation(simplifyShopperCopy(raw, ''))
  if (!line) return ''
  if (new RegExp(`^${escapeRegex(label)}\\s*:`, 'i').test(line)) return `${line}.`
  return `${label}: ${line}.`
}

function endsWithSentencePunctuation(s: string): boolean {
  return /[.!?]["']?\s*$/.test(s.trim())
}

/**
 * True when copy probably ends mid-clause (common when upstream text was clipped without a period).
 */
function looksLikeTrailingClauseFragment(s: string): boolean {
  const u = s.trim()
  if (!u) return true
  const core = u.replace(/[.!?]["']?\s*$/u, '').trim()
  if (/,\s*$/.test(core)) return true
  if (/\b(from|of|for|to|with|in|on|at|by|the|a|an|or|as)\s*$/i.test(core)) return true
  if (/\band\s*$/i.test(core) || /\bor\s*$/i.test(core)) return true
  if (endsWithSentencePunctuation(u)) return false
  return false
}

/** Keep leading complete sentences that fit within max chars (each sentence ends with . ! ?). */
function truncateToCompleteSentencesWithin(s: string, max: number): string {
  const t = tidyLine(s)
  if (!t || t.length <= max) return t
  const parts = t
    .split(/(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter(Boolean)
  let out = ''
  for (const p of parts) {
    const next = out ? `${out} ${p}` : p
    if (next.length > max) break
    out = next
  }
  if (out) return out
  return parts[0] ?? t.slice(0, max)
}

function normalizeCollapsedSubtitleLine(raw: string): string | null {
  const t = tidyLine(raw)
  if (!t) return null
  let line = firstSentencePlain(t)
  if (line.length < 8) return null
  if (isWeakIngredientCopy(line)) return null
  if (looksLikeTrailingClauseFragment(line)) return null
  if (!endsWithSentencePunctuation(line) && line.length > 140) return null
  if (line.length > COLLAPSED_SUBTITLE_HARD_MAX) {
    line = truncateToCompleteSentencesWithin(line, COLLAPSED_SUBTITLE_HARD_MAX)
    if (looksLikeTrailingClauseFragment(line)) return null
  }
  return tidyLine(line)
}

function pickCollapsedShortLabel(ingredient: IngredientExplanation): string | null {
  const candidates: (string | undefined | null)[] = [
    ingredient.shortLabel,
    ingredient.headline,
    ingredient.quickSummary,
    ingredient.whatItIs,
    buildIngredientTranslationLine(ingredient),
    ingredient.whyItMatters,
    Array.isArray(ingredient.whyItMattersBullets) ? ingredient.whyItMattersBullets[0] : null,
    ingredient.whatItDoes ?? ingredient.whyItsUsed,
    ingredient.bodyEffect,
  ]
  for (const raw of candidates) {
    if (!isUsableIngredientIntelligenceField(raw, 8)) continue
    const t = simplifyShopperCopy(String(raw).trim(), ingredient.name)
    if (isWeakIngredientCopy(t)) continue
    const line = normalizeCollapsedSubtitleLine(t)
    if (line) return line
  }
  return null
}

/** True when copy is hedgey, generic, or internal — should not win over intelligence. */
export function isWeakIngredientCopy(text: string | undefined | null): boolean {
  const t = (text ?? '').trim()
  if (!t) return true
  if (WEAK_COPY_PATTERNS.some((re) => re.test(t))) return true
  if (INTERNAL_OR_SYSTEM_PHRASES.some((re) => re.test(t))) return true
  return false
}

/**
 * True when the string is safe to show as a primary intelligence / subtitle field.
 */
export function isUsableIngredientIntelligenceField(
  text: string | undefined | null,
  minLen = 4
): boolean {
  const t = (text ?? '').trim()
  if (t.length < minLen) return false
  if (isIngredientCopyBoilerplate(t)) return false
  if (isWeakIngredientCopy(t)) return false
  return true
}

function pickFirstUsable(
  minLen: number,
  ...candidates: (string | undefined | null)[]
): string | null {
  for (const c of candidates) {
    if (isUsableIngredientIntelligenceField(c, minLen)) return tidyLine(String(c).trim())
  }
  return null
}

function splitIntoCandidateBullets(raw: string): string[] {
  const t = tidyLine(raw)
  if (!t) return []
  const byNl = t.split(/\n+/).map((s) => tidyLine(s)).filter(Boolean)
  if (byNl.length >= 2) return byNl
  const byPeriod = t.split(/(?<=[.!?])\s+/).map((s) => tidyLine(s)).filter(Boolean)
  return byPeriod.length ? byPeriod : [t]
}

function pushEducationalBullet(
  bullets: string[],
  label: 'What it is' | "Why it's here" | 'What it does',
  raw: string | null | undefined,
  ingredientName: string
): void {
  if (bullets.length >= 2) return
  if (!isUsableIngredientIntelligenceField(raw, 10)) return
  const simplified = simplifyShopperCopy(String(raw), ingredientName)
  if (
    !isUsableIngredientIntelligenceField(simplified, 10) ||
    isUselessNoConflictText(simplified) ||
    isConditionalMedicalWarning(simplified)
  ) {
    return
  }
  const line = capLen(prefixEducationalLine(label, simplified), MAX_BULLET_CHARS)
  const norm = normalizeCompare(line)
  if (!norm || bullets.some((b) => normalizeCompare(b) === norm)) return
  bullets.push(line)
}

function dedupeJudgmentAndImpact(
  judgment: string | null,
  impact: string | null
): { systemJudgment: string | null; impactForYou: string | null } {
  if (!judgment || !impact) return { systemJudgment: judgment, impactForYou: impact }
  const a = normalizeCompare(judgment)
  const b = normalizeCompare(impact)
  if (!a || !b) return { systemJudgment: judgment, impactForYou: impact }
  if (a === b) return { systemJudgment: null, impactForYou: impact }
  if (a.length >= 24 && b.includes(a.slice(0, 24))) return { systemJudgment: null, impactForYou: impact }
  if (b.length >= 24 && a.includes(b.slice(0, 24))) return { systemJudgment: judgment, impactForYou: null }
  return { systemJudgment: judgment, impactForYou: impact }
}

const BADGE_LABEL: Record<IngredientRating, string> = {
  clean: 'NATURAL',
  okay: 'PROCESSED',
  concerning: 'ADDITIVE',
  avoid: 'FLAGGED',
}

export type IngredientCardViewModel = {
  title: string
  shortLabel: string | null
  bullets: string[]
  systemJudgment: string | null
  impactForYou: string | null
  fallbackBody: string | null
  status: string
  confidence: 'high' | 'medium' | null
  evidence: Array<{ label: string; value: string }>
  uncertaintyLabel: string | null
  /** Secondary note (e.g. source ambiguity) — optional small print */
  footnote: string | null
}

function titleCaseWord(s: string): string {
  const t = s.trim()
  if (!t) return ''
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
}

function humanizeMatchedRule(raw: string): string {
  const text = String(raw ?? '').trim()
  if (!text) return text
  const t = text.toLowerCase()
  if (t.includes('deterministic ingredient rule')) return 'Based on known ingredient safety patterns'
  if (t.includes('allergy profile rule')) return 'Matches your allergy settings'
  if (t.includes('sensitivity profile rule')) return 'Matches your sensitivity settings'
  if (t.includes('celiac safety rule')) return 'Matches celiac/gluten safety checks'
  if (t.includes('goal/preference conflict rule')) return 'Conflicts with your saved preferences'
  if (t.includes('personalized profile rule')) return 'Based on your saved profile settings'
  if (t.includes('ingredient analysis model')) return 'Based on ingredient evidence and product context'
  return text
}

function buildIngredientEvidence(ingredient: IngredientExplanation): Array<{ label: string; value: string }> {
  const fromTraceRule = ingredient.evidenceTrace?.ruleMatched?.trim()
  const fromTraceConfidence = ingredient.evidenceTrace?.confidence?.trim()
  const fromTraceLastVerified = ingredient.evidenceTrace?.lastVerifiedAt?.trim()
  const focusLabels = profileFocusLabelsForIngredient(ingredient)
  const explicitConflictWith =
    focusLabels.length > 0 &&
    (ingredient.personalFlag === 'preference_conflict' || ingredient.flagDriver === 'preference')
      ? `Conflict with "${focusLabels[0]}"`
      : null

  const matchRule =
    humanizeMatchedRule(fromTraceRule ?? '') ||
    explicitConflictWith ||
    (ingredient.personalFlag === 'allergy'
      ? 'Matches your allergy settings'
      : ingredient.personalFlag === 'sensitivity'
        ? 'Matches your sensitivity settings'
        : ingredient.personalFlag === 'celiac'
          ? 'Matches celiac/gluten safety checks'
          : ingredient.personalFlag === 'preference_conflict'
            ? 'Conflicts with your saved preferences'
            : ingredient.ratingSource === 'deterministic'
              ? 'Based on known ingredient safety patterns'
              : ingredient.ratingSource === 'personal'
                ? 'Based on your saved profile settings'
                : 'Based on ingredient evidence and product context')

  const confidence =
    fromTraceConfidence != null
      ? titleCaseWord(fromTraceConfidence)
      : ingredient.sourceAmbiguity?.confidence != null
      ? `${titleCaseWord(ingredient.sourceAmbiguity.confidence)} (source ambiguity)`
      : ingredient.intelligenceConfidence != null
        ? titleCaseWord(ingredient.intelligenceConfidence)
        : null

  const lastVerified =
    fromTraceLastVerified && !Number.isNaN(Date.parse(fromTraceLastVerified))
      ? new Date(fromTraceLastVerified).toISOString().slice(0, 10)
      : null

  return [
    { label: 'Matched rule', value: matchRule },
    ...(confidence ? [{ label: 'Confidence', value: confidence }] : []),
    ...(lastVerified ? [{ label: 'Last verified', value: lastVerified }] : []),
  ]
}

function getUncertaintyLabel(ingredient: IngredientExplanation): string | null {
  if (ingredient.sourceAmbiguity && ingredient.sourceAmbiguity.confidence !== 'high') {
    return 'Possible match'
  }
  if (ingredient.intelligenceConfidence === 'medium') {
    return 'Lower confidence'
  }
  return null
}

export type BuildIngredientCardViewModelOptions = {
  /** When set, drives `status` badge label; otherwise uses `ingredient.ingredientRating`. */
  displayRating?: IngredientRating
  /** When set, filters bogus product-level `impactForYou` pasted onto unrelated lines. */
  allergyMatch?: boolean
  sensitivityMatch?: boolean
  celiacMatch?: boolean
}

function isConditionalMedicalWarning(text: string): boolean {
  return (
    /\bif you have\b.*\b(allergy|allergies|celiac|gluten)\b/i.test(text) ||
    /\bnot suitable for\b/i.test(text) ||
    /\bavoid if you\b/i.test(text) ||
    /\bindividuals may react\b/i.test(text) ||
    /\bpeople with\b/i.test(text) ||
    /\bthose with\b/i.test(text) ||
    /\bshould avoid\b/i.test(text) ||
    /\bmay react\b/i.test(text)
  )
}

/** Generic model copy that contradicts a severe badge (avoid / additive / processed). */
function systemJudgmentContradictsDisplayRating(
  judgment: string | null,
  displayRating: IngredientRating
): boolean {
  if (!judgment || (displayRating !== 'avoid' && displayRating !== 'concerning')) return false
  const t = judgment.trim()
  return (
    /\brated clean\b/i.test(t) ||
    /\brated okay based on typical use/i.test(t) ||
    /\bfine in context\b/i.test(t) ||
    /\bno inherent downside\b/i.test(t) ||
    /\bhydration is essential\b/i.test(t) ||
    /\btypically safe\b/i.test(t) ||
    /\bbehaves in food\.?\s*$/i.test(t)
  )
}

const PREFERENCE_FOCUS_LABELS: Record<string, string> = {
  vegan: 'Vegan',
  vegetarian: 'Vegetarian',
  kosher: 'Kosher',
  halal: 'Halal',
  plant_based: 'Plant-based',
  paleo: 'Paleo',
  whole30: 'Whole30',
  high_protein: 'High protein',
  low_sugar: 'Low sugar',
  low_carb: 'Low carb',
  low_calorie: 'Low calorie',
  diabetic_friendly: 'Diabetic-friendly',
  less_processed: 'Eat cleaner / less processed',
}

const PROFILE_FOCUS_LABELS: Record<string, string> = {
  ...PREFERENCE_FOCUS_LABELS,
  ...ingredientLevelGoalFocusLabels(),
}

const loggedFallbackFocusMisses = new Set<string>()

function profileFocusLabelsForIngredient(ingredient: IngredientExplanation): string[] {
  const raw = [
    ingredient.profileAnchor ?? '',
    ingredient.personalizedNote ?? '',
    ingredient.personalMessage ?? '',
    ingredient.impactForYou ?? '',
    ingredient.systemJudgment ?? '',
    ingredient.ratingReason ?? '',
  ]
    .join(' ')
    .toLowerCase()
  if (!raw.trim()) return []
  const labels: string[] = []
  for (const [key, label] of Object.entries(PROFILE_FOCUS_LABELS)) {
    const token = key.replace(/_/g, ' ')
    if (raw.includes(key) || raw.includes(token)) labels.push(label)
  }
  return Array.from(new Set(labels)).slice(0, 2)
}

function profileFocusLead(labels: string[]): string {
  if (labels.length <= 0) return 'your profile settings'
  if (labels.length === 1) return `your ${labels[0]} setting`
  return `your ${labels[0]} and ${labels[1]} settings`
}

function debugLogFallbackWithoutDetectedFocus(
  ingredient: IngredientExplanation,
  rating: IngredientRating
): void {
  const isDevRuntime = typeof __DEV__ !== 'undefined' && __DEV__
  if (!isDevRuntime) return
  const name = ingredient.name.trim().toLowerCase()
  const key = `${name}|${ingredient.profileAnchor ?? ''}|${ingredient.personalFlag ?? ''}|${ingredient.flagDriver ?? ''}|${rating}`
  if (loggedFallbackFocusMisses.has(key)) return
  loggedFallbackFocusMisses.add(key)
  console.log('[Fillr][copy-fallback-focus-miss]', {
    ingredient: ingredient.name,
    profileAnchor: ingredient.profileAnchor ?? null,
    personalFlag: ingredient.personalFlag ?? null,
    flagDriver: ingredient.flagDriver ?? null,
    rating,
  })
}

function synthesizeShortLabel(
  ingredient: IngredientExplanation,
  rating: IngredientRating,
  allergyHit: boolean,
  sensitivityHit: boolean
): string {
  const explicit = String(ingredient.shortLabel ?? '').trim()
  if (explicit && !isWeakIngredientCopy(explicit)) return explicit
  const focus = profileFocusLabelsForIngredient(ingredient)
  if (allergyHit) return 'Allergy-relevant ingredient'
  if (sensitivityHit) return 'Sensitivity-relevant ingredient'
  if (focus.length > 0) return `${focus[0]} conflict`
  if (ingredient.flagDriver === 'preference' || ingredient.personalFlag === 'preference_conflict') {
    return 'Preference-relevant ingredient'
  }
  if (rating === 'avoid') return 'Higher-risk ingredient'
  if (rating === 'concerning') return 'Processing concern'
  if (rating === 'okay') return 'Formula ingredient'
  return 'Lower-risk ingredient'
}

function synthesizeSystemJudgment(
  ingredient: IngredientExplanation,
  rating: IngredientRating,
  allergyHit: boolean,
  sensitivityHit: boolean
): string {
  const name = ingredient.name.trim() || 'This ingredient'
  const focus = profileFocusLabelsForIngredient(ingredient)
  const focusLead = profileFocusLead(focus)
  if (allergyHit) {
    return `${name} is flagged because it can trigger the allergen profile matched on this scan.`
  }
  if (sensitivityHit) {
    return `${name} is flagged for your sensitivity profile and should be treated as a caution line.`
  }
  if (ingredient.flagDriver === 'preference' || ingredient.personalFlag === 'preference_conflict') {
    return `${name} appears to conflict with ${focusLead}.`
  }
  if (rating === 'avoid') {
    return `${name} is treated as a high-risk line based on Fillr's ingredient safety rules.`
  }
  if (rating === 'concerning') {
    return `${name} is mostly a processing/function ingredient rather than a whole-food component.`
  }
  if (rating === 'okay') {
    return `${name} is part of the formula and is best judged in context with ingredient order and frequency.`
  }
  return `${name} is generally a lower-risk ingredient in this product context.`
}

function synthesizeImpactForYou(args: {
  ingredient: IngredientExplanation
  rating: IngredientRating
  allergyHit: boolean
  sensitivityHit: boolean
  celiacHit: boolean
  hasProfileRiskContext: boolean
}): string {
  const { ingredient, rating, allergyHit, sensitivityHit, celiacHit, hasProfileRiskContext } = args
  const name = ingredient.name.trim() || 'This ingredient'
  const focus = profileFocusLabelsForIngredient(ingredient)
  if (focus.length === 0) {
    debugLogFallbackWithoutDetectedFocus(ingredient, rating)
  }
  const focusLead = profileFocusLead(focus)
  if (allergyHit) {
    return `${name} conflicts with your allergy settings, so this product is not a good fit for your profile.`
  }
  if (sensitivityHit) {
    return `${name} conflicts with your sensitivity settings, so this product is more likely to bother you.`
  }
  if (celiacHit || ingredient.personalFlag === 'celiac') {
    return `${name} conflicts with your celiac/gluten settings, so this product is not a good fit for your profile.`
  }
  if (ingredient.personalFlag === 'avoiding' || ingredient.personalFlag === 'preference_conflict') {
    return `${name} does not align with ${focusLead}.`
  }
  if (hasProfileRiskContext && focus.length > 0) {
    return `${name} does not align with ${focusLead} and is one of the lines driving this rating.`
  }
  if (rating === 'avoid') {
    return `${name} is treated as a high-risk line based on Fillr ingredient rules, not your diet goal alone.`
  }
  if (rating === 'concerning') {
    return `${name} is mostly a processing or additive line; see the product score for goal fit.`
  }
  if (rating === 'okay' || rating === 'clean') {
    return `${name} is a typical formula ingredient; your diet goal is reflected in the overall product score.`
  }
  return `${name} is included for context in your ingredient breakdown.`
}

/**
 * Normalized content for collapsed + expanded ingredient UI.
 */
export function buildIngredientCardViewModel(
  ingredient: IngredientExplanation,
  options?: BuildIngredientCardViewModelOptions
): IngredientCardViewModel {
  const ingredientResolved = ensureDistinctIngredientExplanation(ingredient)

  const rawRating = (options?.displayRating ?? ingredientResolved.ingredientRating ?? 'okay') as string
  const allergyHit = options?.allergyMatch === true
  const sensitivityHit = options?.sensitivityMatch === true
  const celiacHit = options?.celiacMatch === true
  const hasProfileRiskContext =
    allergyHit ||
    sensitivityHit ||
    celiacHit ||
    ingredient.personalFlag === 'avoiding' ||
    ingredient.personalFlag === 'preference_conflict' ||
    ingredient.flagDriver === 'preference'
  const rating: IngredientRating =
    rawRating === 'safe' || rawRating === 'clean'
      ? 'clean'
      : rawRating === 'okay'
        ? 'okay'
        : rawRating === 'concerning'
          ? 'concerning'
          : rawRating === 'avoid'
            ? 'avoid'
            : 'okay'

  const title = (ingredientResolved.name ?? 'Ingredient').trim() || 'Ingredient'

  const shortLabel =
    pickCollapsedShortLabel(ingredientResolved) ??
    synthesizeShortLabel(ingredientResolved, rating, allergyHit, sensitivityHit)

  let bullets: string[] = []

  pushEducationalBullet(
    bullets,
    'What it is',
    pickFirstUsable(
      10,
      firstSentencePlain(ingredientResolved.whatItIs || ''),
      firstSentencePlain(ingredientResolved.labelDecoder || ''),
      ingredientResolved.headline
    ),
    ingredientResolved.name
  )
  pushEducationalBullet(
    bullets,
    "Why it's here",
    pickFirstUsable(
      10,
      firstSentencePlain(ingredientResolved.whatItDoes || ingredientResolved.whyItsUsed || ''),
      firstSentencePlain(ingredientResolved.bodyEffect || '')
    ),
    ingredientResolved.name
  )

  if (bullets.length < 2) {
    const rawBullets = ingredient.whyItMattersBullets
    if (Array.isArray(rawBullets) && rawBullets.length >= 2) {
      for (const raw of rawBullets) {
        if (bullets.length >= 2) break
        pushEducationalBullet(
          bullets,
          bullets.length === 0 ? 'What it is' : "Why it's here",
          String(raw),
          ingredient.name
        )
      }
    }
  }
  if (bullets.length < 2) {
    const wim = pickFirstUsable(12, ingredient.whyItMatters)
    const parts = wim ? splitIntoCandidateBullets(wim) : []
    for (const p of parts) {
      if (bullets.length >= 2) break
      pushEducationalBullet(
        bullets,
        bullets.length === 0 ? 'What it is' : "Why it's here",
        p,
        ingredient.name
      )
    }
  }
  if (bullets.length < 2) {
    const w1 = pickFirstUsable(10, firstSentencePlain(ingredient.whatItIs || ''))
    const w2 = pickFirstUsable(
      10,
      firstSentencePlain(ingredient.whatItDoes || ingredient.whyItsUsed || ''),
      firstSentencePlain(ingredient.bodyEffect || '')
    )
    const s1 = w1 ? simplifyShopperCopy(w1, ingredient.name) : null
    const s2 = w2 ? simplifyShopperCopy(w2, ingredient.name) : null
    pushEducationalBullet(bullets, 'What it is', s1, ingredient.name)
    pushEducationalBullet(bullets, "Why it's here", s2, ingredient.name)
  }
  const shortNorm = normalizeCompare(shortLabel ?? '')
  bullets = bullets
    .filter((b) => {
      if (!shortNorm) return true
      const bn = normalizeCompare(b)
      if (!bn) return false
      if (bn === shortNorm) return false
      // Collapsed subtitle is often the first sentence of "What it is" — keep the labeled bullet.
      if (
        shortNorm.length >= 18 &&
        bn.includes(shortNorm) &&
        /^(what it is|why it s here)\b/.test(bn)
      ) {
        return true
      }
      return !bn.includes(shortNorm)
    })
    .slice(0, 2)

  let systemJudgment = pickFirstUsable(
    12,
    ingredient.systemJudgment,
    ingredient.ratingReason,
    firstSentencePlain(ingredient.whatToKnow || ''),
    firstSentencePlain(ingredient.labelDecoder || '')
  )
  if (systemJudgment) {
    systemJudgment = simplifyShopperCopy(systemJudgment, ingredient.name)
  }
  if (systemJudgment && isUselessNoConflictText(systemJudgment)) {
    systemJudgment = null
  }
  if (systemJudgmentContradictsDisplayRating(systemJudgment, rating)) {
    systemJudgment = pickFirstUsable(
      12,
      ingredient.systemJudgment,
      firstSentencePlain(ingredient.whatToKnow || ''),
      firstSentencePlain(ingredient.labelDecoder || ''),
      firstSentencePlain(ingredient.whatItDoes || ingredient.whyItsUsed || '')
    )
  }
  if (systemJudgmentContradictsDisplayRating(systemJudgment, rating)) {
    systemJudgment = null
  }

  let impactForYou = pickFirstUsable(
    12,
    ingredient.impactForYou,
    ingredient.personalMessage,
    ingredient.personalizedNote
  )
  if (impactForYou) {
    impactForYou = simplifyShopperCopy(impactForYou, ingredient.name)
  }
  if (impactForYou && isUselessNoConflictText(impactForYou)) {
    impactForYou = null
  }
  if (
    impactForYou &&
    !impactForYouMatchesIngredientProfile(impactForYou, ingredient, {
      allergyMatch: allergyHit,
      sensitivityMatch: sensitivityHit,
      celiacMatch: celiacHit,
    })
  ) {
    impactForYou = null
  }

  const deduped = dedupeJudgmentAndImpact(
    systemJudgment ? capLen(systemJudgment, MAX_SECTION_CHARS) : null,
    impactForYou ? capLen(impactForYou, MAX_SECTION_CHARS) : null
  )
  systemJudgment = deduped.systemJudgment
  impactForYou = deduped.impactForYou

  if (!systemJudgment && (rating === 'avoid' || hasProfileRiskContext)) {
    systemJudgment = capLen(
      synthesizeSystemJudgment(ingredient, rating, allergyHit, sensitivityHit),
      MAX_SECTION_CHARS
    )
  }
  if (!impactForYou && hasProfileRiskContext) {
    impactForYou = capLen(
      synthesizeImpactForYou({
        ingredient,
        rating,
        allergyHit,
        sensitivityHit,
        celiacHit,
        hasProfileRiskContext,
      }),
      MAX_SECTION_CHARS
    )
  }
  if (
    impactForYou &&
    !impactForYouMatchesIngredientProfile(impactForYou, ingredient, {
      allergyMatch: allergyHit,
      sensitivityMatch: sensitivityHit,
      celiacMatch: celiacHit,
    })
  ) {
    impactForYou = null
  }

  const impactNorm = normalizeCompare(impactForYou ?? '')
  bullets = bullets.filter((b) => {
    if (isPersonalImpactLine(b)) return false
    const bn = normalizeCompare(b)
    if (impactNorm && bn && (bn === impactNorm || bn.includes(impactNorm) || impactNorm.includes(bn))) return false
    return true
  })

  const needsLegacyBlob = bullets.length === 0 && !systemJudgment && !impactForYou

  const footnoteRaw = ingredient.sourceAmbiguity?.message?.trim()
  const footnote =
    footnoteRaw && isUsableIngredientIntelligenceField(footnoteRaw, 8)
      ? capLen(footnoteRaw, 220)
      : null

  let fallbackBody: string | null = null
  if (needsLegacyBlob) {
    const chunks: string[] = []
    const trans = buildIngredientTranslationLine(ingredient)
    if (isUsableIngredientIntelligenceField(trans, 20)) chunks.push(trans)
    const be = firstSentencePlain(ingredient.bodyEffect || '')
    if (be && isUsableIngredientIntelligenceField(be, 15)) chunks.push(be)
    const joined = chunks.filter(Boolean).join('\n\n')
    fallbackBody = joined ? capLen(joined, MAX_FALLBACK_BODY_CHARS) : null
  }

  const conf = ingredient.intelligenceConfidence
  const confidence = conf === 'high' || conf === 'medium' ? conf : null
  const evidence = buildIngredientEvidence(ingredient)
  const uncertaintyLabel = getUncertaintyLabel(ingredient)

  return {
    title,
    shortLabel,
    bullets,
    systemJudgment,
    impactForYou,
    fallbackBody,
    status: BADGE_LABEL[rating],
    confidence,
    evidence,
    uncertaintyLabel,
    footnote,
  }
}

/** One-liner for list surfaces (overview, etc.) — prefers intelligence short label. */
export function getIngredientCardCollapsedSubtitle(ingredient: IngredientExplanation): string | null {
  return buildIngredientCardViewModel(ingredient).shortLabel
}
