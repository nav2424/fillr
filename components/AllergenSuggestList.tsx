import { View, Text, StyleSheet, Pressable } from 'react-native'
import type { AllergenPickRow, ScoredAllergenPick } from '../lib/knownAllergens'
import { ob } from '../constants/onboardingTheme'

export function AllergenSuggestList({
  picks,
  onPick,
}: {
  picks: ScoredAllergenPick[]
  onPick: (row: AllergenPickRow) => void
}) {
  if (picks.length === 0) return null
  return (
    <View style={styles.wrap} accessibilityRole="list">
      {picks.map(({ row }, i) => (
        <Pressable
          key={`${row.key}-${row.title}-${i}`}
          onPress={() => onPick(row)}
          style={({ pressed }) => [
            styles.row,
            i === picks.length - 1 && styles.rowLast,
            pressed && styles.rowPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${row.title}. ${row.subtitle}`}
        >
          <Text style={styles.title}>{row.title}</Text>
          <Text style={styles.subtitle}>{row.subtitle}</Text>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(10, 22, 40, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    overflow: 'hidden',
  },
  row: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(10, 22, 40, 0.06)',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowPressed: {
    backgroundColor: 'rgba(34, 197, 94, 0.06)',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: ob.ink,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: ob.inkMuted,
    marginTop: 2,
    lineHeight: 18,
  },
})
