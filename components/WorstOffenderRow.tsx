import { View, Text, StyleSheet, Platform } from 'react-native'
import type { HomeWorstOffender } from '../lib/buildHomeScreenData'

const INK = '#0a2810'

export type WorstOffenderRowFonts = {
  sansSemiBold: string
  sans: string
  serif: string
}

export function WorstOffenderRow({
  row,
  fonts,
}: {
  row: HomeWorstOffender | null
  fonts: WorstOffenderRowFonts
}) {
  const rank = row?.rank ?? 0
  const rankColor = rank > 0 && rank <= 2 ? 'rgba(220,38,38,0.45)' : 'rgba(10,40,18,0.28)'
  const empty = !row
  const scanLabel = empty || !row ? '' : row.scanCountThisWeek === 1 ? 'scan' : 'scans'
  return (
    <View style={styles.offenderRow}>
      <Text style={[styles.offenderRank, { fontFamily: fonts.serif, color: rankColor }]}>
        {empty ? '—' : row.rank}
      </Text>
      <View style={styles.offenderMain}>
        <View style={styles.offenderNameRow}>
          <Text
            style={[
              styles.offenderName,
              { fontFamily: fonts.sansSemiBold },
              Platform.OS === 'android' ? { includeFontPadding: false } : null,
            ]}
            numberOfLines={2}
          >
            {empty ? '—' : row.ingredientName}
          </Text>
          <View style={styles.offenderStats}>
            <Text
              style={[
                styles.offenderAddCount,
                { fontFamily: fonts.serif, color: empty ? 'rgba(10,40,18,0.2)' : '#dc2626' },
                Platform.OS === 'android' ? { includeFontPadding: false } : null,
              ]}
            >
              {empty ? '—' : row.scanCountThisWeek}
            </Text>
            <Text style={[styles.offenderAddLabel, { fontFamily: fonts.sans }]}>
              {scanLabel || '\u00a0'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  offenderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
  },
  offenderRank: { width: 22, fontSize: 18, textAlign: 'center' },
  offenderMain: { flex: 1, minWidth: 0 },
  offenderNameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  offenderName: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    lineHeight: 20,
    color: INK,
  },
  offenderStats: { alignItems: 'flex-end', flexShrink: 0 },
  offenderAddCount: { fontSize: 22, lineHeight: 24 },
  offenderAddLabel: { fontSize: 10, color: 'rgba(10,40,18,0.38)', marginTop: 2 },
})
