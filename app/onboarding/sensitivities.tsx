import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import {
  FillrButton,
  GlassChip,
  GlassProgressBar,
  GradientBackground,
} from '../../components'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, typography } from '../../constants/theme'
import { SENSITIVITY_OPTIONS } from '../../types'
import { useUserStore } from '../../store/userStore'

export default function OnboardingSensitivities() {
  const [selected, setSelected] = useState<string[]>(
    useUserStore.getState().sensitivities
  )

  const toggle = (key: string) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  const handleNext = () => {
    useUserStore.getState().setSensitivities(selected)
    router.push('/onboarding/preferences')
  }

  return (
    <GradientBackground variant="minimal">
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.navRow}>
        <Pressable
          onPress={() => router.push('/onboarding/allergies')}
          hitSlop={10}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel="Back to previous question"
        >
          <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>
      <GlassProgressBar total={7} current={3} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.step}>Step 3 of 7</Text>
        <Text style={styles.title}>Sensitivities</Text>
        <Text style={styles.helper}>
          We'll give you a heads-up
        </Text>
        <View style={styles.chips}>
          {SENSITIVITY_OPTIONS.map((opt) => (
            <GlassChip
              key={opt.key}
              label={opt.label}
              selected={selected.includes(opt.key)}
              variant="caution"
              onPress={() => toggle(opt.key)}
            />
          ))}
        </View>
      </ScrollView>
      <FillrButton title="Continue" onPress={handleNext} fullWidth />
      </SafeAreaView>
    </GradientBackground>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backBtnPressed: {
    opacity: 0.9,
  },
  backText: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  step: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    fontWeight: '700',
  },
  helper: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
})
