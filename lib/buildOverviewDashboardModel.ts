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

export type WeekStatChip = {
  label: string
  value: string
  hint?: string
  icon: string
  tone: 'neutral' | 'good' | 'warn'
}

export type WatchListItem = {
  name: string
  count: number
  subtitle: string
  rating: 'avoid' | 'concerning'
}

export type RecentScanItem = {
  productId: string
  name: string
  brand: string
  score: number | null
}

export type IngredientMixModel = {
  natural: number
  processed: number
  additive: number
  flagged: number
  total: number
  insight: string
}

export type OverviewDashboardModel = {
  hasScansThisWeek: boolean
  weekHeadline: string
  weekStats: WeekStatChip[]
  topInsight: TopInsightModel
  scoreHero: ScoreHeroModel
  watchList: WatchListItem[]
  recentScans: RecentScanItem[]
  ingredientMix: IngredientMixModel | null
  trend: TrendWeekPoint[]
  trendInsight: TrendInsightModel
}

function buildIngredientMixInsight(mix: Omit<IngredientMixModel, 'insight' | 'total'>): string {
  const total = mix.natural + mix.processed + mix.additive + mix.flagged
  if (total <= 0) return 'Scan products to see how your baskets skew clean vs processed.'
  const cleanShare = Math.round(((mix.natural + mix.processed * 0.5) / total) * 100)
  if (mix.flagged >= 8 || mix.flagged / total > 0.18) {
    return `${mix.flagged} high-risk lines this week — mostly additives and flagged ingredients.`
  }
  if (cleanShare >= 72) {
    return `${cleanShare}% of lines read as whole-food or simple — a cleaner week overall.`
  }
  if (mix.additive >= 6) {
    return `${mix.additive} additive lines showed up — check the watch list for repeats.`
  }
  return `${cleanShare}% of ingredient lines skew simpler — room to swap a few staples.`
}

function weekIngredientMix(weekScanRows: OverviewScanRow[]): IngredientMixModel | null {
  let natural = 0
  let processed = 0
  let additive = 0
  let flagged = 0
  for (const row of weekScanRows) {
    const fromScore = row.result.scoringData?.ingredientCounts
    if (fromScore) {
      natural += fromScore.natural ?? 0
      processed += fromScore.processed ?? 0
      additive += fromScore.additive ?? 0
      flagged += fromScore.flagged ?? 0
      continue
    }
    for (const ing of row.result.ingredientBreakdown ?? []) {
      const r = (ing.ingredientRating ?? 'okay') as IngredientRating
      if (r === 'clean') natural++
      else if (r === 'okay') processed++
      else if (r === 'concerning') additive++
      else if (r === 'avoid') flagged++
    }
  }
  const total = natural + processed + additive + flagged
  if (total <= 0) return null
  const base = { natural, processed, additive, flagged, total }
  return { ...base, insight: buildIngredientMixInsight(base) }
}

function buildRecentScans(weekScanRows: OverviewScanRow[]): RecentScanItem[] {
  return [...weekScanRows]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 4)
    .map((row) => ({
      productId: row.result.product?.id ?? '',
      name: (row.result.product?.name ?? 'Product').trim() || 'Product',
      brand: (row.result.product?.brand ?? '').trim(),
      score: row.result.fillrFit?.score ?? null,
    }))
    .filter((item) => item.productId)
}

function buildWeekStats(
  Y: number,
  flagged: number,
  avgFit: number | null,
  activeDays: number,
  bestDay: { label: string; score: number } | null
): WeekStatChip[] {
  const chips: WeekStatChip[] = [
    {
      label: 'Scans',
      value: String(Y),
      hint: activeDays > 0 ? `${activeDays} active day${activeDays === 1 ? '' : 's'}` : undefined,
      icon: 'scan-outline',
      tone: Y >= 3 ? 'good' : 'neutral',
    },
    {
      label: 'Flagged',
      value: String(flagged),
      hint: flagged > 0 ? 'Lines to review' : 'None this week',
      icon: 'alert-circle-outline',
      tone: flagged >= 6 ? 'warn' : flagged > 0 ? 'neutral' : 'good',
    },
  ]
  if (avgFit != null && avgFit > 0) {
    chips.push({
      label: 'Avg fit',
      value: String(avgFit),
      hint: avgFit >= 72 ? 'Strong week' : avgFit >= 58 ? 'Mixed week' : 'Room to improve',
      icon: 'pulse-outline',
      tone: avgFit >= 72 ? 'good' : avgFit >= 58 ? 'neutral' : 'warn',
    })
  }
  if (bestDay) {
    chips.push({
      label: 'Best day',
      value: String(bestDay.score),
      hint: bestDay.label,
      icon: 'trophy-outline',
      tone: 'good',
    })
  }
  return chips
}

function buildWeekHeadline(Y: number, flagged: number, avgFit: number | null): string {
  if (Y <= 0) return 'No scans logged this week yet.'
  const parts = [`${Y} scan${Y === 1 ? '' : 's'}`]
  if (flagged > 0) parts.push(`${flagged} flagged line${flagged === 1 ? '' : 's'}`)
  if (avgFit != null && avgFit > 0) parts.push(`${avgFit} avg fit`)
  return parts.join(' · ')
}

function bestDayFromSeries(
  daySeries: { label: string; avgFit: number | null; count: number }[] | undefined
): { label: string; score: number } | null {
  if (!daySeries?.length) return null
  let best: { label: string; score: number } | null = null
  for (const day of daySeries) {
    if (day.avgFit == null || day.avgFit <= 0 || day.count <= 0) continue
    if (!best || day.avgFit > best.score) {
      best = { label: day.label, score: day.avgFit }
    }
  }
  return best
}

export function buildOverviewDashboardModel(
  rows: OverviewScanRow[],
  week: { start: Date; end: Date },
  metrics: ReturnType<typeof computeOverviewMetrics>,
  daySeries?: { label: string; avgFit: number | null; count: number }[]
): OverviewDashboardModel {
  const Y = metrics.totalScansThisWeek
  const activeDays = daySeries?.filter((d) => d.count > 0).length ?? 0
  const bestDay = bestDayFromSeries(daySeries)
  const weekStats = buildWeekStats(Y, metrics.flaggedIngredientsThisWeek, metrics.avgFitThisWeek, activeDays, bestDay)
  const weekHeadline = buildWeekHeadline(Y, metrics.flaggedIngredientsThisWeek, metrics.avgFitThisWeek)
  const watchList: WatchListItem[] = metrics.topFlagged.slice(0, 3).map((row) => ({
    name: row.name,
    count: row.count,
    subtitle: row.subtitle,
    rating: row.rating,
  }))

  if (Y === 0) {
    const trendEmptyWeek = buildWeeklyAvgFitTrend(rows, week, 6)
    return {
      hasScansThisWeek: false,
      weekHeadline,
      weekStats,
      watchList: [],
      recentScans: [],
      ingredientMix: null,
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
  const ingredientMix = weekIngredientMix(wRows)
  const recentScans = buildRecentScans(wRows)

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
    hasScansThisWeek: true,
    weekHeadline,
    weekStats,
    watchList,
    recentScans,
    ingredientMix,
    topInsight,
    scoreHero,
    trend,
    trendInsight: buildTrendInsight(trend),
  }
}
