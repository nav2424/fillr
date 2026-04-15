import type {
  FillrFitSnapshot,
  IngredientExplanation,
  MatchedAllergen,
  MatchedSensitivity,
} from '../types'
import { toTitleCase } from './formatProductTitle'
import { resolveIngredientDisplayRating } from './resolveIngredientDisplayRating'
import type { RatingCounts } from './scanResultHook'

/** Black canvas width for view-shot (matches week share proportions). */
export const SHARE_SCAN_CAPTURE_WIDTH = 390

export const SHARE_SCAN_OUTER_PAD_X = 24

/** White card width inside black padding. */
export const SHARE_SCAN_CARD_INNER_WIDTH = SHARE_SCAN_CAPTURE_WIDTH - SHARE_SCAN_OUTER_PAD_X * 2

/** @deprecated alias — inner white card width */
export const SHARE_SCAN_CARD_WIDTH = SHARE_SCAN_CARD_INNER_WIDTH

export type ShareCardIngredientCallout = {
  name: string
  description: string
}

export type ScanShareCardFlagRow = {
  name: string
  count: number
}

/** Compact Fillr Fit line under the scan summary. */
export type ScanShareCardFillrLine = {
  score: number
  verdict: string
}

export type ShareCardCounts = {
  natural: number
  processed: number
  additive: number
  flagged: number
}

/** Props for the view-shot share card (week-share aesthetic). */
export type ScanShareCardModel = {
  productName: string
  brand: string
  ingredientCount: number
  userName: string
  allergyMatch: boolean
  allergenName: string
  allergyCondition: string
  viralHook: string
  counts: ShareCardCounts
  topFlaggedIngredient: ShareCardIngredientCallout | null
  topCleanIngredient: ShareCardIngredientCallout | null
  fillrLine: ScanShareCardFillrLine | null
  /** Top-right header (e.g. brand). */
  headerRight: string
  /** Up to 3 flagged / concerning lines for “MOST OFTEN” style list. */
  flaggedRows: ScanShareCardFlagRow[]
}

function buildFillrLine(fit: FillrFitSnapshot): ScanShareCardFillrLine {
  return {
    score: Math.min(100, Math.max(0, fit.score)),
    verdict: fit.verdict.trim(),
  }
}

function buildHeaderRight(productName: string, brand: string): string {
  const b = brand?.trim()
  if (b) return toTitleCase(b)
  const p = productName.trim()
  if (p.length <= 34) return p
  return `${p.slice(0, 31)}…`
}

function pickFlaggedRows(
  breakdown: IngredientExplanation[],
  matchedAllergens: MatchedAllergen[],
  matchedSensitivities: MatchedSensitivity[],
  maxRows: number
): ScanShareCardFlagRow[] {
  const rows: ScanShareCardFlagRow[] = []
  const seen = new Set<string>()
  const tryAdd = (ing: IngredientExplanation, rating: 'avoid' | 'concerning') => {
    const aa = ingredientHitsAllergen(ing, matchedAllergens)
    const ss = ingredientHitsSensitivity(ing, matchedSensitivities)
    const r = resolveIngredientDisplayRating(ing, aa, ss)
    if (r !== rating) return
    const k = ing.name.toLowerCase()
    if (seen.has(k)) return
    seen.add(k)
    rows.push({ name: ing.name, count: 1 })
  }
  for (const ing of breakdown) {
    tryAdd(ing, 'avoid')
    if (rows.length >= maxRows) return rows
  }
  for (const ing of breakdown) {
    tryAdd(ing, 'concerning')
    if (rows.length >= maxRows) break
  }
  return rows
}

function ingredientHitsAllergen(ing: IngredientExplanation, matches: MatchedAllergen[]): boolean {
  if (!matches.length) return false
  const n = ing.name.toLowerCase()
  return matches.some((m) => {
    const t = m.matchedIngredient.toLowerCase().trim()
    if (!t) return false
    return n.includes(t) || t.includes(n)
  })
}

function ingredientHitsSensitivity(ing: IngredientExplanation, matches: MatchedSensitivity[]): boolean {
  if (!matches.length) return false
  const n = ing.name.toLowerCase()
  return matches.some((m) => {
    const t = m.matchedIngredient.toLowerCase().trim()
    if (!t) return false
    return n.includes(t) || t.includes(n)
  })
}

function ingredientDescription(ing: IngredientExplanation): string {
  const a = ing.labelDecoder?.trim()
  if (a) return a
  const b = ing.headline?.trim()
  if (b) return b
  const c = ing.quickSummary?.trim()
  if (c) return c
  const d = ing.whatToKnow?.trim()
  if (d) return d.length > 160 ? `${d.slice(0, 157)}…` : d
  return ing.whatItIs?.trim() || ''
}

