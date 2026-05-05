import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  Modal,
  Linking,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { FillrButton } from '../../components'
import { router } from 'expo-router'
import { colors, homeWordmarkLayout, radius, spacing, typography } from '../../constants/theme'
import { FREE_SCAN_LIMIT } from '../../constants/subscription'
import { HEALTH_DISCLAIMER_RATINGS_MODAL_CLOSE } from '../../constants/healthDisclaimer'
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '../../constants/legalUrls'
import { clearDisclaimerKeysOnSignOut } from '../../lib/disclaimerStorage'
import { clearPendingSignupAfterOnboarding } from '../../lib/pendingSignup'
import { useAuthStore } from '../../store/authStore'
import { useUserStore } from '../../store/userStore'
import { useScanHistoryStore } from '../../store/scanHistoryStore'
import { logOutOfRevenueCat } from '../../services/revenuecatService'
import {
  SENSITIVITY_OPTIONS,
  PREFERENCE_OPTIONS,
  GOAL_OPTIONS,
} from '../../types'
import { getAllergyLabel } from '../../lib/knownAllergens'
import { migrateGoalKey } from '../../lib/goalKeyMigration'
import { copyReferralLink, shareReferralLink } from '../../lib/referrals'
import {
  ensureReferralCodeForUser,
  getCurrentAuthUserId,
  getReferralStatsForCode,
  signOutSupabase,
} from '../../lib/authService'
import {
  storedDietProfileHasAnyRows,
  summaryLabelsFromStoredProfile,
} from '../../lib/profileSummaryLabels'
import { rescoreAllSavedScanFits } from '../../lib/rescoreScanHistoryFits'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getUserProfile } = require('../../store/userProfileStore.js') as {
  getUserProfile: () => Promise<{
    allergies: string[]
    sensitivities: string[]
    avoiding: string[]
    preferences: string[]
    goal?: string
    celiacStrictGluten?: boolean
  }>
}

function openPreferencesSection(section: 'allergies' | 'sensitivities' | 'preferences' | 'goal') {
  router.push({ pathname: '/edit-preferences', params: { section } })
}

const SCREEN_BG = '#ffffff'
/** Soft rim + lift for cards on a white canvas. */
const CARD_BORDER = 'rgba(15, 23, 42, 0.07)'
const CARD_SHADOW = {
  shadowColor: '#0f172a',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 10,
  elevation: 2,
} as const

