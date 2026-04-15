import { useLayoutEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Alert, Pressable } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Stack, router, useNavigation } from 'expo-router'
import { GradientBackground, FillrButton, StackBackButton } from '../components'
import { colors, spacing, typography, radius } from '../constants/theme'
import { FREE_SCAN_LIMIT } from '../constants/subscription'
import { useUserStore } from '../store/userStore'
import { showPaywall } from '../services/paywallService'
import { restorePurchases } from '../services/revenuecatService'

const LIGHT_GREEN = colors.backgroundLightGreen

const screenOptions = {
  title: 'Subscription',
  headerShown: true,
  headerStyle: { backgroundColor: LIGHT_GREEN },
  headerShadowVisible: false,
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '700' as const, color: colors.text },
  headerBackVisible: false,
  headerLeft: () => <StackBackButton />,
}

export default function ManageSubscriptionScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const isPro = useUserStore((s) => s.isPro)
  const [openingPaywall, setOpeningPaywall] = useState(false)
  const used = useUserStore((s) => s.totalScansUsed ?? 0)
  const bonus = useUserStore((s) => s.bonusScansEarned ?? 0)
  const totalAllowance = FREE_SCAN_LIMIT + bonus
  const remaining = Math.max(0, totalAllowance - used)

  useLayoutEffect(() => {
    navigation.setOptions(screenOptions)
  }, [navigation])

  const onUpgrade = () => {
    if (openingPaywall) return
    void (async () => {
      setOpeningPaywall(true)
      try {
        const purchased = await showPaywall()
        if (purchased) {
          Alert.alert('You are now Premium', 'Unlimited scans are now active.')
          return
        }
        Alert.alert(
          'Unable to open Premium checkout',
          'Please try again, or tap Restore purchases if you already subscribed.'
        )
      } finally {
        setOpeningPaywall(false)
      }
    })()
  }

  const onRestore = () => {
    void restorePurchases()
  }

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <GradientBackground variant="home">
        <SafeAreaView style={styles.screen} edges={['bottom']}>
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.eyebrow}>Your plan</Text>
            <Text style={styles.title}>{isPro ? 'Fillr Premium' : 'Free'}</Text>
            <Text style={styles.lead}>
              {isPro
                ? 'You have unlimited scans and premium breakdowns. Manage renewal in the App Store when billing goes live.'
                : `Free plan includes ${FREE_SCAN_LIMIT} base scans plus bonus scans from referrals.`}
            </Text>

            {!isPro && (
              <View style={styles.usageCard}>
                <Text style={styles.usageLabel}>Free scans</Text>
                <Text style={styles.usageBig}>
                  {remaining} left
                  <Text style={styles.usageOf}> · {used} used · {bonus} bonus</Text>
                </Text>
                <View style={styles.track}>
                  <View
                    style={[
                      styles.trackFill,
                      {
                        width: `${Math.min(100, (used / Math.max(totalAllowance, 1)) * 100)}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            )}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Premium includes</Text>
              <Text style={styles.bullet}>• Unlimited barcode scans</Text>
              <Text style={styles.bullet}>• Full ingredient breakdowns & Label vs Reality</Text>
              <Text style={styles.bullet}>• Priority when we add new data sources</Text>
            </View>

            {!isPro && (
              <FillrButton
                title={openingPaywall ? 'Opening Premium checkout...' : 'Upgrade to Fillr Premium'}
                onPress={onUpgrade}
                disabled={openingPaywall}
                fullWidth
                style={styles.cta}
              />
            )}
            {!isPro && (
              <>
                <View style={styles.orRow}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>or</Text>
                  <View style={styles.orLine} />
                </View>
                <Pressable
                  onPress={() => router.replace('/(tabs)/profile')}
                  style={({ pressed }) => [styles.referralNudge, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.referralNudgeText}>
                    Invite a friend instead — earn 5 free scans →
                  </Text>
                </Pressable>
              </>
            )}
            <FillrButton title="Restore purchases" onPress={onRestore} variant="secondary" fullWidth />
          </ScrollView>
        </SafeAreaView>
      </GradientBackground>
    </>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },
  lead: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  usageCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
    marginBottom: spacing.xl,
  },
  usageLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.xs,
  },
  usageBig: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.md,
  },
  usageOf: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(15,23,42,0.08)',
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.accent,
    minWidth: 4,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
    marginBottom: spacing.xl,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  bullet: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  cta: {
    marginBottom: spacing.md,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  orLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(15,23,42,0.16)',
  },
  orText: {
    marginHorizontal: spacing.md,
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  referralNudge: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  referralNudgeText: {
    fontSize: 14,
    color: '#16a34a',
    fontWeight: '600',
  },
})
