/**
 * Minimal Overview data: top insight, weekly Fillr score, 6-week trend.
 */

import type { IngredientRating } from '../types'
import {
  computeOverviewMetrics,
  getWeekBounds,
  isInWeek,
  type OverviewScanRow,
  type TopFlaggedRow,
} from './overviewAnalytics'

export type DeltaTone = 'positive' | 'negative' | 'neutral'

export type TopInsightModel = {
  headlineBefore: string
  headlineHighlight: string
  headlineAfter: string
  subline: string
  icon: string
  iconBg: string
  iconColor: string
}

export type ScoreHeroModel = {
  score: number | null
  scoreWord: string
  ringColor: string
  supportLine: string
  deltaPoints: number | null
  deltaLabel: string | null
  deltaTone: DeltaTone
}

export type TrendWeekPoint = {
  label: string
  avgFit: number | null
  weekStartMs: number
}

function priorWeek(week: { start: Date; end: Date }): { start: Date; end: Date } {
  const d = new Date(week.start)
  d.setDate(d.getDate() - 7)
  return getWeekBounds(d)
}

function weekRows(rows: OverviewScanRow[], week: { start: Date; end: Date }): OverviewScanRow[] {
  return rows.filter((r) => isInWeek(r.createdAt, week.start, week.end))
}

function scoreWord(score: number | null): string {
  if (score == null || score <= 0) return '—'
  if (score >= 78) return 'Strong'
  if (score >= 62) return 'Fair'
  if (score >= 45) return 'Mixed'
  return 'Needs work'
}

function ringColorForFit(score: number | null): string {
  if (score == null || score <= 0) return '#94a3b8'
  if (score >= 78) return '#22c55e'
  if (score >= 62) return '#eab308'
  if (score >= 45) return '#f97316'
  return '#ef4444'
}

function topBrandForIngredientKey(weekScanRows: OverviewScanRow[], nameLower: string): string | null {
  const brands = new Map<string, number>()
  for (const row of weekScanRows) {
    const hit = (row.result.ingredientBreakdown ?? []).some((ing) => {
      const r = (ing.ingredientRating ?? 'okay') as IngredientRating
      if (r !== 'avoid' && r !== 'concerning') return false
      const key = (ing.name ?? ing.commonName ?? '').trim().toLowerCase()
      return key === nameLower
    })
    if (!hit) continue
    const b = (row.result.product?.brand ?? '').trim()
    if (!b) continue
    brands.set(b, (brands.get(b) ?? 0) + 1)
  }
  let best: string | null = null
  let bestN = 0
  for (const [b, c] of brands) {
    if (c > bestN) {
      bestN = c
      best = b
    }
  }
  return best
}

function formatFitDelta(cur: number | null, prev: number | null): { label: string | null; tone: DeltaTone } {
  if (cur == null || prev == null || cur <= 0 || prev <= 0) {
    return { label: null, tone: 'neutral' }
  }
  const d = cur - prev
  if (d === 0) return { label: 'No change vs last week', tone: 'neutral' }
  const arrow = d > 0 ? '↑' : '↓'
  const tone: DeltaTone = d > 0 ? 'positive' : 'negative'
  return { label: `${arrow} ${Math.abs(d)} pts vs last week`, tone }
}

function buildTopInsight(
  Y: number,
  weekScanRows: OverviewScanRow[],
  top: TopFlaggedRow | undefined,
  avgFit: number | null
): TopInsightModel {
  if (top && top.count > 0) {
    const key = top.name.trim().toLowerCase()
    const brand = topBrandForIngredientKey(weekScanRows, key)
    return {
      headlineBefore: '',
      headlineHighlight: top.name,
      headlineAfter: ` showed up in ${top.count} of your scans this week.`,
      subline: brand
        ? `Most hits traced to ${brand} — worth checking ingredient lines on that brand when you restock.`
        : 'Same ingredient on multiple labels often means a formulation pattern, not a one-off.',
      icon: 'sparkles-outline',
      iconBg: 'rgba(34, 197, 94, 0.18)',
      iconColor: '#15803d',
    }
  }
  if (avgFit != null && avgFit > 0 && avgFit < 52 && Y > 0) {
    const low = weekScanRows.filter((r) => (r.result.fillrFit?.score ?? 999) < 50).length
    return {
      headlineBefore: 'Fillr fit stayed under 50 on ',
      headlineHighlight: String(Math.max(low, 1)),
      headlineAfter: ` of ${Y} scan${Y === 1 ? '' : 's'}.`,
      subline: 'Those scans usually share long ingredient lists or industrial shortcuts — open the lowest fits first.',
      icon: 'pulse',
      iconBg: 'rgba(249, 115, 22, 0.16)',
      iconColor: '#c2410c',
    }
  }
  return {
    headlineBefore: '',
    headlineHighlight: String(Y),
    headlineAfter: ` scan${Y === 1 ? '' : 's'} logged — patterns look calm this week.`,
    subline: 'Nothing noisy repeated across labels — a good week to lock in staples you trust.',
    icon: 'shield-checkmark',
    iconBg: 'rgba(34, 197, 94, 0.16)',
    iconColor: '#15803d',
  }
}

