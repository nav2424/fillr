/**
 * “Should I care?” copy for Worth a look — tight hierarchy, no paragraphs, no food-science filler.
 */

import type { IngredientExplanation } from '../types'
import { firstSentencePlain } from './ingredientOneLiner'
import { formatGoalName } from './fillrScoring'
import { getIngredientCardCollapsedSubtitle } from './buildIngredientCardViewModel'
import { impactForYouMatchesIngredientProfile } from './ingredientImpactRelevance'

export type WorthLookRoleKind =
  | 'allergy_hit'
  | 'sensitivity_hit'
  | 'artificial_color'
  | 'processed_fat'
  | 'preservative'
  | 'sweetener'
  | 'emulsifier'
  | 'flavor_enhancer'
  | 'curing'
  | 'generic_avoid'

export interface WorthLookProfileContext {
  goal: string
  preferences: string[]
  allergyMatch: boolean
  sensitivityMatch: boolean
  matchedAllergenLabel?: string
  matchedSensitivityLabel?: string
}

export interface WorthLookDecision {
  /** Instant scan chip, e.g. "Artificial additive" */
  categoryPill: string
  /** One-line “what is this in plain English” under the name */
  roleTagLine: string
  /** Always exactly two impact lines (complete clauses, no ellipsis). */
  bullets: readonly [string, string]
  /** One short “For you” sentence (no prefix). */
  forYouLine: string
}

const FLUFF_PATTERNS = [
  /\bprovides?\s+texture\b/i,
  /\bused\s+in\s+baking\b/i,
  /\badds?\s+flavou?r\b/i,
  /\badds\s+mouth\s*feel\b/i,
  /\btendern(ess)?\b/i,
  /\bfrom\s+separating\b/i,
  /\bbakery\s+items?\b/i,
  /\bbaked\s+goods?\b/i,
  /\bprovides?\s+tendern/i,
]

function sentenceHasFluff(s: string): boolean {
  return FLUFF_PATTERNS.some((p) => p.test(s))
}

/** Whole words up to `max` chars; never appends an ellipsis. */
export function wordsUnderBudget(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  if (!t) return ''
  if (t.length <= max) return t
  const words = t.split(' ')
  let out = ''
  for (const w of words) {
    const next = out ? `${out} ${w}` : w
    if (next.length > max) break
    out = next
  }
  return out || words[0] || ''
}

function stripFluffSentences(s: string): string {
  const t = s.replace(/\s+/g, ' ').trim()
  if (!t) return ''
  const parts = t.split(/(?<=[.!?])\s+/)
  const kept = parts.filter((p) => p.trim().length > 0 && !sentenceHasFluff(p))
  const joined = kept.join(' ').trim()
  const base = joined.length >= 12 ? joined : t
  return firstSentencePlain(base).trim()
}

function cleanInsightLine(raw: string, _max = 96): string {
  const one = firstSentencePlain(raw).trim()
  if (!one) return ''
  const stripped = stripFluffSentences(one)
  const use = stripped.length >= 12 ? stripped : one
  if (sentenceHasFluff(use)) return ''
  return use.trim()
}

function haystack(ing: IngredientExplanation): string {
  return `${ing.name} ${ing.headline ?? ''} ${ing.quickSummary ?? ''}`.toLowerCase()
}

export function detectWorthLookRoleKind(
  ing: IngredientExplanation,
  ctx: WorthLookProfileContext
): WorthLookRoleKind {
  if (ctx.allergyMatch || ing.personalFlag === 'allergy') return 'allergy_hit'
  if (ctx.sensitivityMatch || ing.personalFlag === 'sensitivity') return 'sensitivity_hit'
  const n = ing.name.toLowerCase()
  const hay = haystack(ing)
  if (/yellow\s*5|red\s*40|blue\s*1|tartrazine|artificial color|food color|dye|lake|colour/i.test(hay)) {
    return 'artificial_color'
  }
  if (/partially\s+hydrogen|hydrogenated/i.test(hay)) return 'processed_fat'
  if (/polysorbate|mono[- ]?and[- ]?diglycer|emulsif|gellan|xanthan|carrageenan|guar gum/i.test(hay)) {
    return 'emulsifier'
  }
  if (/sodium\s+benzoate|potassium\s+sorbate|sorbate|benzoate|propionate|calcium\s+propionate|preservat/i.test(hay)) {
    return 'preservative'
  }
  if (/\bhfcs\b|high\s+fructose|corn\s+syrup|aspartame|sucralose|acesulfame/i.test(hay)) return 'sweetener'
  if (/msg|monosodium\s+glutamate/i.test(hay)) return 'flavor_enhancer'
  if (/nitrate|nitrite/i.test(hay)) return 'curing'
  if (/\b(oil|fat|shortening|margarine)\b/i.test(n) && /soybean|canola|palm|vegetable|coconut|corn/i.test(n)) {
    return 'processed_fat'
  }
  return 'generic_avoid'
}

