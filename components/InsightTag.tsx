import { View, Text, StyleSheet } from 'react-native'
import { colors, spacing, radius, typography } from '../constants/theme'

type TagVariant = 'info' | 'warning' | 'positive' | 'neutral'

interface InsightTagProps {
  label: string
  variant?: TagVariant
}

const VARIANT_STYLES: Record<TagVariant, { bg: string; text: string }> = {
  info: { bg: colors.accentMuted, text: colors.accent },
  warning: { bg: colors.cautionMuted, text: colors.caution },
  positive: { bg: colors.safeMuted, text: colors.safe },
  neutral: { bg: 'rgba(0,0,0,0.05)', text: colors.textSecondary },
}

export function InsightTag({ label, variant = 'neutral' }: InsightTagProps) {
  const { bg, text } = VARIANT_STYLES[variant]
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: text }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  tag: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  text: {
    ...typography.labelSmall,
  },
})