export default function ProfileScreen() {
  const insets = useSafeAreaInsets()
  const tabBarHeight = useBottomTabBarHeight()
  const { userId, email, fullName, signOut } = useAuthStore()
  const {
    allergies,
    sensitivities,
    preferences,
    goal,
    celiacStrictGluten,
    isPro,
    totalScansUsed,
    bonusScansEarned,
    referralCode,
    setReferralData,
  } = useUserStore()
  const [convertedCount, setConvertedCount] = useState(0)
  const [isCopyingReferralLink, setIsCopyingReferralLink] = useState(false)
  const [isSharingReferralLink, setIsSharingReferralLink] = useState(false)
  const [ratingsModalVisible, setRatingsModalVisible] = useState(false)
  /** Diet card lines from AsyncStorage when present (authoritative vs sparse Zustand mirror). */
  const [asyncDietLabels, setAsyncDietLabels] = useState<{
    allergyLabels: string[]
    sensitivityLabels: string[]
    preferenceLabels: string[]
  } | null>(null)
  /** Goal key persisted with dietary profile (AsyncStorage). */
  const [asyncGoalKey, setAsyncGoalKey] = useState<string | null>(null)

  const scansUsed = totalScansUsed ?? 0
  const freeRemaining = isPro ? null : Math.max(0, FREE_SCAN_LIMIT + (bonusScansEarned ?? 0) - scansUsed)
  const usagePct = isPro
    ? 100
    : Math.min(100, (scansUsed / Math.max(FREE_SCAN_LIMIT + (bonusScansEarned ?? 0), 1)) * 100)

  const allergyLabels = allergies.map((k) => getAllergyLabel(k))
  const sensitivityLabels = sensitivities
    .map((k) => SENSITIVITY_OPTIONS.find((o) => o.key === k)?.label)
    .filter(Boolean)
  const preferenceLabels = preferences
    .map((k) => PREFERENCE_OPTIONS.find((o) => o.key === k)?.label)
    .filter(Boolean)
  const goalLabel = GOAL_OPTIONS.find((o) => o.key === migrateGoalKey(goal))?.label

  useFocusEffect(
    useCallback(() => {
      let alive = true
      void (async () => {
        try {
          const p = await getUserProfile()
          if (!alive) return
          const goalKey = (p.goal ?? '').trim()
          setAsyncGoalKey(goalKey || null)
          if (storedDietProfileHasAnyRows(p)) {
            setAsyncDietLabels(summaryLabelsFromStoredProfile(p))
          } else {
            setAsyncDietLabels(null)
          }
        } catch {
          if (alive) {
            setAsyncDietLabels(null)
            setAsyncGoalKey(null)
          }
        }
      })()
      return () => {
        alive = false
      }
    }, [])
  )

  useFocusEffect(
    useCallback(() => {
      return () => {
        void rescoreAllSavedScanFits()
      }
    }, [])
  )

  const allergySummary =
    asyncDietLabels !== null ? asyncDietLabels.allergyLabels : allergyLabels

  /** Celiac Mode is not an allergy chip; show it on the Allergies card when enabled. */
  const allergySummaryForDisplay = useMemo(() => {
    const base = [...allergySummary]
    const already = base.some((l) => /celiac mode/i.test(l))
    if (celiacStrictGluten && !already) {
      return ['Celiac Mode', ...base]
    }
    return base
  }, [allergySummary, celiacStrictGluten])

  const sensitivitySummary =
    asyncDietLabels !== null ? asyncDietLabels.sensitivityLabels : sensitivityLabels
  const preferenceSummary =
    asyncDietLabels !== null ? asyncDietLabels.preferenceLabels : preferenceLabels

  const goalSummaryLabel =
    asyncGoalKey != null
      ? GOAL_OPTIONS.find((o) => o.key === migrateGoalKey(asyncGoalKey))?.label ?? goalLabel
      : goalLabel

  useEffect(() => {
    let alive = true
    if (!referralCode) return
    void (async () => {
      try {
        const stats = await getReferralStatsForCode(referralCode)
        if (!alive) return
        setConvertedCount(stats.convertedCount)
        setReferralData({ referralsConverted: stats.convertedCount })
      } catch {
        // keep profile screen stable if referral stats RPC fails
      }
    })()
    return () => {
      alive = false
    }
  }, [referralCode, setReferralData])

  useEffect(() => {
    let alive = true
    if (referralCode) return
    void (async () => {
      try {
        const resolvedUserId = userId ?? (await getCurrentAuthUserId())
        if (!resolvedUserId) return
        const code = await ensureReferralCodeForUser(resolvedUserId)
        if (!alive || !code) return
        setReferralData({ referralCode: code })
      } catch {
        // swallow and keep UI interactive; user can still retry share/copy
      }
    })()
    return () => {
      alive = false
    }
  }, [referralCode, userId, setReferralData])

  const handleSignOut = () => {
    void (async () => {
      await clearDisclaimerKeysOnSignOut()
      await clearPendingSignupAfterOnboarding()
      await logOutOfRevenueCat()
      void signOutSupabase()
      useUserStore.getState().resetForAccountDeletion()
      useScanHistoryStore.getState().clearAll()
      signOut()
      router.replace('/welcome')
    })()
  }

  const handleCopyReferralLink = async () => {
    if (isCopyingReferralLink) return
    setIsCopyingReferralLink(true)
    try {
      let code: string | null = referralCode
      const resolvedUserId = userId ?? (await getCurrentAuthUserId())
      if (!code && resolvedUserId) {
        code = await ensureReferralCodeForUser(resolvedUserId)
        if (code) setReferralData({ referralCode: code })
      }
      if (!code) {
        Alert.alert('No referral code yet', 'Please try again in a moment.')
        return
      }
      await copyReferralLink(code)
      Alert.alert('Copied!', 'Referral link copied to clipboard.')
    } catch {
      Alert.alert('Could not copy link', 'Please try again.')
    } finally {
      setIsCopyingReferralLink(false)
    }
  }

  const handleShareReferralLink = async () => {
    if (isSharingReferralLink) return
    setIsSharingReferralLink(true)
    try {
      let code: string | null = referralCode
      const resolvedUserId = userId ?? (await getCurrentAuthUserId())
      if (!code && resolvedUserId) {
        code = await ensureReferralCodeForUser(resolvedUserId)
        if (code) setReferralData({ referralCode: code })
      }
      if (!code) {
        Alert.alert('No referral code yet', 'Please try again in a moment.')
        return
      }
      await shareReferralLink(code)
    } catch {
      Alert.alert('Could not open share sheet', 'Please try again.')
    } finally {
      setIsSharingReferralLink(false)
    }
  }

  const padX = Math.max(homeWordmarkLayout.horizontalPad, insets.left, insets.right)
  const bottomPad = tabBarHeight + insets.bottom + spacing.xxxl * 1.5

  return (
    <View style={styles.screenRoot}>
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: padX, paddingBottom: bottomPad },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            style={({ pressed }) => [styles.sectionCard, pressed && styles.cardPressed]}
            onPress={() => router.push('/manage-subscription')}
          >
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconWrap, { backgroundColor: colors.accentMuted }]}>
                <Ionicons name="diamond-outline" size={19} color={colors.accent} />
              </View>
              <View style={styles.sectionTitleWrap}>
                <Text style={styles.sectionTitle}>Plan & scans</Text>
                <Text style={styles.sectionHelper}>
                  {isPro ? 'Unlimited scanning' : 'Free tier usage'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </View>
            <View style={styles.planRow}>
              <Text style={styles.planBadge}>{isPro ? 'Fillr Premium' : 'Free'}</Text>
            </View>
            {isPro ? (
              <Text style={styles.cardValue}>You have unlimited scans and premium features.</Text>
            ) : (
              <View style={styles.planQuotaPanel}>
                <Text style={styles.scanCountLine}>
                  <Text style={styles.scanCountEm}>{freeRemaining}</Text> free scans left
                </Text>
                <Text style={styles.cardValueSecondary}>
                  {scansUsed} used · {bonusScansEarned ?? 0} bonus earned
                </Text>
                <View style={styles.usageTrack}>
                  <View style={[styles.usageFill, { width: `${usagePct}%` }]} />
                </View>
              </View>
            )}
            <Text style={styles.tapHint}>Tap to manage subscription</Text>
          </Pressable>

          <View style={styles.referralCard}>
            <View style={styles.refTopRow}>
              <View style={styles.refTitleRow}>
                <Ionicons name="link" size={19} color={colors.accent} />
                <Text style={styles.refTitle}>Invite friends</Text>
              </View>
              <View style={styles.refPill}>
                <Text style={styles.refPillText}>Earn 5 scans each</Text>
              </View>
            </View>

            {(convertedCount > 0 || (bonusScansEarned ?? 0) > 0) && (
              <View style={styles.refStatsRow}>
                <View style={styles.refStatBox}>
                  <Text style={styles.refStatValue}>{convertedCount}</Text>
                  <Text style={styles.refStatLabel}>friends joined</Text>
                </View>
                <View style={styles.refStatBox}>
                  <Text style={styles.refStatValue}>{bonusScansEarned ?? 0}</Text>
                  <Text style={styles.refStatLabel}>bonus scans earned</Text>
                </View>
              </View>
            )}

            <Text style={styles.refCodeLabel}>Your code</Text>
            <View style={styles.refCodePanel}>
              <Text style={styles.refCode}>{referralCode || '—'}</Text>
            </View>

            <View style={styles.refActionRow}>
              <Pressable
                style={({ pressed }) => [styles.refBtnGhost, pressed && styles.cardPressed]}
                disabled={isCopyingReferralLink || isSharingReferralLink}
                onPress={handleCopyReferralLink}
              >
                <Text style={styles.refBtnGhostText}>
                  {isCopyingReferralLink ? 'Copying...' : 'Copy code'}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.refBtnPrimary, pressed && styles.cardPressed]}
                disabled={isSharingReferralLink || isCopyingReferralLink}
                onPress={handleShareReferralLink}
              >
                <Text style={styles.refBtnPrimaryText}>
                  {isSharingReferralLink ? 'Opening...' : 'Share →'}
                </Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.refFooterHint}>
            For every friend who joins, you get 5 bonus scans and they get 3. Max 50 bonus scans.
          </Text>

          <View style={styles.sectionCard}>
            <Pressable
              style={({ pressed }) => [pressed && styles.cardPressed]}
              onPress={() => router.push('/edit-account')}
            >
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconWrap, { backgroundColor: colors.accentMuted }]}>
                  <Ionicons name="person" size={18} color={colors.accent} />
                </View>
                <View style={styles.sectionTitleWrap}>
                  <Text style={styles.sectionTitle}>Account</Text>
                  <Text style={styles.sectionHelper}>Name, email, password</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </View>
              <Text style={styles.cardValue}>{fullName || 'User'}</Text>
              <Text style={styles.cardValueSecondary}>{email || '—'}</Text>
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [styles.sectionCard, pressed && styles.cardPressed]}
            onPress={() => openPreferencesSection('allergies')}
          >
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconWrap, { backgroundColor: colors.dangerMuted }]}>
                <Ionicons name="warning" size={18} color={colors.danger} />
              </View>
              <View style={styles.sectionTitleWrap}>
                <Text style={styles.sectionTitle}>Allergies</Text>
                <Text style={styles.sectionHelper}>We flag these in every scan</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </View>
            <Text style={styles.cardValue}>
              {allergySummaryForDisplay.length ? allergySummaryForDisplay.join(', ') : 'None set'}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.sectionCard, pressed && styles.cardPressed]}
            onPress={() => openPreferencesSection('sensitivities')}
          >
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconWrap, { backgroundColor: colors.cautionMuted }]}>
                <Ionicons name="alert-circle" size={18} color={colors.caution} />
              </View>
              <View style={styles.sectionTitleWrap}>
                <Text style={styles.sectionTitle}>Sensitivities</Text>
                <Text style={styles.sectionHelper}>We give you a heads-up</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </View>
            <Text style={styles.cardValue}>
              {sensitivitySummary.length ? sensitivitySummary.join(', ') : 'None set'}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.sectionCard, pressed && styles.cardPressed]}
            onPress={() => openPreferencesSection('preferences')}
          >
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconWrap, { backgroundColor: colors.safeMuted }]}>
                <Ionicons name="heart" size={18} color={colors.safe} />
              </View>
              <View style={styles.sectionTitleWrap}>
                <Text style={styles.sectionTitle}>Preferences</Text>
                <Text style={styles.sectionHelper}>Products that match your diet</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </View>
            <Text style={styles.cardValue}>
              {preferenceSummary.length ? preferenceSummary.join(', ') : 'None set'}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.sectionCard, pressed && styles.cardPressed]}
            onPress={() => openPreferencesSection('goal')}
          >
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconWrap, { backgroundColor: colors.accentMuted }]}>
                <Ionicons name="flag" size={18} color={colors.accent} />
              </View>
              <View style={styles.sectionTitleWrap}>
                <Text style={styles.sectionTitle}>Goal</Text>
                <Text style={styles.sectionHelper}>What you want to achieve</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </View>
            <Text style={styles.cardValue}>{goalSummaryLabel || 'Not set'}</Text>
          </Pressable>

          <Text style={styles.legalSectionLabel}>LEGAL</Text>
          <View style={styles.legalCard}>
            <Pressable
              style={({ pressed }) => [styles.legalRow, pressed && styles.linkRowPressed]}
              onPress={() => setRatingsModalVisible(true)}
            >
              <Text style={styles.legalRowText}>About Fillr&apos;s ratings</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
            <View style={styles.legalDivider} />
            <Pressable
              style={({ pressed }) => [styles.legalRow, pressed && styles.linkRowPressed]}
              onPress={() => void Linking.openURL(TERMS_OF_SERVICE_URL)}
            >
              <Text style={styles.legalRowText}>Terms of Service</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
            <View style={styles.legalDivider} />
            <Pressable
              style={({ pressed }) => [styles.legalRow, pressed && styles.linkRowPressed]}
              onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
            >
              <Text style={styles.legalRowText}>Privacy Policy</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          <FillrButton title="Sign out" onPress={handleSignOut} variant="dangerLiquid" fullWidth />
        </ScrollView>

        <Modal
          visible={ratingsModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setRatingsModalVisible(false)}
        >
          <View style={styles.ratingsModalRoot}>
            <Pressable
              style={styles.ratingsModalBackdropPressable}
              onPress={() => setRatingsModalVisible(false)}
              accessibilityLabel="Dismiss"
            />
            <View style={styles.ratingsModalCenter} pointerEvents="box-none">
              <View style={styles.ratingsModalCard}>
                <Text style={styles.ratingsModalTitle}>How Fillr rates ingredients</Text>
                <ScrollView
                  style={styles.ratingsModalScroll}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.ratingsModalBody}>
                    Fillr uses a combination of deterministic rules (for well-known ingredients like
                    artificial dyes and HFCS) and AI analysis for less common ingredients.{'\n\n'}
                    Our deterministic ratings are based on published food science research and
                    regulatory status in major markets including the US, EU, and Canada.{'\n\n'}
                    AI-generated descriptions are informational and may occasionally be imprecise.
                    {'\n\n'}
                    Ingredient data is sourced from Open Food Facts and other public food databases.
                    These databases rely on community contributions and manufacturer-provided data
                    which may be incomplete.
                    {HEALTH_DISCLAIMER_RATINGS_MODAL_CLOSE}
                  </Text>
                </ScrollView>
                <FillrButton
                  title="Close"
                  onPress={() => setRatingsModalVisible(false)}
                  fullWidth
                />
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },
  container: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },
  scroll: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },
  scrollContent: {
    paddingTop: spacing.md,
  },
  sectionCard: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    ...CARD_SHADOW,
  },
  referralCard: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    marginBottom: spacing.sm,
    ...CARD_SHADOW,
  },
  refTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  refTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  refTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.35,
  },
  refPill: {
    backgroundColor: colors.backgroundLightGreen,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
  },
  refPillText: { fontSize: 11, fontWeight: '700', color: '#15803d' },
  refStatsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  refStatBox: {
    flex: 1,
    backgroundColor: colors.backgroundLightGreen,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.16)',
  },
  refStatValue: { fontSize: 21, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  refStatLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  refCodeLabel: {
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 0.4,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  refCodePanel: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'stretch',
  },
  refCode: {
    fontSize: 22,
    letterSpacing: 3,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  refActionRow: { flexDirection: 'row', gap: spacing.md },
  refBtnGhost: {
    flex: 1,
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.full,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  refBtnGhostText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  refBtnPrimary: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 3,
  },
  refBtnPrimaryText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  refFooterHint: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.lg,
    marginTop: spacing.xs,
  },
  cardPressed: {
    opacity: 0.92,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  sectionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  sectionTitleWrap: {
    flex: 1,
  },
  sectionTitle: {
    ...typography.h3,
    fontSize: 17,
    color: colors.text,
    marginBottom: 2,
    letterSpacing: -0.35,
  },
  sectionHelper: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  cardValue: {
    ...typography.body,
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    lineHeight: 24,
  },
  cardValueSecondary: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 4,
  },
  planRow: {
    marginBottom: spacing.sm,
  },
  planQuotaPanel: {
    marginTop: spacing.xs,
    backgroundColor: colors.backgroundLightGreen,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.14)',
  },
  planBadge: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '800',
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    backgroundColor: colors.accentMuted,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  scanCountLine: {
    ...typography.body,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.xs,
  },
  scanCountEm: {
    fontWeight: '800',
    color: colors.accent,
    fontSize: 22,
  },
  usageTrack: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.65)',
    marginTop: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.12)',
  },
  usageFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    minWidth: 4,
  },
  tapHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.md,
    fontWeight: '600',
  },
  linkRowPressed: {
    opacity: 0.85,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginTop: spacing.lg,
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  dangerRowText: {
    flex: 1,
    ...typography.label,
    color: colors.danger,
    fontWeight: '700',
  },
  legalSectionLabel: {
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 0.8,
    fontWeight: '700',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  legalCard: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    overflow: 'hidden',
    ...CARD_SHADOW,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  legalRowText: {
    ...typography.body,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  legalDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.xl,
  },
  ratingsModalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  ratingsModalBackdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  ratingsModalCenter: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  ratingsModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: spacing.xl,
    maxHeight: '85%',
  },
  ratingsModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.md,
  },
  ratingsModalScroll: {
    maxHeight: 320,
    marginBottom: spacing.lg,
  },
  ratingsModalBody: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
})
