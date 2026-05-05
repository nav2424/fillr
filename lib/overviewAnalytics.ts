/**
 * Weekly + cumulative overview metrics from scan results (local or Supabase `result_json`).
 */

import type { IngredientExplanation, IngredientRating, PersonalFlag, ScanResult } from '../types'
import { buildIngredientTranslationLine, firstSentencePlain } from './ingredientOneLiner'
import { getIngredientCardCollapsedSubtitle } from './buildIngredientCardViewModel'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export type OverviewScanRow = {
  createdAt: Date
  result: ScanResult
}

/** Monday 00:00:00 — Sunday 23:59:59.999 (local), week containing `ref`. */
export function getWeekBounds(ref: Date = new Date()): { start: Date; end: Date } {
  const d = new Date(ref)
  const day = d.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const start = new Date(d)
  start.setDate(d.getDate() + mondayOffset)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

export function formatWeekRangeLabel(start: Date, end: Date): string {
  const a = `${MONTHS[start.getMonth()]} ${start.getDate()}`
  const b = `${MONTHS[end.getMonth()]} ${end.getDate()}`
  return `${a} — ${b}`
}

export function isInWeek(createdAt: Date, start: Date, end: Date): boolean {
  return createdAt >= start && createdAt <= end
}

/** Monday-start weeks that contain at least one scan, newest first. */
export type WeekWithScanData = {
  start: Date
  end: Date
  scanCount: number
}

export function getWeeksWithScans(rows: OverviewScanRow[]): WeekWithScanData[] {
  const byStart = new Map<number, WeekWithScanData>()
  for (const s of rows) {
    const { start, end } = getWeekBounds(s.createdAt)
    const key = start.getTime()
    const prev = byStart.get(key)
    if (!prev) {
      byStart.set(key, { start, end, scanCount: 1 })
    } else {
      prev.scanCount += 1
    }
  }
  return [...byStart.values()].sort((a, b) => b.start.getTime() - a.start.getTime())
}

/**
 * Weeks with ≥1 scan (newest first), plus the **current** calendar week when it has
 * zero scans so the user can jump back after viewing a past week.
 */
export function getWeekPickerOptions(rows: OverviewScanRow[]): WeekWithScanData[] {
  const withData = getWeeksWithScans(rows)
  const cur = getWeekBounds(new Date())
  const key = cur.start.getTime()
  if (withData.some((w) => w.start.getTime() === key)) {
    return withData
  }
  const scanCount = rows.filter((s) => isInWeek(s.createdAt, cur.start, cur.end)).length
  return [{ start: cur.start, end: cur.end, scanCount }, ...withData]
}

function countsFromBreakdown(
  breakdown: IngredientExplanation[]
): { natural: number; processed: number; additive: number; flagged: number } {
  let natural = 0
  let processed = 0
  let additive = 0
  let flagged = 0
  for (const ing of breakdown) {
    const r = (ing.ingredientRating ?? 'okay') as IngredientRating
    if (r === 'clean') natural++
    else if (r === 'okay') processed++
    else if (r === 'concerning') additive++
    else if (r === 'avoid') flagged++
  }
  return { natural, processed, additive, flagged }
}

function countsFromScoringData(result: ScanResult): {
  natural: number
  processed: number
  additive: number
  flagged: number
} | null {
  const c = result.scoringData?.ingredientCounts
  if (
    !c ||
    typeof c.natural !== 'number' ||
    typeof c.processed !== 'number' ||
    typeof c.additive !== 'number' ||
    typeof c.flagged !== 'number'
  ) {
    return null
  }
  return {
    natural: c.natural,
    processed: c.processed,
    additive: c.additive,
    flagged: c.flagged,
  }
}

const SUBTITLE_MAX = 118

const GENERIC_SUBTITLE = new Set([
  'Worth a second look',
  'Flagged for your profile',
  'Often highly processed or unclear on the label — tap the product for the full breakdown',
  'Additive or unclear label wording — open the product card for specifics',
])

function normalizeOneLine(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/,\s*$/, '').trim()
}

function isGenericSubtitleLine(s: string): boolean {
  const t = normalizeOneLine(s).replace(/…$/u, '').trim()
  if (GENERIC_SUBTITLE.has(t)) return true
  if (t.startsWith('Often highly processed')) return true
  return false
}

