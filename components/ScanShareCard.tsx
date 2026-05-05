import { forwardRef, type ReactNode } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { FILLR_WEB_HOST } from '../constants/legalUrls'
import type { ScanShareCardModel } from '../lib/buildShareScanCardModel'
import {
  SHARE_SCAN_CAPTURE_WIDTH,
  SHARE_SCAN_CARD_INNER_WIDTH,
  SHARE_SCAN_OUTER_PAD_X,
} from '../lib/buildShareScanCardModel'

export {
  buildScanShareCardModel,
  SHARE_SCAN_CAPTURE_WIDTH,
  SHARE_SCAN_CARD_INNER_WIDTH,
  SHARE_SCAN_CARD_WIDTH,
  SHARE_SCAN_OUTER_PAD_X,
} from '../lib/buildShareScanCardModel'
export type { ScanShareCardModel } from '../lib/buildShareScanCardModel'

export const SHARE_SCAN_MESSAGE = `I use Fillr to read food labels for me — you can try it at ${FILLR_WEB_HOST}`

function capitalizeWord(s: string): string {
  const t = s.trim()
  if (!t) return t
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
}

const INK = '#0f172a'
const LABEL_GRAY = '#9ca3af'
const COUNT_GRAY = '#94a3b8'
const RED = '#dc2626'
const GREEN_DOT = '#22c55e'

const OUTER_PAD_Y = 36
const CARD_RADIUS = 40
const CARD_PAD = 24

const INNER_W = SHARE_SCAN_CARD_INNER_WIDTH

const TAGLINE =
  'Fillr is a food app: scan a barcode and it reads the ingredient list in plain English.'

/**
 * Share card for people who have never used Fillr: one-sentence product + scannable bullets.
 */
