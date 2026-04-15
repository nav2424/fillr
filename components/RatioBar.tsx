import { View, Text, StyleSheet } from 'react-native'
import { theme } from '../constants/theme'

export type RatioCounts = {
  natural: number
  processed: number
  additive: number
  flagged: number
}

const SEGMENTS: {
  key: keyof RatioCounts
  color: string
  label: string
}[] = [
  { key: 'natural', color: theme.green500, label: 'Natural' },
  { key: 'processed', color: theme.processed.accent, label: 'Processed' },
  { key: 'additive', color: theme.additive.accent, label: 'Additive' },
  { key: 'flagged', color: theme.flagged.accent, label: 'Flagged' },
]

export type RatioBarProps = {
  counts: RatioCounts
}

export function RatioBar({ counts }: RatioBarProps) {
  const active = SEGMENTS.filter((s) => counts[s.key] > 0)
  if (active.length === 0) return null

  return (
    <View style={styles.section}>
      <View style={styles.barRow}>
        {active.map((s) => (
          <View
            key={s.key}
            style={[styles.segment, { flex: counts[s.key], backgroundColor: s.color }]}
          />
        ))}
      </View>
      <View style={styles.legendRow}>
        {active.map((s) => (
          <View key={`leg-${s.key}`} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <Text style={styles.legendLabel}>
              {counts[s.key]} {s.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 22,
  },
  barRow: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 100,
    overflow: 'hidden',
    marginBottom: 10,
    gap: 2,
  },
  segment: {
    minWidth: 2,
    borderRadius: 100,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 50,
  },
  legendLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.textMuted,
  },
})
