import type { ScanResult } from '../types'
import { computeOverviewMetrics, getWeekBounds, isInWeek } from './overviewAnalytics'
import type { OverviewScanRow } from './overviewAnalytics'
import type { WeekDayStat } from './overviewChartData'

export type OverviewInsightTone = 'positive' | 'neutral' | 'attention'

export type OverviewInsightCard = {
  id: string
  title: string
  body: string
  icon: string
  tone: OverviewInsightTone
}

export type OverviewNarrative = {
  headline: string
  subline: string
  cards: OverviewInsightCard[]
}

function priorWeekBounds(week: { start: Date; end: Date }): { start: Date; end: Date } {
  const anchor = new Date(week.start)
  anchor.setDate(anchor.getDate() - 3)
  return getWeekBounds(anchor)
}

function fitBand(score: number | null): 'none' | 'high' | 'mid' | 'low' {
  if (score == null || score <= 0) return 'none'
  if (score >= 78) return 'high'
  if (score >= 62) return 'mid'
  return 'low'
}

function weekScans(rows: OverviewScanRow[], week: { start: Date; end: Date }): OverviewScanRow[] {
  return rows.filter((s) => isInWeek(s.createdAt, week.start, week.end))
}

function productLabel(r: ScanResult): string {
  const n = (r.product?.name ?? '').trim()
  return n.length > 0 ? n : 'Unknown product'
}

/** Lowest Fillr fit scores first (one row per product name = worst score that week). */
function worstFitProducts(weekRows: OverviewScanRow[], limit: number): { name: string; score: number }[] {
  const byName = new Map<string, number>()
  for (const row of weekRows) {
    const sc = row.result.fillrFit?.score
    if (typeof sc !== 'number' || !Number.isFinite(sc)) continue
    const name = productLabel(row.result)
    const prev = byName.get(name)
    if (prev === undefined || sc < prev) byName.set(name, sc)
  }
  return [...byName.entries()]
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
}

function flagHitsOnScan(result: ScanResult): number {
  return (result.ingredientBreakdown ?? []).filter(
    (ing) => ing.ingredientRating === 'avoid' || ing.ingredientRating === 'concerning'
  ).length
}

/** Products with the most avoid/concerning lines this week. */
function heaviestLabelProducts(weekRows: OverviewScanRow[], limit: number): { name: string; hits: number }[] {
  const byId = new Map<string, { name: string; hits: number }>()
  for (const row of weekRows) {
    const id = row.result.product?.id ?? row.result.product?.barcode ?? ''
    const hits = flagHitsOnScan(row.result)
    if (hits <= 0) continue
    const name = productLabel(row.result)
    const key = id || name
    const prev = byId.get(key)
    if (!prev) byId.set(key, { name, hits })
    else prev.hits += hits
  }
  return [...byId.values()]
    .sort((a, b) => b.hits - a.hits)
    .slice(0, limit)
}

function goalConflictSummary(weekRows: OverviewScanRow[]): string | null {
  const labels = new Set<string>()
  for (const row of weekRows) {
    const g = row.result.scoringData?.goalConflicts
    if (Array.isArray(g)) {
      for (const x of g) {
        if (typeof x === 'string' && x.trim()) labels.add(x.trim())
      }
    }
    const details = row.result.scoringData?.goalConflictDetails
    if (Array.isArray(details)) {
      for (const d of details) {
        if (d?.label?.trim()) labels.add(d.label.trim())
      }
    }
  }
  if (labels.size === 0) return null
  return [...labels].slice(0, 3).join(' · ')
}

function bullets(lines: string[], maxLines = 4): string {
  return lines
    .filter(Boolean)
    .slice(0, maxLines)
    .map((l) => `• ${l}`)
    .join('\n')
}

/**
 * Tight, data-first copy: named products, ranked lows, repeat ingredients, deltas — not generic prose.
 */
