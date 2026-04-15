import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useGlobalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { FillrButton, GlassProgressBar, GradientBackground } from '../../components'
import { colors, spacing, radius, typography } from '../../constants/theme'
import { useUserStore } from '../../store/userStore'
import { useAuthStore } from '../../store/authStore'
import {
  SENSITIVITY_OPTIONS,
  PREFERENCE_OPTIONS,
  GOAL_OPTIONS,
} from '../../types'
import { getAllergyLabel } from '../../lib/knownAllergens'
import { buildDietaryProfileFromZustand } from '../../lib/onboardingProfile'
import { setOnboardingCompletedOnServer } from '../../lib/authService'
import { setPendingSignupAfterOnboarding } from '../../lib/pendingSignup'
import { looksLikeReferralCode, normalizeReferralCode } from '../../lib/referrals'
import { useCurrentScanStore } from '../../store/currentScanStore'
import { mockProductByBarcode, DEMO_SCAN_BARCODE } from '../../services/mockProducts'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { saveUserProfile } = require('../../store/userProfileStore.js') as {
  saveUserProfile: (p: {
    allergies: string[]
    sensitivities: string[]
    avoiding: string[]
    preferences: string[]
    goal?: string
  }) => Promise<void>
}

type WhyRow = { label: string; why: string }

type SummarySection = {
  key: string
  title: string
  subtitle: string
  icon: keyof typeof Ionicons.glyphMap
  tint: string
  tintBg: string
  rows: WhyRow[]
}

