import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { FillrButton } from '../components'
import { REFERRAL_INVITEE_STARTING_SCANS } from '../constants/subscription'
import { colors, radius, spacing, typography } from '../constants/theme'

export default function ReferralSuccessScreen() {
  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <Text style={styles.title}>You&apos;re all set</Text>
          <Text style={styles.subtitle}>Your profile is ready to personalize every scan.</Text>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Starting balance</Text>
            <Text style={styles.cardValue}>{REFERRAL_INVITEE_STARTING_SCANS} scans</Text>
            <Text style={styles.cardHint}>Includes your referral bonus</Text>
          </View>
        </View>

        <FillrButton
          title="Start scanning"
          onPress={() => router.replace('/')}
          fullWidth
          variant="liquid"
        />
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    justifyContent: 'space-between',
    paddingBottom: spacing.lg,
  },
  content: { paddingTop: spacing.xxxl },
  title: {
    ...typography.h1,
    fontSize: 26,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    padding: spacing.xl,
    gap: spacing.xs,
  },
  cardLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  cardValue: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: -0.5,
  },
  cardHint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
})