/** When structured fields are empty, give distinct, useful one-liners by ingredient name. */
function nameHintSubtitle(rawName: string): string | null {
  const n = rawName.trim()
  if (!n) return null
  const hints: { re: RegExp; text: string }[] = [
    {
      re: /natural\s*flavor/i,
      text:
        'Catch-all label term—the exact chemicals aren’t listed; fine for most unless your allergens sometimes hide here.',
    },
    {
      re: /^soy\s*lecithin$/i,
      text:
        'Emulsifier from soy, usually in tiny amounts—most soy-allergic people tolerate it; skip if you avoid all soy.',
    },
    {
      re: /lecithin/i,
      text: 'Fat-based emulsifier (often soy or sunflower); amounts are usually small on labels.',
    },
    {
      re: /partially\s*hydrogenated/i,
      text: 'Industrial oils hardened for texture; trans fat concern has made this rare but still shows up on some labels.',
    },
    {
      re: /yellow\s*5|tartrazine/i,
      text: 'Synthetic dye (tartrazine); some people avoid artificial colors for sensitivity or preference.',
    },
    {
      re: /red\s*40|allura\s*red/i,
      text: 'Common synthetic color; a frequent “avoid artificial dyes” watch item.',
    },
    {
      re: /high[\s-]*fructose\s*corn\s*syrup/i,
      text: 'Sweetener from corn starch—often flagged when you’re limiting refined sugar.',
    },
  ]
  for (const { re, text } of hints) {
    if (re.test(n)) return text
  }
  return null
}

function truncateSmart(s: string, max: number): string {
  const t = normalizeOneLine(s)
  if (t.length <= max) return t
  const slice = t.slice(0, max - 1)
  const lastSpace = slice.lastIndexOf(' ')
  if (lastSpace > max * 0.45) {
    return `${slice.slice(0, lastSpace).trim()}…`
  }
  return `${slice.trim()}…`
}

function firstNonEmpty(...parts: (string | undefined | null)[]): string {
  for (const p of parts) {
    const x = typeof p === 'string' ? normalizeOneLine(p) : ''
    if (x.length > 0) return x
  }
  return ''
}

function avoidFallbackLine(pf: PersonalFlag | undefined): string {
  switch (pf) {
    case 'allergy':
      return 'Conflicts with an allergen you listed — check the label if you’re unsure'
    case 'sensitivity':
      return 'Matches a sensitivity you asked us to watch for'
    case 'celiac':
      return 'Not aligned with your gluten-related settings'
    case 'avoiding':
      return 'Matches an ingredient you chose to avoid'
    case 'preference_conflict':
      return 'Doesn’t match a dietary preference you set'
    default:
      return 'Flagged for your profile based on your settings — open the product for details'
  }
}

function pickRicherSubtitle(prev: string, next: string): string {
  const pG = isGenericSubtitleLine(prev)
  const nG = isGenericSubtitleLine(next)
  if (pG && !nG) return next
  if (!pG && nG) return prev
  if (next.length > prev.length + 20) return next
  if (prev.length > next.length + 20) return prev
  return prev
}

function ingredientSubtitle(ing: IngredientExplanation, rating: IngredientRating): string {
  const intelSubtitle = getIngredientCardCollapsedSubtitle(ing)
  if (intelSubtitle) return truncateSmart(intelSubtitle, SUBTITLE_MAX)

  const cardLine = buildIngredientTranslationLine(ing).trim()

  if (rating === 'avoid') {
    const personal = firstNonEmpty(
      ing.personalMessage,
      ing.personalizedNote,
      ing.whyItMatters
    )
    if (personal) return truncateSmart(personal, SUBTITLE_MAX)

    if (cardLine.length > 0 && !isGenericSubtitleLine(cardLine)) {
      return truncateSmart(cardLine, SUBTITLE_MAX)
    }

    const line = firstNonEmpty(
      ing.ratingReason,
      ing.whatToKnow,
      ing.quickSummary,
      ing.headline,
      ing.labelDecoder,
      firstSentencePlain(ing.explanation ?? '')
    )
    if (line) return truncateSmart(line, SUBTITLE_MAX)

    const hinted = nameHintSubtitle(ing.name ?? '')
    if (hinted) return truncateSmart(hinted, SUBTITLE_MAX)

    return truncateSmart(avoidFallbackLine(ing.personalFlag), SUBTITLE_MAX)
  }

  if (cardLine.length > 0 && !isGenericSubtitleLine(cardLine)) {
    return truncateSmart(cardLine, SUBTITLE_MAX)
  }

  const line = firstNonEmpty(
    ing.ratingReason,
    ing.whatToKnow,
    ing.quickSummary,
    ing.headline,
    firstSentencePlain(ing.explanation ?? ''),
    firstSentencePlain(ing.whatItIs),
    ing.labelDecoder
  )
  if (line && !isGenericSubtitleLine(line)) {
    return truncateSmart(line, SUBTITLE_MAX)
  }

  const hinted = nameHintSubtitle(ing.name ?? '')
  if (hinted) return truncateSmart(hinted, SUBTITLE_MAX)

  return truncateSmart(
    'Additive or unclear label wording — open the product card for specifics',
    SUBTITLE_MAX
  )
}