function SectionBlock({ section }: { section: SummarySection }) {
  if (section.rows.length === 0) return null
  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIconWrap, { backgroundColor: section.tintBg }]}>
          <Ionicons name={section.icon} size={20} color={section.tint} />
        </View>
        <View style={styles.sectionHeaderText}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
        </View>
      </View>
      <View style={styles.sectionItems}>
        {section.rows.map((row) => (
          <View key={row.label} style={styles.detailRow}>
            <View style={[styles.detailAccent, { backgroundColor: section.tint }]} />
            <View style={styles.detailBody}>
              <Text style={styles.detailLabel}>{row.label}</Text>
              <Text style={styles.detailWhy}>{row.why}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

export default function OnboardingConfirm() {
  const globalParams = useGlobalSearchParams<{ ref?: string }>()
  const { allergies, sensitivities, preferences, goal } = useUserStore()
  const userId = useAuthStore((s) => s.userId)

  const allergyLabels = allergies.map((k) => getAllergyLabel(k))
  const sensitivityLabels: string[] = sensitivities
    .map((k) => SENSITIVITY_OPTIONS.find((o) => o.key === k)?.label ?? '')
    .filter((x) => x.length > 0)
  const preferenceLabels: string[] = preferences
    .map((k) => PREFERENCE_OPTIONS.find((o) => o.key === k)?.label ?? '')
    .filter((x) => x.length > 0)
  const goalLabel = GOAL_OPTIONS.find((o) => o.key === goal)?.label

  const whyAllergies: WhyRow[] = allergyLabels.map((label) => ({
    label,
    why: `We'll flag ${label} ingredients as unsafe right away.`,
  }))
  const whySensitivities: WhyRow[] = sensitivityLabels.map((label) => ({
    label,
    why: `You'll get a caution alert when ${label} appears.`,
  }))
  const whyPreferences: WhyRow[] = preferenceLabels.map((label) => ({
    label,
    why: `We'll prioritize insights that support your ${label.toLowerCase()} choice.`,
  }))
  const whyGoal: WhyRow[] =
    goalLabel != null
      ? [
          {
            label: goalLabel,
            why: `Your scan summary will emphasize what matters for this goal.`,
          },
        ]
      : []

  const parts: string[] = []
  if (allergyLabels.length) {
    parts.push(`alert you about ${allergyLabels.join(' and ')} ingredients`)
  }
  if (sensitivityLabels.length) {
    parts.push(`flag ${sensitivityLabels.join(', ')} related sensitivities`)
  }
  if (preferenceLabels.length) {
    parts.push(`prioritize ${preferenceLabels.join(', ')} insights`)
  }

  const summary = parts.length
    ? `We'll ${parts.join(', ')}.`
    : "We'll help you understand what's in your food."

  const sections: SummarySection[] = [
    {
      key: 'allergies',
      title: 'Allergies',
      subtitle: 'Hard stops — we flag these first',
      icon: 'warning',
      tint: colors.danger,
      tintBg: colors.dangerMuted,
      rows: whyAllergies,
    },
    {
      key: 'sensitivities',
      title: 'Sensitivities',
      subtitle: 'Heads-up when these show up',
      icon: 'alert-circle',
      tint: colors.caution,
      tintBg: colors.cautionMuted,
      rows: whySensitivities,
    },
    {
      key: 'preferences',
      title: 'Preferences',
      subtitle: 'Tailored to how you eat',
      icon: 'heart',
      tint: colors.accent,
      tintBg: colors.accentMuted,
      rows: whyPreferences,
    },
    {
      key: 'goal',
      title: 'Your goal',
      subtitle: 'What we emphasize on every scan',
      icon: 'flag',
      tint: '#0ea5e9',
      tintBg: 'rgba(14, 165, 233, 0.12)',
      rows: whyGoal,
    },
  ]

  const handleStart = async () => {
    const onboardingProfile = buildDietaryProfileFromZustand()
    await saveUserProfile(onboardingProfile)
    console.log('Profile saved on onboarding:', onboardingProfile)
    if (!userId) {
      await setPendingSignupAfterOnboarding()
      const rawRef = globalParams.ref != null ? String(globalParams.ref) : ''
      const normalizedRef = normalizeReferralCode(rawRef)
      const withRef =
        normalizedRef && looksLikeReferralCode(normalizedRef)
          ? ({ pathname: '/sign-up' as const, params: { ref: normalizedRef } })
          : ({ pathname: '/sign-up' as const })
      router.replace(withRef)
      return
    }
    await setOnboardingCompletedOnServer(userId)
    useAuthStore.getState().setOnboardingComplete(true)
    router.replace('/')
  }

  const handleViewSampleScan = () => {
    const sample = mockProductByBarcode(DEMO_SCAN_BARCODE)
    if (!sample) return
    useCurrentScanStore.getState().setResult(sample)
    router.push({
      pathname: '/product/[id]',
      params: { id: sample.product.id, preview: 'onboarding' },
    })
  }

  const hasDetailSections = sections.some((s) => s.rows.length > 0)

  return (
    <GradientBackground variant="welcome">
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.navRow}>
          <Pressable
            onPress={() => router.push('/onboarding/camera')}
            hitSlop={10}
            style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Back to previous question"
          >
            <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>
        <GlassProgressBar total={7} current={7} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroIconRing}>
              <View style={styles.heroIconInner}>
                <Ionicons name="checkmark" size={28} color="#ffffff" />
              </View>
            </View>
            <Text style={styles.step}>Step 7 of 7</Text>
            <Text style={styles.title}>You're all set</Text>
            <Text style={styles.heroSubtitle}>
              Here's how Fillr will personalize every barcode you scan.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.summaryHighlight}>
              <Ionicons name="sparkles" size={18} color={colors.accent} style={styles.summaryIcon} />
              <Text style={styles.summaryText}>{summary}</Text>
            </View>

            {hasDetailSections ? (
              <View style={styles.sectionsWrap}>
                {sections.map((section) => (
                  <SectionBlock key={section.key} section={section} />
                ))}
              </View>
            ) : (
              <Text style={styles.emptyHint}>
                You can refine allergies and preferences anytime from your profile.
              </Text>
            )}
          </View>
        </ScrollView>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.sampleLink, pressed && styles.sampleLinkPressed]}
            onPress={handleViewSampleScan}
          >
            <Ionicons name="barcode-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.sampleLinkText}>Preview a sample scan</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
          <FillrButton
            title={userId ? 'Start scanning →' : 'Continue to account →'}
            onPress={() => void handleStart()}
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  heroIconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  heroIconInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  step: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
    fontWeight: '700',
  },
  title: {
    ...typography.h1,
    fontSize: 28,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },
  heroSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
    paddingHorizontal: spacing.sm,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
  },
  summaryHighlight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.accentMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.18)',
  },
  summaryIcon: {
    marginRight: spacing.sm,
    marginTop: 2,
  },
  summaryText: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    lineHeight: 24,
    fontWeight: '500',
  },
  sectionsWrap: {
    marginTop: spacing.xl,
    gap: spacing.lg,
  },
  sectionBlock: {
    borderRadius: radius.md,
    backgroundColor: colors.background,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sectionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    ...typography.label,
    fontSize: 15,
    color: colors.text,
    fontWeight: '700',
    marginBottom: 2,
  },
  sectionSubtitle: {
    ...typography.bodySmall,
    color: colors.textMuted,
    lineHeight: 18,
  },
  sectionItems: {
    paddingVertical: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  detailAccent: {
    width: 4,
    borderRadius: 2,
    marginTop: 4,
  },
  detailBody: {
    flex: 1,
  },
  detailLabel: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  detailWhy: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  emptyHint: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 20,
  },
  actions: {
    gap: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  sampleLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  sampleLinkPressed: {
    opacity: 0.88,
  },
  sampleLinkText: {
    flex: 1,
    ...typography.label,
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '600',
  },
})
