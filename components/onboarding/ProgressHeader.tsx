import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { GlassProgressBar } from '../GlassProgressBar'
import { ONBOARDING_STEP_TOTAL } from '../../constants/onboardingFlow'
import { ob, obType } from '../../constants/onboardingTheme'

type Props = {
  /** 0-based step index (see `ONBOARDING_STEP`). */
  stepIndex: number
  onBack?: () => void
  backLabel?: string
  /** Optional right slot (e.g. skip) */
  right?: React.ReactNode
}

export function ProgressHeader({
  stepIndex,
  onBack,
  backLabel = 'Back',
  right,
}: Props) {
  const human = Math.min(ONBOARDING_STEP_TOTAL, Math.max(1, stepIndex + 1))
  return (
    <View style={styles.root}>
      <View style={styles.topRow}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={12}
            style={({ pressed }) => [styles.back, pressed && { opacity: 0.75 }]}
            accessibilityRole="button"
            accessibilityLabel={backLabel}
          >
            <Ionicons name="chevron-back" size={22} color={ob.inkMuted} />
            <Text style={styles.backText}>{backLabel}</Text>
          </Pressable>
        ) : (
          <View style={styles.backPlaceholder} />
        )}
        {right ?? <View style={styles.backPlaceholder} />}
      </View>
      <Text style={obType.overline} accessibilityLiveRegion="polite">
        Step {human} of {ONBOARDING_STEP_TOTAL}
      </Text>
      <GlassProgressBar total={ONBOARDING_STEP_TOTAL} current={stepIndex} accentColor={ob.accentBar} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    marginBottom: 18,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    minHeight: 40,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
    color: ob.inkMuted,
  },
  backPlaceholder: {
    width: 72,
    height: 8,
  },
  stepMeta: {
    textAlign: 'left',
    marginBottom: 8,
  },
})
