/**
 * Weekly + cumulative overview metrics from scan results (local or Supabase `result_json`).
 */

import type { IngredientExplanation, IngredientRating, ScanResult } from '../types'

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

function ingredientSubtitle(ing: IngredientExplanation, rating: IngredientRating): string {
  if (rating === 'avoid') return 'Flagged for your profile'
  const h = (ing.headline ?? ing.labelDecoder ?? ing.whatItIs ?? '').trim()
  if (h.length > 0) return h.length > 80 ? `${h.slice(0, 77)}…` : h
  return 'Worth a second look'
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
          subtitle: prev.subtitle,
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
    return {
      name: displayName,
      count: v.count,
      rating: v.rating,
      dotColor: v.rating === 'avoid' ? '#ef4444' : '#fb923c',
      subtitle: v.subtitle,
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
