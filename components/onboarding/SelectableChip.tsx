import { Pressable, Text, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { ob } from '../../constants/onboardingTheme'

export type SelectableChipTone = 'allergy' | 'sensitivity' | 'preference' | 'neutral'

type Props = {
  label: string
  selected: boolean
  onPress: () => void
  tone?: SelectableChipTone
}

const toneMap: Record<
  SelectableChipTone,
  { idleBg: string; idleBorder: string; idleText: string; selBg: string; selBorder: string; selText: string }
> = {
  allergy: {
    idleBg: 'rgba(255, 255, 255, 0.72)',
    idleBorder: 'rgba(10, 22, 40, 0.08)',
    idleText: ob.ink,
    selBg: 'rgba(239, 68, 68, 0.1)',
    selBorder: 'rgba(220, 38, 38, 0.45)',
    selText: '#991b1b',
  },
  sensitivity: {
    idleBg: 'rgba(255, 255, 255, 0.72)',
    idleBorder: 'rgba(10, 22, 40, 0.08)',
    idleText: ob.ink,
    selBg: 'rgba(245, 158, 11, 0.1)',
    selBorder: 'rgba(217, 119, 6, 0.45)',
    selText: '#9a3412',
  },
  preference: {
    idleBg: 'rgba(255, 255, 255, 0.72)',
    idleBorder: 'rgba(10, 22, 40, 0.08)',
    idleText: ob.ink,
    selBg: 'rgba(16, 185, 129, 0.1)',
    selBorder: 'rgba(5, 150, 105, 0.42)',
    selText: '#047857',
  },
  neutral: {
    idleBg: 'rgba(255,255,255,0.72)',
    idleBorder: 'rgba(10, 22, 40, 0.08)',
    idleText: ob.inkMuted,
    selBg: 'rgba(10, 22, 40, 0.05)',
    selBorder: 'rgba(10, 22, 40, 0.35)',
    selText: ob.ink,
  },
}

export function SelectableChip({ label, selected, onPress, tone = 'neutral' }: Props) {
  const t = toneMap[tone]
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: selected ? t.selBg : t.idleBg,
          borderColor: selected ? t.selBorder : t.idleBorder,
          borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth,
        },
        pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {selected ? (
        <View style={styles.check}>
          <Ionicons name="checkmark" size={13} color={t.selText} />
        </View>
      ) : null}
      <Text style={[styles.label, { color: selected ? t.selText : t.idleText }]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 999,
    gap: 5,
  },
  check: {
    marginRight: -1,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
})
