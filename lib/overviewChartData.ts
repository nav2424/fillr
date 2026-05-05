import type { OverviewScanRow } from './overviewAnalytics'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

export type WeekDayStat = {
  label: string
  count: number
  /** Average Fillr score for scans that day, or null if none */
  avgFit: number | null
  dayStart: Date
}

/**
 * Monday → Sunday buckets for the given calendar week (`week.start` must be week Monday).
 */
export function buildWeekDayOverviewSeries(
  rows: OverviewScanRow[],
  week: { start: Date; end: Date }
): WeekDayStat[] {
  const weekStart = new Date(week.start)
  weekStart.setHours(0, 0, 0, 0)
  const out: WeekDayStat[] = []
  for (let i = 0; i < 7; i++) {
    const dayStart = new Date(weekStart)
    dayStart.setDate(weekStart.getDate() + i)
    const dayEnd = new Date(dayStart)
    dayEnd.setHours(23, 59, 59, 999)
    const dayRows = rows.filter((r) => r.createdAt >= dayStart && r.createdAt <= dayEnd)
    const count = dayRows.length
    const scores = dayRows
      .map((r) => r.result.fillrFit?.score)
      .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
    const avgFit =
      scores.length === 0 ? null : Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    out.push({ label: DAY_LABELS[i], count, avgFit, dayStart })
  }
  return out
}