function pickTopFlagged(
  breakdown: IngredientExplanation[],
  matchedAllergens: MatchedAllergen[],
  matchedSensitivities: MatchedSensitivity[]
): ShareCardIngredientCallout | null {
  let avoidPick: IngredientExplanation | null = null
  let concerningPick: IngredientExplanation | null = null

  for (const ing of breakdown) {
    const aa = ingredientHitsAllergen(ing, matchedAllergens)
    const ss = ingredientHitsSensitivity(ing, matchedSensitivities)
    const r = resolveIngredientDisplayRating(ing, aa, ss)
    if (r === 'avoid' && !avoidPick) avoidPick = ing
    else if (r === 'concerning' && !concerningPick) concerningPick = ing
  }

  const chosen = avoidPick ?? concerningPick
  if (!chosen) return null

  const aa = ingredientHitsAllergen(chosen, matchedAllergens)
  const ss = ingredientHitsSensitivity(chosen, matchedSensitivities)
  const r = resolveIngredientDisplayRating(chosen, aa, ss)
  if (r !== 'avoid' && r !== 'concerning') return null

  let description = ingredientDescription(chosen).trim()
  if (!description) description = chosen.whatItIs?.trim() || 'Something to review on this label.'

  return { name: chosen.name, description }
}

function pickTopClean(
  breakdown: IngredientExplanation[],
  matchedAllergens: MatchedAllergen[],
  matchedSensitivities: MatchedSensitivity[]
): ShareCardIngredientCallout | null {
  for (const ing of breakdown) {
    const aa = ingredientHitsAllergen(ing, matchedAllergens)
    const ss = ingredientHitsSensitivity(ing, matchedSensitivities)
    const r = resolveIngredientDisplayRating(ing, aa, ss)
    if (r !== 'clean') continue
    const description = ingredientDescription(ing).trim() || ing.whatItIs?.trim() || ''
    if (!description) continue
    return { name: ing.name, description }
  }
  return null
}

function isSpecificViralHook(raw: string): boolean {
  const t = raw.trim()
  if (t.length < 8) return false
  if (/^ingredient decode from fillr/i.test(t)) return false
  if (/^plain-english decode/i.test(t)) return false
  return true
}

/**
 * Build share card props from a scan result.
 */
export function buildScanShareCardModel(input: {
  productName: string
  brand: string
  userFirstName?: string
  matchedAllergenNames: string[]
  matchedAllergens: MatchedAllergen[]
  celiacAvoid: boolean
  viralHook?: string
  productVerdict?: string
  ratingCounts: RatingCounts
  ingredientBreakdown: IngredientExplanation[]
  matchedSensitivities: MatchedSensitivity[]
  fillrFit?: FillrFitSnapshot | null
}): ScanShareCardModel {
  const {
    productName,
    brand,
    userFirstName,
    matchedAllergenNames,
    matchedAllergens,
    celiacAvoid,
    viralHook,
    productVerdict,
    ratingCounts,
    ingredientBreakdown,
    matchedSensitivities,
    fillrFit,
  } = input

  const total = ingredientBreakdown.length
  const { clean, okay, concerning, avoid } = ratingCounts
  const firstName = userFirstName?.trim() || ''
  const userName = firstName || 'Your'

  const allergyMatch = matchedAllergenNames.length > 0 || celiacAvoid

  let allergenName = ''
  let allergyCondition = ''
  if (celiacAvoid) {
    allergenName = 'gluten'
    allergyCondition = 'celiac'
  } else if (matchedAllergens.length > 0) {
    const raw = matchedAllergens[0].allergenName?.trim() || matchedAllergenNames[0] || 'allergen'
    allergenName = raw.toLowerCase()
    allergyCondition = 'your allergy profile'
  } else if (matchedAllergenNames.length > 0) {
    allergenName = matchedAllergenNames[0].toLowerCase()
    allergyCondition = 'your allergy profile'
  }

  let hookViral = ''
  if (viralHook?.trim() && isSpecificViralHook(viralHook)) {
    hookViral = viralHook.trim()
  } else if (viralHook?.trim()) {
    hookViral = viralHook.trim()
  } else if (productVerdict?.trim()) {
    hookViral = productVerdict.trim()
  }

  let heroViral = hookViral
  if (!allergyMatch && avoid > 0 && !heroViral) {
    heroViral = `${avoid} ingredient${avoid === 1 ? '' : 's'} worth a second look on this label.`
  }
  if (!allergyMatch && avoid > 0 && !heroViral) {
    heroViral = 'Ingredients decoded — see what stands out for you.'
  }

  const topFlagged = pickTopFlagged(ingredientBreakdown, matchedAllergens, matchedSensitivities)
  const topClean = topFlagged ? null : pickTopClean(ingredientBreakdown, matchedAllergens, matchedSensitivities)
  const flaggedRows = pickFlaggedRows(ingredientBreakdown, matchedAllergens, matchedSensitivities, 3)

  return {
    productName,
    brand: brand ?? '',
    ingredientCount: total,
    userName,
    allergyMatch,
    allergenName,
    allergyCondition,
    viralHook: heroViral,
    counts: {
      natural: clean,
      processed: okay,
      additive: concerning,
      flagged: avoid,
    },
    topFlaggedIngredient: topFlagged,
    topCleanIngredient: topClean,
    fillrLine: fillrFit ? buildFillrLine(fillrFit) : null,
    headerRight: buildHeaderRight(productName, brand ?? ''),
    flaggedRows,
  }
}
