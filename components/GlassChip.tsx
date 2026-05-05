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

/** Idle + selected — keeps allergies / sensitivities / preferences visually distinct at a glance. */
const VARIANT_COLORS: Record<
  ChipVariant,
  {
    bgIdle: string
    borderIdle: string
    textIdle: string
    bgSelected: string
    borderSelected: string
    textSelected: string
  }
> = {
  danger: {
    bgIdle: 'rgba(255, 69, 58, 0.1)',
    borderIdle: 'rgba(255, 69, 58, 0.32)',
    textIdle: '#b91c1c',
    bgSelected: colors.dangerMuted,
    borderSelected: colors.danger,
    textSelected: '#991b1b',
  },
  caution: {
    bgIdle: 'rgba(255, 159, 10, 0.12)',
    borderIdle: 'rgba(255, 159, 10, 0.38)',
    textIdle: '#c2410c',
    bgSelected: colors.cautionMuted,
    borderSelected: colors.caution,
    textSelected: '#9a3412',
  },
  safe: {
    bgIdle: 'rgba(48, 209, 88, 0.11)',
    borderIdle: 'rgba(22, 163, 74, 0.35)',
    textIdle: '#166534',
    bgSelected: colors.safeMuted,
    borderSelected: colors.safe,
    textSelected: '#14532d',
  },
  default: {
    bgIdle: 'rgba(255,255,255,0.92)',
    borderIdle: 'rgba(10, 40, 24, 0.1)',
    textIdle: colors.textSecondary,
    bgSelected: colors.accentMuted,
    borderSelected: colors.accent,
    textSelected: colors.accent,
  },
}

export function GlassChip({
  label,
  selected = false,
  variant = 'default',
  onPress,
}: GlassChipProps) {
  const v = VARIANT_COLORS[variant]

  const chipContent = (
    <>
      {selected && (
        <Ionicons name="checkmark-circle" size={16} color={v.textSelected} style={styles.checkIcon} />
      )}
      <Text
        style={[
          styles.text,
          { color: selected ? v.textSelected : v.textIdle, fontWeight: selected ? '700' : '600' },
        ]}
      >
        {label}
      </Text>
    </>
  )

  const chipStyle = [
    styles.chip,
    {
      backgroundColor: selected ? v.bgSelected : v.bgIdle,
      borderColor: selected ? v.borderSelected : v.borderIdle,
      borderWidth: selected ? 2 : 1,
    },
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
})
