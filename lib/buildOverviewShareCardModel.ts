import type { TopFlaggedRow } from './overviewAnalytics'

export type OverviewWeekShareCardRow = {
  name: string
  count: number
  subtitle: string
  accentColor: string
}

export type OverviewWeekShareCardModel = {
  weekLabel: string
  scansThisWeek: number
  flaggedIngredientsThisWeek: number
  avgFitThisWeek: number | null
  /** Total products scanned (all time) — for “your library” copy. */
  totalScansEver: number
  topRows: OverviewWeekShareCardRow[]
  cumulative: {
    natural: number
    processed: number
    additive: number
    flagged: number
  }
}

export function buildOverviewWeekShareCardModel(input: {
  weekLabel: string
  scansThisWeek: number
  flaggedIngredientsThisWeek: number
  avgFitThisWeek: number | null
  totalScansEver: number
  topFlagged: TopFlaggedRow[]
  cumulative: OverviewWeekShareCardModel['cumulative']
}): OverviewWeekShareCardModel {
  const topRows = input.topFlagged.slice(0, 3).map((r) => ({
    name: r.name,
    count: r.count,
    subtitle: r.subtitle,
    accentColor: r.dotColor,
  }))
  return {
    weekLabel: input.weekLabel,
    scansThisWeek: input.scansThisWeek,
    flaggedIngredientsThisWeek: input.flaggedIngredientsThisWeek,
    avgFitThisWeek: input.avgFitThisWeek,
    totalScansEver: input.totalScansEver,
    topRows,
    cumulative: input.cumulative,
  }
}
