import { Pressable, Text, StyleSheet, View } from 'react-native'
import { colors, spacing, radius, typography } from '../constants/theme'

type ChipVariant = 'default' | 'selected' | 'danger' | 'caution' | 'safe'

interface FillrChipProps {
  label: string
  selected?: boolean
  variant?: ChipVariant
  onPress?: () => void
}

export function FillrChip({
  label,
  selected = false,
  variant = 'default',
  onPress,
}: FillrChipProps) {
  const variantStyles = {
    default: selected ? styles.selectedDefault : styles.default,
    selected: styles.selectedDefault,
    danger: selected ? styles.selectedDanger : styles.danger,
    caution: selected ? styles.selectedCaution : styles.caution,
    safe: selected ? styles.selectedSafe : styles.safe,
  }
  const textVariantStyles = {
    default: selected ? styles.textSelected : styles.textDefault,
    selected: styles.textSelected,
    danger: selected ? styles.textSelected : styles.textDanger,
    caution: selected ? styles.textSelected : styles.textCaution,
    safe: selected ? styles.textSelected : styles.textSafe,
  }

  const containerStyle = variantStyles[variant]
  const textStyle = textVariantStyles[variant]

  const content = (
    <Text style={[styles.text, textStyle]}>{label}</Text>
  )

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.chip, containerStyle, pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    )
  }

  return <View style={[styles.chip, containerStyle]}>{content}</View>
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  pressed: {
    opacity: 0.8,
  },
  text: {
    ...typography.labelSmall,
  },
  default: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedDefault: {
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  textDefault: {
    color: colors.textSecondary,
  },
  textSelected: {
    color: colors.text,
  },
  danger: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedDanger: {
    backgroundColor: colors.dangerMuted,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  textDanger: {
    color: colors.textSecondary,
  },
  caution: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedCaution: {
    backgroundColor: colors.cautionMuted,
    borderWidth: 1,
    borderColor: colors.caution,
  },
  textCaution: {
    color: colors.textSecondary,
  },
  safe: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedSafe: {
    backgroundColor: colors.safeMuted,
    borderWidth: 1,
    borderColor: colors.safe,
  },
  textSafe: {
    color: colors.textSecondary,
  },
})