function categoryPillFor(kind: WorthLookRoleKind): string {
  switch (kind) {
    case 'allergy_hit':
      return 'Allergen alert'
    case 'sensitivity_hit':
      return 'Sensitivity cue'
    case 'artificial_color':
    case 'flavor_enhancer':
      return 'Artificial additive'
    case 'processed_fat':
    case 'emulsifier':
      return 'Highly processed'
    case 'preservative':
    case 'curing':
      return 'Preservative'
    case 'sweetener':
      return 'Sweetener load'
    default:
      return 'Additives watchlist'
  }
}

function roleTagLineFor(ing: IngredientExplanation, kind: WorthLookRoleKind, ctx: WorthLookProfileContext): string {
  switch (kind) {
    case 'allergy_hit':
      return ctx.matchedAllergenLabel
        ? `Allergen match (${ctx.matchedAllergenLabel})`
        : 'Allergen match on this line'
    case 'sensitivity_hit':
      return ctx.matchedSensitivityLabel
        ? `Sensitivity cue (${ctx.matchedSensitivityLabel})`
        : 'Sensitivity cue on this line'
    case 'artificial_color':
      return 'Artificial food dye'
    case 'processed_fat':
      return /partially\s+hydrogen|hydrogenated/i.test(haystack(ing))
        ? 'Processed fat (may contain trans fats)'
        : 'Industrial cooking fat'
    case 'preservative':
      return 'Synthetic preservatives'
    case 'sweetener':
      return 'Industrial sweetener'
    case 'emulsifier':
      return 'Emulsifier (keeps ingredients mixed)'
    case 'flavor_enhancer':
      return 'Flavor enhancer'
    case 'curing':
      return 'Curing agents'
    default: {
      const fromCard = getIngredientCardCollapsedSubtitle(ing)
      if (fromCard) return fromCard
      return 'Flagged ingredient on this scan'
    }
  }
}

function defaultBullets(kind: WorthLookRoleKind): readonly [string, string] {
  switch (kind) {
    case 'allergy_hit':
      return [
        'This line overlaps something you said you avoid',
        'Skip it if your clinician has you strict on this allergen',
      ]
    case 'sensitivity_hit':
      return [
        'Relevant to a sensitivity you track in Fillr',
        'Your past reactions matter more than any generic label read',
      ]
    case 'artificial_color':
      return [
        'Used when manufacturers want a punchy shelf-stable color',
        'Fillr reads it as a concentrated additive, not a whole-food pigment',
      ]
    case 'processed_fat':
      return [
        'Associated with highly processed foods',
        'Partially hydrogenated oils are broadly avoided for long-term heart health',
      ]
    case 'preservative':
      return [
        'Common in shelf-stable packaged foods',
        'Extends shelf life and keeps the formula predictable on the shelf',
      ]
    case 'sweetener':
      return [
        'Concentrated sweetness common in packaged foods',
        'Shows up when brands want intensity without a long sugar word list',
      ]
    case 'emulsifier':
      return [
        'Shows up often in packaged desserts and mixes',
        'Usually fine in small amounts, but signals more processing',
      ]
    case 'flavor_enhancer':
      return [
        'Boosts savory taste in processed foods',
        'Signals a more engineered flavor stack than a short whole-food list',
      ]
    case 'curing':
      return [
        'Typical in cured meats and savory snacks',
        'Carries the curing-salt story for shelf-stable savory formulas',
      ]
    default:
      return [
        'Fillr flagged this line on this scan',
        'Open Ingredients if you want the full line-by-line context',
      ]
  }
}

