import { View, Text, StyleSheet } from 'react-native'
import { theme } from '../constants/theme'

export type AllergenPillProps = {
  /** Declared allergens (product contains); takes precedence over traces. */
  declaresText: string | null
  /** May contain / traces when there is no direct allergen declaration list. */
  tracesText: string | null
}

/**
 * Renders when `allergensTags` and/or `tracesTags` on the product are non-empty
 * (declares line preferred over traces-only).
 */
export function AllergenPill({ declaresText, tracesText }: AllergenPillProps) {
  const hasDeclares = Boolean(declaresText?.trim())
  const hasTraces = Boolean(tracesText?.trim())
  if (!hasDeclares && !hasTraces) return null

  const strong = (hasDeclares ? declaresText : tracesText)!.trim()
  const prefix = hasDeclares ? 'Declares: ' : 'May contain: '
  const suffix = hasDeclares ? ' — check if this affects you' : ' — cross-contamination risk'

  return (
    <View style={styles.pill}>
      <Text style={styles.icon} accessibilityLabel="Warning">
        ⚠️
      </Text>
      <Text style={styles.copy}>
        {prefix}
        <Text style={styles.copyStrong}>{strong}</Text>
        {suffix}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.allergenBg,
    borderWidth: 1.5,
    borderColor: theme.allergenBorder,
    borderRadius: 100,
    paddingVertical: 6,
    paddingLeft: 8,
    paddingRight: 12,
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  icon: {
    fontSize: 13,
  },
  copy: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '600',
    color: theme.allergenText,
  },
  copyStrong: {
    fontWeight: '700',
    color: theme.allergenTextStrong,
  },
})
