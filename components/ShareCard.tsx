import { forwardRef } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import ViewShot from 'react-native-view-shot'

const CARD_W = 268

export interface ShareCardProps {
  score: number
  verdict: string
  productName: string
  brand: string
  naturalCount: number
  totalCount: number
  scanDate: Date
}

function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#16a34a'
  if (score >= 40) return '#d97706'
  if (score >= 20) return '#ea580c'
  return '#dc2626'
}

function formatShareDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function verdictWithPeriod(verdict: string): string {
  const t = verdict.trim()
  if (!t) return ''
  return t.endsWith('.') ? t : `${t}.`
}

/**
 * Capturable scan share card (268px). Wrap with ViewShot ref + captureRef(); keep off-screen in parent.
 */
export const ShareCard = forwardRef<InstanceType<typeof ViewShot>, ShareCardProps>(function ShareCard(
  { score, verdict, productName, brand, naturalCount, totalCount, scanDate },
  ref
) {
  const clamped = Math.min(100, Math.max(0, score))
  const col = scoreColor(score)
  const verdictCol = score < 60 ? col : '#0f172a'
  const verdictLine = verdictWithPeriod(verdict)

  const brandLine = brand.trim()
  const nameLine = productName.trim()

  return (
    <ViewShot ref={ref} style={{ width: CARD_W }}>
      <View style={styles.card} collapsable={false}>
        <View style={styles.headerRow}>
          <View style={styles.logoRow}>
            <View style={styles.logoDot} />
            <Text style={styles.wordmark}>fillr</Text>
          </View>
          <Text style={styles.headerProduct} numberOfLines={2}>
            {brandLine ? (
              <>
                {brandLine}
                {'\n'}
                {nameLine}
              </>
            ) : (
              nameLine
            )}
          </Text>
        </View>

        <View style={styles.scoreSection}>
          <View style={styles.scoreRow}>
            <Text style={[styles.scoreNum, { color: col }]}>{Math.round(score)}</Text>
            <Text style={styles.scoreOutOf}>/100</Text>
          </View>
          <Text style={[styles.verdict, { color: verdictCol }]}>{verdictLine}</Text>
          <Text style={styles.subLine}>
            <Text style={styles.subLineStrong}>{naturalCount}</Text>
            {` of ${totalCount} ingredients clean`}
          </Text>
        </View>

        <View style={styles.track}>
          <View style={[styles.trackFill, { width: `${clamped}%`, backgroundColor: col }]} />
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footerUrl}>usefillr.com</Text>
          <Text style={styles.footerDate}>{formatShareDate(scanDate)}</Text>
        </View>
      </View>
    </ViewShot>
  )
})

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    backgroundColor: '#f6fbf7',
    borderRadius: 36,
    paddingTop: 32,
    paddingHorizontal: 30,
    paddingBottom: 28,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 44,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logoDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#22c55e',
  },
  wordmark: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0a0a0a',
    letterSpacing: -0.3,
  },
  headerProduct: {
    maxWidth: 120,
    fontSize: 10,
    fontWeight: '400',
    color: '#9ca3af',
    textAlign: 'right',
    lineHeight: 15,
  },
  scoreSection: {
    marginBottom: 44,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    marginBottom: 8,
  },
  scoreNum: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -2,
  },
  scoreOutOf: {
    fontSize: 13,
    fontWeight: '400',
    color: '#c8d6ca',
    paddingBottom: 4,
  },
  verdict: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginBottom: 10,
  },
  subLine: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9ca3af',
  },
  subLineStrong: {
    fontWeight: '600',
    color: '#6b7280',
  },
  track: {
    height: 2,
    backgroundColor: '#dceede',
    borderRadius: 100,
    overflow: 'hidden',
  },
  trackFill: {
    height: 2,
    borderRadius: 100,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 44,
  },
  footerUrl: {
    fontSize: 10,
    fontWeight: '500',
    color: '#c8d6ca',
    letterSpacing: 0.4,
  },
  footerDate: {
    fontSize: 10,
    fontWeight: '400',
    color: '#c8d6ca',
  },
})