/** Last `weeks` weeks ending at `week` (inclusive), oldest → newest. */
export function buildWeeklyAvgFitTrend(
  rows: OverviewScanRow[],
  week: { start: Date; end: Date },
  weeks = 6
): TrendWeekPoint[] {
  const out: TrendWeekPoint[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(week.start)
    d.setDate(d.getDate() - 7 * i)
    const w = getWeekBounds(d)
    const m = computeOverviewMetrics(rows, w)
    out.push({
      label: `${w.start.getMonth() + 1}/${w.start.getDate()}`,
      avgFit: m.avgFitThisWeek,
      weekStartMs: w.start.getTime(),
    })
  }
  return out
}

export type TrendInsightTone = 'positive' | 'negative' | 'neutral'

export type TrendInsightModel = {
  line: string
  tone: TrendInsightTone
}

function buildTrendInsight(points: TrendWeekPoint[]): TrendInsightModel {
  const scored = points.filter((p) => p.avgFit != null && p.avgFit > 0)
  if (scored.length < 2) {
    return {
      line: 'Log a few more scored weeks and this line will show your arc, not just dots.',
      tone: 'neutral',
    }
  }
  const first = scored[0].avgFit as number
  const last = scored[scored.length - 1].avgFit as number
  const diff = last - first
  if (Math.abs(diff) < 4) {
    return {
      line: `Holding near ${last} — your six-week window stayed within a few points.`,
      tone: 'neutral',
    }
  }
  if (diff >= 4) {
    return {
      line: `Up ${diff} points from the start of this window — recent baskets are fitting you better.`,
      tone: 'positive',
    }
  }
  return {
    line: `Down ${Math.abs(diff)} points from the start of this window — last pulls leaned heavier or less clean.`,
    tone: 'negative',
  }
}

export type OverviewDashboardModel = {
  topInsight: TopInsightModel
  scoreHero: ScoreHeroModel
  trend: TrendWeekPoint[]
  trendInsight: TrendInsightModel
}

export function buildOverviewDashboardModel(
  rows: OverviewScanRow[],
  week: { start: Date; end: Date },
  metrics: ReturnType<typeof computeOverviewMetrics>
): OverviewDashboardModel {
  const Y = metrics.totalScansThisWeek
  if (Y === 0) {
    const trendEmptyWeek = buildWeeklyAvgFitTrend(rows, week, 6)
    return {
      topInsight: {
        headlineBefore: '',
        headlineHighlight: 'No scans',
        headlineAfter: ' in this week yet.',
        subline: 'Choose another week above or scan a product to fill this view.',
        icon: 'calendar-outline',
        iconBg: 'rgba(100, 116, 139, 0.12)',
        iconColor: '#475569',
      },
      scoreHero: {
        score: null,
        scoreWord: '—',
        ringColor: '#94a3b8',
        supportLine: 'Once scans land here, you will see how your week compares to the last one.',
        deltaPoints: null,
        deltaLabel: null,
        deltaTone: 'neutral',
      },
      trend: trendEmptyWeek,
      trendInsight: buildTrendInsight(trendEmptyWeek),
    }
  }

  const prev = priorWeek(week)
  const prevMetrics = computeOverviewMetrics(rows, prev)
  const wRows = weekRows(rows, week)
  const avg = metrics.avgFitThisWeek

  const top = metrics.topFlagged[0]
  const topInsight = buildTopInsight(Y, wRows, top, avg)

  const fitDelta = formatFitDelta(avg, prevMetrics.avgFitThisWeek)
  const scoreHero: ScoreHeroModel = {
    score: avg,
    scoreWord: scoreWord(avg),
    ringColor: ringColorForFit(avg),
    supportLine:
      avg != null && avg > 0
        ? avg >= 72
          ? 'This week, barcodes skew toward cleaner labels and fewer friction ingredients for you.'
          : avg >= 58
            ? 'Solid middle ground — a mix of clean staples and a few busier formulations.'
            : 'Ingredient lists ran longer or busier than ideal — the flagged lines are doing most of the talking.'
        : 'Scan products with Fillr fit to see a weekly score.',
    deltaPoints:
      avg != null && prevMetrics.avgFitThisWeek != null && avg > 0 && (prevMetrics.avgFitThisWeek ?? 0) > 0
        ? avg - (prevMetrics.avgFitThisWeek as number)
        : null,
    deltaLabel: fitDelta.label,
    deltaTone: fitDelta.tone,
  }

  const trend = buildWeeklyAvgFitTrend(rows, week, 6)
  return {
    topInsight,
    scoreHero,
    trend,
    trendInsight: buildTrendInsight(trend),
  }
}