function mergeSubtitlesAcrossWeek(
  weekScans: OverviewScanRow[],
  nameKey: string,
  seed: string
): string {
  let best = seed
  for (const s of weekScans) {
    for (const ing of s.result.ingredientBreakdown ?? []) {
      if ((ing.name ?? '').trim().toLowerCase() !== nameKey) continue
      const r = (ing.ingredientRating ?? 'okay') as IngredientRating
      if (r !== 'avoid' && r !== 'concerning') continue
      const sub = ingredientSubtitle(ing, r)
      best = pickRicherSubtitle(best, sub)
    }
  }
  return best
}

export type TopFlaggedRow = {
  name: string
  count: number
  dotColor: string
  subtitle: string
  /** avoid = red dot, concerning = orange */
  rating: 'avoid' | 'concerning'
}

export function computeOverviewMetrics(
  scans: OverviewScanRow[],
  week: { start: Date; end: Date }
): {
  totalEver: number
  totalScansThisWeek: number
  flaggedIngredientsThisWeek: number
  avgFitThisWeek: number | null
  topFlagged: TopFlaggedRow[]
  topNameThisWeek: string | null
  topNameCount: number
  cumulative: { natural: number; processed: number; additive: number; flagged: number }
} {
  const weekScans = scans.filter((s) => isInWeek(s.createdAt, week.start, week.end))

  let cumulative = { natural: 0, processed: 0, additive: 0, flagged: 0 }
  for (const s of scans) {
    const fromScore = countsFromScoringData(s.result)
    const bd = s.result.ingredientBreakdown ?? []
    const c = fromScore ?? countsFromBreakdown(bd)
    cumulative.natural += c.natural
    cumulative.processed += c.processed
    cumulative.additive += c.additive
    cumulative.flagged += c.flagged
  }

  let flaggedIngredientsThisWeek = 0
  const freq = new Map<
    string,
    { count: number; rating: 'avoid' | 'concerning'; subtitle: string }
  >()

  for (const s of weekScans) {
    const bd = s.result.ingredientBreakdown ?? []
    for (const ing of bd) {
      const r = (ing.ingredientRating ?? 'okay') as IngredientRating
      if (r !== 'avoid' && r !== 'concerning') continue
      flaggedIngredientsThisWeek += 1
      const name = (ing.name ?? ing.commonName ?? 'Ingredient').trim()
      const key = name.toLowerCase()
      const prev = freq.get(key)
      const rating = r === 'avoid' ? 'avoid' : 'concerning'
      const subtitle = ingredientSubtitle(ing, r)
      if (!prev) {
        freq.set(key, { count: 1, rating, subtitle })
      } else {
        freq.set(key, {
          count: prev.count + 1,
          rating: prev.rating === 'avoid' || rating === 'avoid' ? 'avoid' : 'concerning',
          subtitle: pickRicherSubtitle(prev.subtitle, subtitle),
        })
      }
    }
  }

  const sortedFreq = [...freq.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 4)

  const topFlagged: TopFlaggedRow[] = sortedFreq.map(([key, v]) => {
    const original = weekScans
      .flatMap((x) => x.result.ingredientBreakdown ?? [])
      .find((i) => (i.name ?? '').trim().toLowerCase() === key)
    const displayName = (original?.name ?? original?.commonName ?? key).trim()
    const subtitle = mergeSubtitlesAcrossWeek(weekScans, key, v.subtitle)
    return {
      name: displayName,
      count: v.count,
      rating: v.rating,
      dotColor: v.rating === 'avoid' ? '#ef4444' : '#fb923c',
      subtitle,
    }
  })

  let topNameThisWeek: string | null = null
  let topNameCount = 0
  if (topFlagged.length > 0) {
    topNameThisWeek = topFlagged[0].name
    topNameCount = topFlagged[0].count
  }

  const fitScores = weekScans
    .map((s) => s.result.fillrFit?.score)
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
  const avgFitThisWeek =
    fitScores.length > 0 ? Math.round(fitScores.reduce((a, b) => a + b, 0) / fitScores.length) : null

  return {
    totalEver: scans.length,
    totalScansThisWeek: weekScans.length,
    flaggedIngredientsThisWeek,
    avgFitThisWeek,
    topFlagged,
    topNameThisWeek,
    topNameCount,
    cumulative,
  }
}
