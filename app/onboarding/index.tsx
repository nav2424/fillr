import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { FillrButton, GradientBackground } from '../../components'
import { colors, spacing, typography } from '../../constants/theme'
import { useUserStore } from '../../store/userStore'

export default function OnboardingWelcome() {
  return (
    <GradientBackground variant="welcome">
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <Text style={styles.step}>Step 1 of 7</Text>
          <Text style={styles.title}>Know what's really in your food</Text>
          <Text style={styles.subtitle}>
            Scan any barcode and get ingredient-level breakdowns tailored to your allergies and goals.
          </Text>
        </View>
        <FillrButton
          title="Get started"
          onPress={() => {
            useUserStore.getState().clearOnboardingDraft()
            router.push('/onboarding/allergies')
          }}
          fullWidth
        />
      </SafeAreaView>
    </GradientBackground>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.md,
  },
  step: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    maxWidth: 320,
  },
})
