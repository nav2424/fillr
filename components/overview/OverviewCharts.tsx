import { View, Text, StyleSheet } from 'react-native'
import type { WeekDayStat } from '../../lib/overviewChartData'
import type { TrendWeekPoint } from '../../lib/buildOverviewDashboardModel'

const INK = '#0a2810'
const MUTED = 'rgba(10,40,18,0.45)'

export function OverviewDayBarsChart({
  days,
  chartHeight = 112,
}: {
  days: WeekDayStat[]
  chartHeight?: number
}) {
  const maxCount = Math.max(1, ...days.map((d) => d.count))
  return (
    <View style={styles.dayRoot}>
      <Text style={styles.dayTitle}>Scans by day</Text>
      <View style={[styles.dayBarsRow, { height: chartHeight }]}>
        {days.map((d) => {
          const h = d.count === 0 ? 3 : Math.max(6, (d.count / maxCount) * (chartHeight - 26))
          return (
            <View key={d.label} style={styles.dayCol}>
              <View style={[styles.dayBarTrack, { height: chartHeight - 26 }]}>
                <View style={[styles.dayBarFill, { height: h, opacity: d.count === 0 ? 0.25 : 1 }]} />
              </View>
              <Text style={styles.dayTick}>{d.label}</Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

/** Compact sparkline for embedding in cards (no title). `width` stretches the week horizontally. */
export function OverviewWeekAvgSparklineMini({
  days,
  height = 40,
  width = 108,
}: {
  days: WeekDayStat[]
  height?: number
  width?: number
}) {
  const w = Math.max(96, width)
  const h = height
  const pad = 6
  const innerW = w - pad * 2
  const innerH = h - pad * 2

  const filled = days.map((d) => (d.avgFit != null ? d.avgFit : null))
  const known = filled.filter((v): v is number => v != null)
  if (known.length === 0) {
    return <View style={{ height: h, width: w }} />
  }

  const baseline =
    filled.every((v) => v == null) ? 50 : Math.min(...known.map((x) => x), 40)
  const ys = days.map((d, i) => {
    const v = d.avgFit
    if (v != null) return v
    const left = filled[i - 1]
    const right = filled[i + 1]
    if (left != null && right != null) return Math.round((left + right) / 2)
    if (left != null) return left
    if (right != null) return right
    return baseline
  })

  const pts = ys
    .map((score) => Math.max(0, Math.min(100, score)))

  return (
    <View style={[styles.sparkMiniBars, { width: w, height: h }]}>
      {pts.map((p, i) => (
        <View key={`mini-${i}`} style={styles.sparkMiniCol}>
          <View style={styles.sparkMiniTrack}>
            <View style={[styles.sparkMiniFill, { height: Math.max(3, ((p || 0) / 100) * (h - 24)) }]} />
          </View>
          <Text style={styles.sparkMiniLabel}>{days[i]?.label ?? ''}</Text>
        </View>
      ))}
    </View>
  )
}

/** Thin 7-point line for average Fillr score (0–100) across the week. */
export function OverviewWeekAvgSparkline({ days }: { days: WeekDayStat[] }) {
  const w = 100
  const h = 44
  const pad = 6
  const innerW = w - pad * 2
  const innerH = h - pad * 2

  const filled = days.map((d) => (d.avgFit != null ? d.avgFit : null))
  const known = filled.filter((v): v is number => v != null)
  if (known.length === 0) {
    return <View style={styles.sparkWrap} />
  }

  const baseline =
    filled.every((v) => v == null) ? 50 : Math.min(...known.map((x) => x), 40)
  const ys = days.map((d, i) => {
    const v = d.avgFit
    if (v != null) return v
    const left = filled[i - 1]
    const right = filled[i + 1]
    if (left != null && right != null) return Math.round((left + right) / 2)
    if (left != null) return left
    if (right != null) return right
    return baseline
  })

  const bars = ys.map((score) => Math.max(0, Math.min(100, score)))

  return (
    <View style={styles.sparkWrap}>
      <Text style={styles.sparkTitle}>Avg Fillr score</Text>
      <View style={[styles.sparkBarsRow, { height: h }]}>
        {bars.map((b, i) => (
          <View key={`spark-${i}`} style={styles.sparkBarCol}>
            <View style={[styles.sparkBarFill, { height: Math.max(4, (b / 100) * (h - 6)) }]} />
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  dayRoot: {
    marginTop: 6,
  },
  dayTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: INK,
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  dayBarsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 3,
  },
  dayCol: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  dayBarTrack: {
    width: '100%',
    maxWidth: 32,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  dayBarFill: {
    width: '100%',
    borderRadius: 9,
    backgroundColor: 'rgba(22,163,74,0.88)',
  },
  dayTick: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: '700',
    color: MUTED,
    textAlign: 'center',
  },
  sparkWrap: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(10,40,18,0.08)',
  },
  sparkTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: INK,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  sparkMiniBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
  },
  sparkMiniCol: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sparkMiniTrack: {
    width: '100%',
    minHeight: 26,
    borderRadius: 6,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15,23,42,0.06)',
    overflow: 'hidden',
  },
  sparkMiniFill: {
    width: '100%',
    borderRadius: 4,
    backgroundColor: 'rgba(22,163,74,0.85)',
  },
  sparkMiniLabel: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: '600',
    color: MUTED,
  },
  sparkBarsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  sparkBarCol: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sparkBarFill: {
    width: '100%',
    borderRadius: 4,
    backgroundColor: 'rgba(22,163,74,0.82)',
  },
  trendBarsRoot: {
    justifyContent: 'flex-start',
  },
  trendLegendText: {
    fontSize: 11,
    fontWeight: '600',
    color: MUTED,
    marginBottom: 6,
  },
  trendBarsFrame: {
    flex: 1,
    minHeight: 0,
  },
  trendBarsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    height: '100%',
    paddingTop: 4,
  },
  trendBarCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  trendValueLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: INK,
    marginBottom: 6,
    minHeight: 14,
  },
  trendTrack: {
    width: '100%',
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15,23,42,0.05)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  trendFill: {
    width: '100%',
    borderRadius: 6,
    backgroundColor: 'rgba(22,163,74,0.86)',
    minHeight: 6,
  },
  trendFillCurrent: {
    backgroundColor: '#15924e',
  },
  trendXAxis: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: '600',
    color: MUTED,
    minHeight: 14,
  },
})

/** Multi-week average Fillr fit trend (0–100). */
export function OverviewWeeklyFitTrendChart({
  points,
  width,
  height = 132,
}: {
  points: TrendWeekPoint[]
  width: number
  height?: number
}) {
  const vals = points.map((p) => p.avgFit).filter((v): v is number => v != null && v > 0)
  if (vals.length === 0) {
    return <View style={{ height }} />
  }
  const vmin = Math.max(0, Math.min(...vals) - 8)
  const vmax = Math.min(100, Math.max(...vals) + 8)
  const span = Math.max(1, vmax - vmin)

  const coords = points.map((p) => ({ v: p.avgFit, label: p.label }))

  const bars = coords.map((c) => {
    const bounded = c.v != null && c.v > 0 ? Math.max(vmin, Math.min(vmax, c.v)) : vmin
    const pct = (bounded - vmin) / span
    return { label: c.label, value: c.v, pct }
  })

  return (
    <View style={[styles.trendBarsRoot, { width, height }]}>
      <Text style={styles.trendLegendText}>Higher bar = better weekly fit</Text>
      <View style={styles.trendBarsFrame}>
        <View style={styles.trendBarsRow}>
          {bars.map((b, i) => (
            <View key={`trend-${b.label}-${i}`} style={styles.trendBarCol}>
              <Text style={styles.trendValueLabel}>{b.value != null && b.value > 0 ? b.value : ''}</Text>
              <View style={styles.trendTrack}>
                <View
                  style={[
                    styles.trendFill,
                    i === bars.length - 1 ? styles.trendFillCurrent : null,
                    { height: `${Math.max(8, b.pct * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.trendXAxis}>{b.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}
