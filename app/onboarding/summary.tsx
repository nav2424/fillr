import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native'
import { router, useGlobalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import {
  OnboardingLayout,
  ProgressHeader,
  PrimaryButton,
  SummaryStackCard,
  FooterActionBar,
} from '../../components/onboarding'
import { ONBOARDING_STEP } from '../../constants/onboardingFlow'
import { ob, obType } from '../../constants/onboardingTheme'
import { useUserStore } from '../../store/userStore'
import { useAuthStore } from '../../store/authStore'
import { SENSITIVITY_OPTIONS, PREFERENCE_OPTIONS, GOAL_OPTIONS } from '../../types'
import { getAllergyLabel } from '../../lib/knownAllergens'
import { migrateGoalKey } from '../../lib/goalKeyMigration'
import { buildDietaryProfileFromZustand } from '../../lib/onboardingProfile'
import { setOnboardingCompletedOnServer } from '../../lib/authService'
import { setPendingSignupAfterOnboarding } from '../../lib/pendingSignup'
import { looksLikeReferralCode, normalizeReferralCode } from '../../lib/referrals'
import { useCurrentScanStore } from '../../store/currentScanStore'
import { mockProductByBarcode, DEMO_SCAN_BARCODE } from '../../services/mockProducts'
import { trackScanResultMetric } from '../../lib/scanResultMetrics'

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

function allergySummarySentence(labels: string[]): string {
  if (labels.length === 0) return 'No allergies selected — you can add them anytime.'
  if (labels.length === 1) return `We’ll flag ${labels[0]} as unsafe right away.`
  if (labels.length === 2) return `We’ll flag ${labels[0]} and ${labels[1]} as unsafe right away.`
  return `We’ll flag ${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]} as unsafe right away.`
}

function listOrNone(labels: string[], empty: string): string {
  if (labels.length === 0) return empty
  return labels.join(' · ')
}

export default function OnboardingSummary() {
  const globalParams = useGlobalSearchParams<{ ref?: string }>()
  const { allergies, sensitivities, preferences, goal, celiacStrictGluten } = useUserStore()
  const userId = useAuthStore((s) => s.userId)

  const allergyLabels = allergies.map((k) => getAllergyLabel(k))
  const sensitivityLabels: string[] = sensitivities
    .map((k) => SENSITIVITY_OPTIONS.find((o) => o.key === k)?.label ?? '')
    .filter((x) => x.length > 0)
  const preferenceLabels: string[] = preferences
    .map((k) => PREFERENCE_OPTIONS.find((o) => o.key === k)?.label ?? '')
    .filter((x) => x.length > 0)
  const goalKey = migrateGoalKey(goal)
  const goalLabel = GOAL_OPTIONS.find((o) => o.key === goalKey)?.label

  const handleContinue = async () => {
    const onboardingProfile = buildDietaryProfileFromZustand()
    await saveUserProfile(onboardingProfile)
    if (!userId) {
      await setPendingSignupAfterOnboarding()
      const rawRef = globalParams.ref != null ? String(globalParams.ref) : ''
      const normalizedRef = normalizeReferralCode(rawRef)
      router.push(
        normalizedRef && looksLikeReferralCode(normalizedRef)
          ? { pathname: '/onboarding/account', params: { ref: normalizedRef } }
          : '/onboarding/account'
      )
      return
    }
    await setOnboardingCompletedOnServer(userId)
    useAuthStore.getState().setOnboardingComplete(true)
    void trackScanResultMetric({
      name: 'onboarding_completed',
      payload: {
        allergies_count: allergyLabels.length,
        sensitivities_count: sensitivityLabels.length,
        preferences_count: preferenceLabels.length,
        has_goal: Boolean(goalLabel),
        celiac_strict_gluten: celiacStrictGluten,
      },
    })
    router.replace('/')
  }

  const handleSample = () => {
    const sample = mockProductByBarcode(DEMO_SCAN_BARCODE)
    if (!sample) return
    useCurrentScanStore.getState().setResult(sample)
    router.push({
      pathname: '/product/[id]',
      params: { id: sample.product.id, preview: 'onboarding' },
    })
  }

  return (
    <OnboardingLayout>
      <ProgressHeader
        stepIndex={ONBOARDING_STEP.summary}
        onBack={() => router.push('/onboarding/camera')}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.inner}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroIcon, ob.shadow.soft]}>
          <Ionicons name="sparkles" size={28} color={ob.ctaText} />
        </View>
        <Text style={styles.title}>You’re all set</Text>
        <Text style={[obType.subtitle, styles.heroSub]}>
          Here’s how Fillr will personalize every product you scan.
        </Text>

        <SummaryStackCard
          title="Allergies"
          body={allergySummarySentence(allergyLabels)}
          icon="warning"
          tint={ob.allergy}
          tintBg={ob.allergyMuted}
        />
        <SummaryStackCard
          title="Sensitivities"
          body={
            sensitivityLabels.length
              ? `You’ll get caution context when ${sensitivityLabels.join(', ')} show up.`
              : 'None selected — add sensitivities anytime for softer nudges.'
          }
          icon="flash-outline"
          tint={ob.sensitivity}
          tintBg={ob.sensitivityMuted}
        />
        <SummaryStackCard
          title="Preferences"
          body={
            preferenceLabels.length
              ? `We’ll highlight foods that conflict with: ${preferenceLabels.join(', ')}.`
              : 'No preference filters yet — your scores stay allergy-first.'
          }
          icon="heart"
          tint={ob.preference}
          tintBg={ob.preferenceMuted}
        />
        {celiacStrictGluten ? (
          <SummaryStackCard
            title="Celiac Mode"
            body="Strict gluten pass is on — ambiguous malt, yeast, and cross-contact wording gets extra scrutiny."
            icon="shield-checkmark"
            tint={ob.cta}
            tintBg="rgba(22, 217, 122, 0.15)"
          />
        ) : null}
        <SummaryStackCard
          title="Goal"
          body={
            goalLabel
              ? `We’ll emphasize what matters for: ${goalLabel.toLowerCase()}.`
              : 'Pick a goal later — scans still decode ingredients in plain English.'
          }
          icon="flag"
          tint={ob.accentBlue}
          tintBg={ob.accentBlueMuted}
        />

        <Text style={styles.recap}>
          {listOrNone(
            [
              allergyLabels.length ? `${allergyLabels.length} allergy flags` : '',
              sensitivityLabels.length ? `${sensitivityLabels.length} sensitivities` : '',
              preferenceLabels.length ? `${preferenceLabels.length} preferences` : '',
              goalLabel ? '1 goal' : '',
            ].filter(Boolean),
            'Start scanning to build your history.'
          )}
        </Text>
      </ScrollView>
      <FooterActionBar>
        <Pressable
          onPress={handleSample}
          style={({ pressed }) => [styles.sampleRow, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="barcode-outline" size={22} color={ob.ink} />
          <Text style={styles.sampleText}>Preview a sample scan</Text>
          <Ionicons name="chevron-forward" size={20} color={ob.inkFaint} />
        </Pressable>
        <PrimaryButton
          title={userId ? 'Start scanning' : 'Continue to account'}
          onPress={() => void handleContinue()}
        />
      </FooterActionBar>
    </OnboardingLayout>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  inner: { paddingBottom: 28, alignItems: 'stretch' },
  heroIcon: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: ob.cta,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { ...obType.title, textAlign: 'center', marginBottom: 8 },
  heroSub: { textAlign: 'center', marginBottom: 20, alignSelf: 'center', maxWidth: 340 },
  recap: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: ob.inkFaint,
    marginTop: 8,
    lineHeight: 18,
  },
  sampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: ob.radiusLg,
    borderWidth: 1,
    borderColor: ob.border,
    backgroundColor: ob.surface,
  },
  sampleText: { flex: 1, fontSize: 16, fontWeight: '700', color: ob.ink },
})
