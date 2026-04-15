import { useState } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Camera } from 'expo-camera'
import { Ionicons } from '@expo/vector-icons'
import {
  FillrButton,
  GlassProgressBar,
  GradientBackground,
  GlassCard,
} from '../../components'
import { colors, spacing, typography } from '../../constants/theme'

export default function OnboardingCamera() {
  const [requesting, setRequesting] = useState(false)

  const handleAllow = async () => {
    setRequesting(true)
    try {
      await Camera.requestCameraPermissionsAsync()
    } finally {
      setRequesting(false)
      router.push('/onboarding/confirm')
    }
  }

  return (
    <GradientBackground variant="minimal">
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.navRow}>
          <Pressable
            onPress={() => router.push('/onboarding/goal')}
            hitSlop={10}
            style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Back to previous question"
          >
            <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>
        <GlassProgressBar total={7} current={6} />
        <View style={styles.content}>
          <GlassCard style={styles.card} intensity={55}>
            <Text style={styles.step}>Step 6 of 7</Text>
            <Text style={styles.title}>Ready to scan your first product?</Text>
            <Text style={styles.helper}>
              Allow camera access so Fillr can scan barcodes and break down ingredients instantly.
            </Text>
          </GlassCard>
        </View>
        <View style={styles.actions}>
          <FillrButton
            title={requesting ? 'Requesting...' : 'Allow camera & continue'}
            onPress={() => void handleAllow()}
            fullWidth
          />
          <FillrButton
            title="Maybe later"
            variant="secondary"
            onPress={() => router.push('/onboarding/confirm')}
            fullWidth
          />
        </View>
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
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    padding: spacing.xl,
  },
  step: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    fontWeight: '700',
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.md,
  },
  helper: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  actions: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
})

