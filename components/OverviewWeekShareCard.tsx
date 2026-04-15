import { forwardRef, type ReactNode } from 'react'
import { View, Text, StyleSheet, Dimensions } from 'react-native'
import type { OverviewWeekShareCardModel } from '../lib/buildOverviewShareCardModel'

export { buildOverviewWeekShareCardModel } from '../lib/buildOverviewShareCardModel'
export type {
  OverviewWeekShareCardModel,
  OverviewWeekShareCardRow,
} from '../lib/buildOverviewShareCardModel'

export const SHARE_WEEK_MESSAGE =
  "I'm decoding ingredients with Fillr — scan any barcode. usefillr.com"

const INK = '#0f172a'
const LABEL_GRAY = '#9ca3af'
const COUNT_GRAY = '#94a3b8'
const RED = '#dc2626'
const GREEN_DOT = '#22c55e'

function scale(n: number, windowWidth: number) {
  return Math.round(n * Math.min(Math.max(windowWidth / 375, 0.92), 1.12))
}

/**
 * Minimal white card on black — matches classic Fillr week share layout.
 */
export const OverviewWeekShareCardVisual = forwardRef<View, OverviewWeekShareCardModel>(
  function OverviewWeekShareCardVisual(model, ref) {
    const screenW = Dimensions.get('window').width
    const outerPadX = scale(20, screenW)
    const cardW = Math.min(400, screenW - outerPadX * 2)

    const { weekLabel, scansThisWeek, flaggedIngredientsThisWeek, topRows } = model

    const Y = scansThisWeek
    const X = flaggedIngredientsThisWeek
    const flaggedZero = X === 0
    const mostOften = Y > 0 ? topRows.slice(0, 2) : []

    const dot = Math.max(6, scale(6, screenW))
    const fsBrand = scale(17, screenW)
    const fsWeek = scale(13, screenW)
    const fsSection = scale(10, screenW)
    const fsSummary = scale(22, screenW)
    const lhSummary = Math.round(fsSummary * 1.25)
    const fsRow = scale(15, screenW)
    const fsCount = scale(14, screenW)
    const fsFooter = scale(12, screenW)
    const padCard = scale(24, screenW)
    const rCard = scale(28, screenW)
    const gap = (n: number) => scale(n, screenW)

    let summaryLine: ReactNode
    if (Y === 0) {
      summaryLine = (
        <Text style={[styles.summaryLine, { fontSize: fsSummary, lineHeight: lhSummary }]} numberOfLines={2}>
          <Text style={styles.summaryBlack}>No scans this week yet.</Text>
        </Text>
      )
    } else if (flaggedZero) {
      summaryLine = (
        <Text style={[styles.summaryLine, { fontSize: fsSummary, lineHeight: lhSummary }]} numberOfLines={2}>
          <Text style={styles.summaryBlack}>0 flagged · </Text>
          <Text style={styles.summaryBlackBold}>{Y}</Text>
          <Text style={styles.summaryBlack}> {Y === 1 ? 'scan' : 'scans'}</Text>
        </Text>
      )
    } else {
      summaryLine = (
        <Text style={[styles.summaryLine, { fontSize: fsSummary, lineHeight: lhSummary }]} numberOfLines={2}>
          <Text style={styles.summaryRed}>{X}</Text>
          <Text style={styles.summaryBlack}> flagged · </Text>
          <Text style={styles.summaryBlackBold}>{Y}</Text>
          <Text style={styles.summaryBlack}> {Y === 1 ? 'scan' : 'scans'}</Text>
        </Text>
      )
    }

    return (
      <View
        ref={ref}
        collapsable={false}
        style={[styles.outer, { width: screenW, paddingHorizontal: outerPadX, paddingVertical: scale(36, screenW) }]}
      >
        <View style={[styles.card, { width: cardW, borderRadius: rCard, padding: padCard }]}>
          <View style={styles.headerRow}>
            <View style={styles.brand}>
              <View
                style={[
                  styles.brandDot,
                  {
                    width: dot,
                    height: dot,
                    borderRadius: dot / 2,
                    marginRight: scale(8, screenW),
                  },
                ]}
              />
              <Text style={[styles.wordmark, { fontSize: fsBrand }]}>fillr</Text>
            </View>
            <Text
              style={[styles.weekPlain, { fontSize: fsWeek, maxWidth: cardW * 0.52 }]}
              numberOfLines={1}
            >
              {weekLabel}
            </Text>
          </View>

          <Text
            style={[
              styles.sectionLabel,
              { fontSize: fsSection, letterSpacing: scale(1.8, screenW), marginTop: gap(22) },
            ]}
          >
            THIS WEEK
          </Text>
          <View style={{ marginTop: gap(8) }}>{summaryLine}</View>

          {mostOften.length > 0 ? (
            <>
              <Text
                style={[
                  styles.sectionLabel,
                  { fontSize: fsSection, letterSpacing: scale(1.8, screenW), marginTop: gap(22) },
                ]}
              >
                MOST OFTEN
              </Text>
              <View style={{ marginTop: gap(10) }}>
                {mostOften.map((row, i) => (
                  <View
                    key={`${row.name}-${i}`}
                    style={[styles.listRow, i > 0 && { marginTop: gap(12) }]}
                  >
                    <View
                      style={{
                        backgroundColor: RED,
                        width: scale(6, screenW),
                        height: scale(6, screenW),
                        borderRadius: scale(3, screenW),
                        marginRight: scale(10, screenW),
                        marginTop: scale(6, screenW),
                      }}
                    />
                    <Text
                      style={[styles.rowName, { fontSize: fsRow }]}
                      numberOfLines={2}
                    >
                      {row.name}
                    </Text>
                    <Text style={[styles.rowCount, { fontSize: fsCount }]}>×{row.count}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          <Text
            style={[
              styles.footerUrl,
              { fontSize: fsFooter, marginTop: mostOften.length > 0 ? gap(28) : gap(26) },
            ]}
          >
            usefillr.com
          </Text>
        </View>
      </View>
    )
  }
)

const styles = StyleSheet.create({
  outer: {
    backgroundColor: '#000000',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandDot: {
    backgroundColor: GREEN_DOT,
  },
  wordmark: {
    fontWeight: '700',
    color: INK,
    letterSpacing: -0.4,
  },
  weekPlain: {
    fontWeight: '500',
    color: LABEL_GRAY,
    textAlign: 'right',
  },
  sectionLabel: {
    fontWeight: '600',
    color: LABEL_GRAY,
    textTransform: 'uppercase',
  },
  summaryLine: {
    letterSpacing: -0.35,
  },
  summaryRed: {
    fontWeight: '800',
    color: RED,
  },
  summaryBlack: {
    fontWeight: '500',
    color: INK,
  },
  summaryBlackBold: {
    fontWeight: '800',
    color: INK,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  rowName: {
    flex: 1,
    minWidth: 0,
    fontWeight: '500',
    color: INK,
    letterSpacing: -0.2,
  },
  rowCount: {
    fontWeight: '600',
    color: COUNT_GRAY,
    fontVariant: ['tabular-nums'],
    marginLeft: 8,
  },
  footerUrl: {
    fontWeight: '500',
    color: LABEL_GRAY,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
})