export function buildOverviewNarrative(
  rows: OverviewScanRow[],
  week: { start: Date; end: Date },
  metrics: ReturnType<typeof computeOverviewMetrics>,
  daySeries: WeekDayStat[]
): OverviewNarrative {
  const Y = metrics.totalScansThisWeek
  const X = metrics.flaggedIngredientsThisWeek
  const avg = metrics.avgFitThisWeek
  const band = fitBand(avg)

  const wRows = weekScans(rows, week)

  const prev = priorWeekBounds(week)
  const prevMetrics = computeOverviewMetrics(rows, prev)
  const prevY = prevMetrics.totalScansThisWeek
  const prevX = prevMetrics.flaggedIngredientsThisWeek
  const prevAvg = prevMetrics.avgFitThisWeek

  const activeDays = daySeries.filter((d) => d.count > 0).length
  let busiest = daySeries[0]
  for (const d of daySeries) {
    if (d.count > busiest.count) busiest = d
  }

  if (Y === 0) {
    return {
      headline: 'No scans this week',
      subline: 'Pick another week above, or scan from the center tab.',
      cards: [],
    }
  }

  const worst = worstFitProducts(wRows, 3)
  const heavy = heaviestLabelProducts(wRows, 2)
  const goalLine = goalConflictSummary(wRows)

  let headline = 'Week snapshot'
  if (worst.length > 0 && worst[0].score < 45) {
    headline = `Led by low fits (${worst[0].name})`
  } else if (band === 'high' && X <= 2) {
    headline = 'Mostly aligned with your profile'
  } else if (X >= 10) {
    headline = `${X} ingredient hits to triage`
  } else if (band === 'low') {
    headline = 'Fit scores skewed low this week'
  }

  const subParts: string[] = []
  if (worst.length > 0) {
    subParts.push(`Lowest fit ${worst[0].score}/100 · ${worst[0].name}`)
  }
  if (busiest.count > 1) {
    subParts.push(`${busiest.count} scans on ${busiest.label}`)
  }
  if (prevY > 0) {
    const ds = Y - prevY
    const df = avg != null && prevAvg != null && avg > 0 && prevAvg > 0 ? avg - prevAvg : null
    if (ds !== 0) subParts.push(`Scans ${ds > 0 ? '+' : ''}${ds} vs prior week`)
    if (df != null && Math.abs(df) >= 3) subParts.push(`Fit ${df > 0 ? '+' : ''}${df} vs prior week`)
  }
  if (prevX > 0 && X !== prevX) {
    const d = X - prevX
    if (Math.abs(d) >= 3) subParts.push(`Flags ${d > 0 ? '+' : ''}${d} vs prior week`)
  }
  let subline = subParts.join(' · ').slice(0, 200)
  if (!subline.trim() && busiest.count > 0) {
    subline = `${busiest.count} scan${busiest.count === 1 ? '' : 's'} on ${busiest.label}`
  }

  const cards: OverviewInsightCard[] = []

  if (worst.length > 0) {
    const lines = worst.map((p) => `${p.name} — ${p.score}/100`)
    cards.push({
      id: 'low-fits',
      title: 'Lowest Fillr fits',
      body: bullets(lines, 3),
      icon: 'trending-down-outline',
      tone: worst[0].score < 50 ? 'attention' : 'neutral',
    })
  }

  if (heavy.length > 0) {
    const lines = heavy.map((p) => `${p.name} — ${p.hits} flagged lines this week`)
    cards.push({
      id: 'heavy-products',
      title: 'Most flagged products',
      body: bullets(lines, 2),
      icon: 'nutrition-outline',
      tone: 'attention',
    })
  }

  if (metrics.topFlagged.length > 0) {
    const lines = metrics.topFlagged.slice(0, 4).map((r) => `${r.name} · ${r.count}× this week`)
    cards.push({
      id: 'repeat-ingredients',
      title: 'Ingredients that kept showing up',
      body: bullets(lines, 4),
      icon: 'repeat-outline',
      tone: 'attention',
    })
  }

  if (goalLine) {
    cards.push({
      id: 'goals',
      title: 'Goal / preference friction',
      body: `Themes that tripped your stated goals this week: ${goalLine}.`,
      icon: 'flag-outline',
      tone: 'attention',
    })
  }

  if (activeDays <= 2 && Y >= 4 && busiest.count >= 2) {
    cards.push({
      id: 'timing',
      title: 'When you scanned',
      body: bullets(
        [
          `${Y} scans on only ${activeDays} day(s).`,
          busiest.count >= Math.ceil(Y * 0.4)
            ? `${busiest.count} of them on ${busiest.label} — review that trip’s basket first.`
            : `Busiest: ${busiest.label} (${busiest.count}).`,
        ],
        2
      ),
      icon: 'time-outline',
      tone: 'neutral',
    })
  } else if (activeDays >= 5) {
    cards.push({
      id: 'timing',
      title: 'When you scanned',
      body: bullets([`${activeDays} different days with scans — good spread for spotting patterns.`], 1),
      icon: 'time-outline',
      tone: 'positive',
    })
  }

  if (X === 0 && cards.length < 5) {
    cards.push({
      id: 'clean-flags',
      title: 'Profile flags',
      body: bullets(['No avoid/concerning-tier ingredients on those scans this week.'], 1),
      icon: 'shield-checkmark-outline',
      tone: 'positive',
    })
  }

  return {
    headline,
    subline: subline.trim(),
    cards: cards.slice(0, 5),
  }
}
