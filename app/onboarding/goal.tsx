import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import {
  FillrButton,
  GlassProgressBar,
  GlassOptionCard,
  GradientBackground,
} from '../../components'
import { colors, spacing, typography } from '../../constants/theme'
import { GOAL_OPTIONS } from '../../types'
import { useUserStore } from '../../store/userStore'

export default function OnboardingGoal() {
  const [selected, setSelected] = useState<string>(
    useUserStore.getState().goal || ''
  )

  const handleNext = () => {
    useUserStore.getState().setGoal(selected)
    router.push('/onboarding/camera')
  }

  return (
    <GradientBackground variant="minimal">
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.navRow}>
        <Pressable
          onPress={() => router.push('/onboarding/preferences')}
          hitSlop={10}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel="Back to previous question"
        >
          <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>
      <GlassProgressBar total={7} current={5} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.step}>Step 5 of 7</Text>
        <Text style={styles.title}>Your goal</Text>
        <Text style={styles.helper}>
          What do you want to achieve?
        </Text>
        <View style={styles.cards}>
          {GOAL_OPTIONS.map((opt) => (
            <GlassOptionCard
              key={opt.key}
              label={opt.label}
              selected={selected === opt.key}
              onPress={() => setSelected(opt.key)}
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
  cards: {
    gap: 0,
  },
})