export const ScanShareCardVisual = forwardRef<View, ScanShareCardModel>(function ScanShareCardVisual(
  model,
  ref
) {
  const {
    productName,
    ingredientCount,
    headerRight,
    counts,
    flaggedRows,
    fillrLine,
    allergyMatch,
    allergenName,
  } = model

  const flaggedCount = counts.flagged
  const total = ingredientCount
  const listRows = total > 0 && flaggedRows.length > 0 ? flaggedRows.slice(0, 3) : []

  let summaryBlock: ReactNode
  if (total === 0) {
    summaryBlock = (
      <Text style={styles.bodyText}>
        We couldn&apos;t load ingredients for this item (sometimes the database doesn&apos;t have the label yet).
      </Text>
    )
  } else {
    summaryBlock = (
      <View style={styles.summaryList}>
        <Text style={styles.summaryBullet}>
          • This package lists <Text style={styles.bodyBold}>{total}</Text>
          {total === 1 ? ' ingredient' : ' ingredients'}.
        </Text>
        {flaggedCount === 0 ? (
          <Text style={styles.summaryBullet}>
            • The app didn&apos;t mark anything as worth an extra look.
          </Text>
        ) : (
          <Text style={styles.summaryBullet}>
            • The app marked <Text style={styles.bodyRed}>{flaggedCount}</Text>
            {flaggedCount === 1 ? ' ingredient' : ' ingredients'} for a closer look.
          </Text>
        )}
        <Text style={styles.summaryHint}>If you have allergies, always read the real label yourself.</Text>
      </View>
    )
  }

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[
        styles.outer,
        {
          width: SHARE_SCAN_CAPTURE_WIDTH,
          paddingHorizontal: SHARE_SCAN_OUTER_PAD_X,
          paddingVertical: OUTER_PAD_Y,
        },
      ]}
    >
      <View style={[styles.card, { width: INNER_W, borderRadius: CARD_RADIUS, padding: CARD_PAD }]}>
        <View style={styles.headerRow}>
          <View style={styles.brand}>
            <View style={styles.brandDot} />
            <Text style={styles.wordmark}>fillr</Text>
          </View>
          <Text style={[styles.headerMeta, { maxWidth: INNER_W * 0.52 }]} numberOfLines={1}>
            {headerRight}
          </Text>
        </View>

        <Text style={styles.tagline}>{TAGLINE}</Text>

        <Text style={styles.productTitle} numberOfLines={4}>
          {productName}
        </Text>

        <View style={styles.divider} />

        <View style={styles.blockGap}>{summaryBlock}</View>

        {fillrLine && total > 0 ? (
          <View style={styles.scoreBlock}>
            <Text style={styles.scoreLabel}>How &quot;whole-food&quot; the label looks to the app</Text>
            <Text style={styles.scoreBig}>
              <Text style={styles.scoreNumber}>{fillrLine.score}</Text>
              <Text style={styles.scoreOutOf}>/100</Text>
            </Text>
            <Text style={styles.scoreVerdict}>{fillrLine.verdict}</Text>
            <Text style={styles.scoreHint}>Just a rough guide — not medical advice.</Text>
          </View>
        ) : null}

        {allergyMatch && allergenName ? (
          <View style={styles.alertBlock}>
            <Text style={styles.alertTitle}>Note for whoever shared this</Text>
            <Text style={styles.alertText}>
              The product contains <Text style={styles.alertStrong}>{capitalizeWord(allergenName)}</Text>
              {` — that doesn't work for their saved diet or allergy settings.`}
            </Text>
          </View>
        ) : null}

        {listRows.length > 0 ? (
          <View style={styles.listSection}>
            <Text style={styles.listTitle}>Some of what the app pointed at</Text>
            {listRows.map((row, i) => (
              <View key={`${row.name}-${i}`} style={[styles.listRow, i > 0 && styles.listRowSpaced]}>
                <View style={styles.rowBullet} />
                <Text style={styles.rowName} numberOfLines={3}>
                  {row.name}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.footerBlock}>
          <Text style={styles.footerUrl}>{FILLR_WEB_HOST}</Text>
          <Text style={styles.footerSub}>Get the app and scan any barcode to read the label in plain English.</Text>
        </View>
      </View>
    </View>
  )
})

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
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GREEN_DOT,
    marginRight: 8,
  },
  wordmark: {
    fontSize: 17,
    fontWeight: '700',
    color: INK,
    letterSpacing: -0.4,
  },
  headerMeta: {
    fontSize: 13,
    fontWeight: '500',
    color: LABEL_GRAY,
    textAlign: 'right',
  },
  tagline: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '500',
    color: COUNT_GRAY,
    lineHeight: 17,
    letterSpacing: -0.05,
  },
  productTitle: {
    marginTop: 12,
    fontSize: 17,
    fontWeight: '700',
    color: INK,
    letterSpacing: -0.35,
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginTop: 16,
    marginBottom: 4,
  },
  blockGap: {
    marginTop: 12,
  },
  summaryList: {
    gap: 8,
  },
  summaryBullet: {
    fontSize: 15,
    fontWeight: '500',
    color: INK,
    lineHeight: 22,
    letterSpacing: -0.15,
  },
  summaryHint: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '500',
    color: COUNT_GRAY,
    lineHeight: 17,
  },
  bodyText: {
    fontSize: 15,
    fontWeight: '500',
    color: INK,
    lineHeight: 22,
    letterSpacing: -0.15,
  },
  bodyBold: {
    fontWeight: '800',
    color: INK,
  },
  bodyRed: {
    fontWeight: '800',
    color: RED,
  },
  scoreBlock: {
    marginTop: 16,
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  scoreLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: LABEL_GRAY,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  scoreBig: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    marginBottom: 2,
  },
  scoreNumber: {
    fontSize: 36,
    fontWeight: '900',
    color: INK,
    letterSpacing: -1.5,
    lineHeight: 38,
  },
  scoreOutOf: {
    fontSize: 16,
    fontWeight: '600',
    color: LABEL_GRAY,
    paddingBottom: 4,
  },
  scoreVerdict: {
    fontSize: 16,
    fontWeight: '700',
    color: INK,
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  scoreHint: {
    fontSize: 11,
    fontWeight: '500',
    color: COUNT_GRAY,
    lineHeight: 15,
  },
  alertBlock: {
    marginTop: 14,
    padding: 12,
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  alertTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 6,
    letterSpacing: -0.1,
  },
  alertText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#78350f',
    lineHeight: 19,
  },
  alertStrong: {
    fontWeight: '800',
    color: '#92400e',
  },
  listSection: {
    marginTop: 16,
  },
  listTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: INK,
    marginBottom: 10,
    letterSpacing: -0.15,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  listRowSpaced: {
    marginTop: 10,
  },
  rowBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: RED,
    marginRight: 10,
    marginTop: 7,
  },
  rowName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: INK,
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  footerBlock: {
    marginTop: 22,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    alignItems: 'center',
  },
  footerUrl: {
    fontSize: 14,
    fontWeight: '700',
    color: INK,
    letterSpacing: -0.1,
  },
  footerSub: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '500',
    color: LABEL_GRAY,
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 8,
  },
})
