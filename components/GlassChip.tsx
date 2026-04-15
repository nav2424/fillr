import { Platform, Pressable, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import { colors, spacing, radius, typography } from '../constants/theme'

type ChipVariant = 'danger' | 'caution' | 'safe' | 'default'

interface GlassChipProps {
  label: string
  selected?: boolean
  variant?: ChipVariant
  onPress?: () => void
}

const VARIANT_COLORS: Record<ChipVariant, { bg: string; bgSelected: string; text: string }> = {
  danger: { bg: 'rgba(255,255,255,0.9)', bgSelected: colors.dangerMuted, text: colors.danger },
  caution: { bg: 'rgba(255,255,255,0.9)', bgSelected: colors.cautionMuted, text: colors.caution },
  safe: { bg: 'rgba(255,255,255,0.9)', bgSelected: colors.safeMuted, text: colors.safe },
  default: { bg: 'rgba(255,255,255,0.9)', bgSelected: colors.accentMuted, text: colors.accent },
}

export function GlassChip({
  label,
  selected = false,
  variant = 'default',
  onPress,
}: GlassChipProps) {
  const { bg, bgSelected, text } = VARIANT_COLORS[variant]

  const chipContent = (
    <>
      {selected && <Ionicons name="checkmark-circle" size={16} color={text} style={styles.checkIcon} />}
      <Text
        style={[
          styles.text,
          selected ? styles.textSelected : styles.textDefault,
          selected && { color: text },
        ]}
      >
        {label}
      </Text>
    </>
  )

  const chipStyle = [
    styles.chip,
    { backgroundColor: selected ? bgSelected : bg },
    selected && { borderColor: text, borderWidth: 2 },
  ]

  if (Platform.OS === 'web') {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [chipStyle, pressed && styles.pressed]}
      >
        {chipContent}
      </Pressable>
    )
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.wrapper, pressed && styles.pressed]}>
      <BlurView
        intensity={selected ? 60 : 30}
        tint="light"
        style={[styles.blur, ...chipStyle]}
      >
        {chipContent}
      </BlurView>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  blur: {
    overflow: 'hidden',
  },
  checkIcon: {
    marginRight: spacing.xs,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  text: {
    ...typography.labelSmall,
    fontSize: 13,
  },
  textDefault: {
    color: colors.textSecondary,
  },
  textSelected: {
    fontWeight: '700',
  },
})