function pickImpactLines(ing: IngredientExplanation, kind: WorthLookRoleKind): readonly [string, string] {
  const fall = defaultBullets(kind)
  const pool: string[] = []
  const seen = new Set<string>()

  const bullets = ing.whyItMattersBullets
  if (Array.isArray(bullets) && bullets.length >= 2) {
    const a = String(bullets[0] ?? '').trim()
    const b = String(bullets[1] ?? '').trim()
    if (a.length >= 18 && b.length >= 18) {
      const la = cleanInsightLine(a, 102)
      const lb = cleanInsightLine(b, 102)
      if (la.length >= 18 && lb.length >= 18) return [la, lb] as const
    }
  }

  const tryPush = (raw: string | undefined) => {
    if (pool.length >= 2 || !raw) return
    const line = cleanInsightLine(String(raw), 102)
    if (line.length < 18) return
    const key = line.slice(0, 36).toLowerCase()
    if (seen.has(key)) return
    if (fall.some((f) => f.slice(0, 28).toLowerCase() === line.slice(0, 28).toLowerCase())) return
    seen.add(key)
    pool.push(line)
  }

  tryPush(ing.whyItMatters)
  tryPush(ing.whatToKnow)
  tryPush(ing.ratingReason)
  tryPush(ing.bodyEffect)
  tryPush(ing.commonIn ? `Often in: ${ing.commonIn}` : undefined)

  if (pool.length === 0) return fall
  if (pool.length === 1) return [pool[0], fall[1]] as const
  return [pool[0], pool[1]] as const
}

function buildForYouLine(ing: IngredientExplanation, ctx: WorthLookProfileContext): string {
  const intelRaw = (ing.impactForYou ?? '').trim()
  const intel =
    intelRaw &&
    impactForYouMatchesIngredientProfile(intelRaw, ing, {
      allergyMatch: ctx.allergyMatch,
      sensitivityMatch: ctx.sensitivityMatch,
    })
      ? intelRaw
      : ''
  if (intel) {
    const line = cleanInsightLine(intel, 108)
    if (line.length >= 12) return line
  }
  if (ctx.allergyMatch || ing.personalFlag === 'allergy') {
    return ctx.matchedAllergenLabel
      ? `Allergen conflict: ${ctx.matchedAllergenLabel}.`
      : 'Allergen conflict for your Fillr profile.'
  }
  if (ctx.sensitivityMatch || ing.personalFlag === 'sensitivity') {
    return ctx.matchedSensitivityLabel
      ? `Sensitivity flag: ${ctx.matchedSensitivityLabel}.`
      : 'Sensitivity flag for your Fillr profile.'
  }
  if (ing.personalFlag === 'avoiding') {
    return 'Lines up with something you told Fillr you try to avoid'
  }
  if (ing.personalFlag === 'celiac') {
    return 'Celiac Mode is on—verify gluten sourcing on the physical label.'
  }
  if (ing.personalFlag === 'preference_conflict' && ctx.preferences.length > 0) {
    const pref = ctx.preferences.slice(0, 2).join(', ')
    return wordsUnderBudget(`Goes against your “${pref}” preference`, 108)
  }
  const noteRaw = (ing.personalizedNote || ing.personalMessage || '').trim()
  if (noteRaw) {
    const note = cleanInsightLine(noteRaw, 108)
    if (note.length >= 20) return note
  }
  const goal = ctx.goal.trim()
  if (goal) {
    const g = formatGoalName(goal)
    return wordsUnderBudget(`Weigh this against your ${g} goal`, 108)
  }
  const sj = (ing.systemJudgment || '').trim()
  if (sj) {
    const sjl = cleanInsightLine(sj, 108)
    if (sjl.length >= 16) return sjl
  }
  return 'Fillr flagged this line—open the ingredient card for the full read.'
}

export function buildWorthLookDecision(
  ing: IngredientExplanation,
  ctx: WorthLookProfileContext
): WorthLookDecision {
  const kind = detectWorthLookRoleKind(ing, ctx)
  const categoryPill = categoryPillFor(kind)
  const roleTagLine = roleTagLineFor(ing, kind, ctx)
  const bullets = pickImpactLines(ing, kind)
  const forYouLine = buildForYouLine(ing, ctx)
  return { categoryPill, roleTagLine, bullets, forYouLine }
}
