import { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Share,
  Platform,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { GradientBackground } from '../../components'
import { HEALTH_DISCLAIMER_MICRO } from '../../constants/healthDisclaimer'
import { colors, spacing, radius, typography } from '../../constants/theme'
import { useAuthStore } from '../../store/authStore'
import { useUserStore } from '../../store/userStore'
import { useScanHistoryStore } from '../../store/scanHistoryStore'
import type { ScanRecord } from '../../store/scanHistoryStore'
import {
  getSmartInsight,
  getAvoidedCountThisWeek,
  getSafeScansThisWeek,
  getPersonalizedContext,
} from '../../lib/smartInsights'
import { formatProductTitle } from '../../lib/formatProductTitle'
import { formatHistoryListTitle } from '../../lib/historyDisplayLabel'
import { getFillrAppShareContent } from '../../lib/appStoreLinks'
import { showPaywall } from '../../services/paywallService'
import { getRemainingScans } from '../../store/scanStore'

const c = {
  text: colors.text,
  textSecondary: colors.textSecondary,
  textMuted: colors.textMuted,
  accent: colors.accent,
  accentMuted: colors.accentMuted,
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function countScansThisWeek(scans: ScanRecord[]): number {
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  return scans.filter((s) => {
    const d = new Date(s.date)
    return !Number.isNaN(d.getTime()) && d >= weekAgo
  }).length
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
    SAFE: { bg: colors.safeMuted, color: colors.safe, icon: 'checkmark-circle' },
    CAUTION: { bg: colors.cautionMuted, color: colors.caution, icon: 'alert-circle' },
    UNSAFE: { bg: colors.dangerMuted, color: colors.danger, icon: 'close-circle' },
    UNKNOWN: { bg: colors.unknownMuted, color: colors.unknown, icon: 'help-circle' },
  }
  const { bg, color, icon } = config[status] ?? config.UNKNOWN
  return (
    <View style={[styles.statusBadge, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={14} color={color} style={styles.statusBadgeIcon} />
      <Text style={[styles.statusBadgeText, { color }]}>{status}</Text>
    </View>
  )
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets()
  const fullName = useAuthStore((s) => s.fullName)
  const { allergies, goal, preferences, sensitivities, isPro, totalScansUsed, bonusScansEarned } = useUserStore()
  const scans = useScanHistoryStore((s) => s.scans)
  const recentScans = scans.slice(0, 4)
  const [remainingScans, setRemainingScans] = useState<number>(0)

  const firstName = fullName?.split(' ')[0] || 'there'
  const hasProfile = allergies.length > 0 || !!goal || preferences.length > 0 || sensitivities.length > 0
  const lastScan = scans[0] ?? null
  const avoidedThisWeek = getAvoidedCountThisWeek(scans)
  const safeScansThisWeek = getSafeScansThisWeek(scans)
  const scansThisWeek = countScansThisWeek(scans)
  const smartInsight = getSmartInsight(allergies)
  const personalContext = getPersonalizedContext(
    hasProfile,
    allergies,
    lastScan,
    avoidedThisWeek,
    safeScansThisWeek
  )

  const emptyMiniSubtext = (() => {
    if (!hasProfile) return 'Add allergies to see personalized ingredient verdicts.'
    if (preferences.includes('less_processed')) return "We'll highlight more processed additives."
    if (
      preferences.includes('low_sugar') ||
      preferences.includes('low_calorie') ||
      preferences.includes('low_carb')
    )
      return "We'll flag sweeteners to keep it low sugar."
    if (
      preferences.includes('vegan') ||
      preferences.includes('vegetarian') ||
      preferences.includes('plant_based')
    )
      return "We'll flag dairy/egg-style ingredients."
    if (/clean|understand|improve/i.test(goal)) return "Point your camera at any barcode—we'll tailor it."
    return 'Tap to scan your first product.'
  })()

  const onShareFillr = () => {
    const { message, url } = getFillrAppShareContent()
    if (Platform.OS === 'web') {
      void Share.share({ message, title: 'Fillr' })
    } else if (Platform.OS === 'ios') {
      void Share.share({ message, url, title: 'Fillr' })
    } else {
      void Share.share({ message, title: 'Fillr' })
    }
  }

  useEffect(() => {
    void (async () => {
      const remaining = await getRemainingScans()
      setRemainingScans(Number.isFinite(remaining) ? remaining : 0)
    })()
  }, [isPro, totalScansUsed, bonusScansEarned])

  return (
    <GradientBackground variant="home">
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xxxl * 2.5 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero — one line + short subtitle (logo in tab header) */}
          <View style={styles.heroTop}>
            <Text style={styles.heroGreeting}>
              {getGreeting()}, <Text style={styles.heroName}>{firstName}</Text>
            </Text>
            <Text style={styles.greetingSubtext}>{personalContext.greetingSubtext}</Text>
          </View>

          {!isPro && (
            <Pressable
              style={({ pressed }) => [
                styles.scanCounterPill,
                remainingScans <= 0 && styles.scanCounterPillDanger,
                pressed && styles.pressedCard,
              ]}
              onPress={() => {
                void (async () => {
                  const opened = await showPaywall()
                  if (!opened) router.push('/manage-subscription')
                })()
              }}
            >
              <Text
                style={[
                  styles.scanCounterText,
                  remainingScans <= 0 && styles.scanCounterTextDanger,
                ]}
              >
                {remainingScans > 0
                  ? `${remainingScans} free scans remaining · Get unlimited →`
                  : 'No scans left · Upgrade to Premium →'}
              </Text>
            </Pressable>
          )}

          {/* Compact stats — single row */}
          {scans.length > 0 && (
            <View style={styles.statsCompact}>
              <View style={styles.statsCompactItem}>
                <Text style={styles.statsCompactValue}>{scans.length}</Text>
                <Text style={styles.statsCompactLabel}>Total</Text>
              </View>
              <View style={styles.statsCompactDivider} />
              <View style={styles.statsCompactItem}>
                <Text style={styles.statsCompactValue}>{scansThisWeek}</Text>
                <Text style={styles.statsCompactLabel}>This week</Text>
              </View>
              <View style={styles.statsCompactDivider} />
              <View style={styles.statsCompactItem}>
                <Text style={[styles.statsCompactValue, { color: colors.safe }]}>{safeScansThisWeek}</Text>
                <Text style={styles.statsCompactLabel}>Safe</Text>
              </View>
            </View>
          )}

          {avoidedThisWeek > 0 && (
            <LinearGradient
              colors={['rgba(34,197,94,0.12)', 'rgba(52,211,153,0.08)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.avoidedBanner}
            >
              <Ionicons name="shield-checkmark" size={22} color={c.accent} />
              <Text style={styles.avoidedText}>
                You avoided {avoidedThisWeek} risky product{avoidedThisWeek !== 1 ? 's' : ''} this week
              </Text>
            </LinearGradient>
          )}

          {/* Recent scans (latest first — replaces separate “last scan” card) */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Recent scans</Text>
              {recentScans.length > 0 && (
                <Pressable onPress={() => router.push('/(tabs)/history')} hitSlop={12}>
                  <Text style={styles.sectionLink}>View all</Text>
                </Pressable>
              )}
            </View>
            {recentScans.length > 0 ? (
              <View style={styles.scanList}>
                {recentScans.map((scan, index) => (
                  <Pressable
                    key={scan.id}
                    style={({ pressed }) => [styles.scanCard, pressed && styles.pressedCard]}
                    onPress={() =>
                      router.push({
                        pathname: '/product/[id]',
                        params: { id: scan.productId },
                      })
                    }
                  >
                    <View style={styles.scanIndex}>
                      {scan.source === 'ocr' ? (
                        <Ionicons name="camera" size={16} color="#fff" />
                      ) : (
                        <Text style={styles.scanIndexText}>{index + 1}</Text>
                      )}
                    </View>
                    <View style={styles.scanCardMain}>
                      <Text style={styles.scanProductName} numberOfLines={2}>
                        {formatHistoryListTitle(scan.productName, scan.date, scan.source)}
                      </Text>
                      <View style={styles.scanMetaRow}>
                        <Ionicons name="time-outline" size={12} color={c.textMuted} />
                        <Text style={styles.scanDate}>{scan.date}</Text>
                      </View>
                    </View>
                    <StatusBadge status={scan.safetyStatus} />
                    <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
                  </Pressable>
                ))}
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.emptyScansMini, pressed && styles.pressedCard]}
                onPress={() => router.push('/(tabs)/scan')}
              >
                <LinearGradient
                  colors={['rgba(34,197,94,0.15)', 'rgba(14,165,233,0.1)']}
                  style={styles.emptyScansGradient}
                >
                  <View style={styles.emptyScansMiniLeft}>
                    <View style={styles.emptyScansMiniIcon}>
                      <Ionicons name="barcode-outline" size={22} color={c.accent} />
                    </View>
                    <View style={styles.emptyScansMiniText}>
                      <Text style={styles.emptyScansMiniTitle}>No scans yet</Text>
                      <Text style={styles.emptyScansMiniSub} numberOfLines={2}>
                        {emptyMiniSubtext}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.emptyScansMiniCta}>
                    <Text style={styles.emptyScansMiniCtaText}>Start scanning</Text>
                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                  </View>
                </LinearGradient>
              </Pressable>
            )}
          </View>

          {/* Share — light row */}
          <Pressable
            style={({ pressed }) => [styles.shareRow, pressed && styles.pressedCard]}
            onPress={onShareFillr}
          >
            <Ionicons name="share-outline" size={20} color={c.accent} />
            <Text style={styles.shareRowText}>Share Fillr with a friend</Text>
            <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
          </Pressable>

          {allergies.length > 0 && (
            <View style={styles.tipSection}>
              <Pressable
                style={({ pressed }) => [styles.tipCard, pressed && styles.pressedCard]}
                onPress={() => router.push('/edit-preferences')}
              >
                <View style={styles.tipIconWrap}>
                  <Ionicons name="sparkles" size={20} color={c.accent} />
                </View>
                <View style={styles.tipContent}>
                  <Text style={styles.tipTitle}>{smartInsight.title}</Text>
                  <Text style={styles.tipText} numberOfLines={3}>
                    {smartInsight.description}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
              </Pressable>
            </View>
          )}

          <Text style={styles.homeLegalMicro}>{HEALTH_DISCLAIMER_MICRO}</Text>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.sm,
  },
  heroTop: {
    marginBottom: spacing.lg,
  },
  scanCounterPill: {
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  scanCounterPillDanger: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  scanCounterText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#16a34a',
    textAlign: 'center',
  },
  scanCounterTextDanger: {
    color: '#ef4444',
  },
  heroGreeting: {
    fontSize: 22,
    fontWeight: '600',
    color: c.textSecondary,
    lineHeight: 28,
    marginBottom: spacing.xs,
  },
  heroName: {
    fontWeight: '800',
    color: c.text,
  },
  greetingSubtext: {
    fontSize: 14,
    fontWeight: '500',
    color: c.textMuted,
    lineHeight: 20,
    maxWidth: 340,
  },
  statsCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
  },
  statsCompactItem: {
    flex: 1,
    alignItems: 'center',
  },
  statsCompactValue: {
    fontSize: 20,
    fontWeight: '800',
    color: c.text,
    letterSpacing: -0.4,
  },
  statsCompactLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: c.textMuted,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statsCompactDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(15,23,42,0.08)',
  },
  avoidedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
  },
  avoidedText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#166534',
    lineHeight: 20,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: c.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  sectionLink: {
    fontSize: 13,
    fontWeight: '700',
    color: c.accent,
  },
  scanList: {
    gap: spacing.sm,
  },
  scanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
    borderRadius: radius.lg,
    gap: spacing.sm,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  scanIndex: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: 'rgba(15,23,42,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanIndexText: {
    fontSize: 13,
    fontWeight: '800',
    color: c.textMuted,
  },
  scanCardMain: {
    flex: 1,
    minWidth: 0,
  },
  scanProductName: {
    fontSize: 15,
    fontWeight: '700',
    color: c.text,
    marginBottom: 4,
    lineHeight: 21,
  },
  scanMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scanDate: {
    fontSize: 12,
    fontWeight: '500',
    color: c.textMuted,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: 10,
  },
  statusBadgeIcon: {
    marginTop: 0,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  pressedCard: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  emptyScansMini: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
  },
  emptyScansGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  emptyScansMiniLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
    marginRight: spacing.md,
  },
  emptyScansMiniIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyScansMiniText: {
    flex: 1,
  },
  emptyScansMiniTitle: {
    ...typography.label,
    fontSize: 16,
    color: c.text,
    marginBottom: 4,
  },
  emptyScansMiniSub: {
    ...typography.bodySmall,
    color: c.textSecondary,
    lineHeight: 20,
  },
  emptyScansMiniCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
    backgroundColor: c.accent,
  },
  emptyScansMiniCtaText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
  },
  shareRowText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: c.text,
  },
  tipSection: {
    marginTop: 0,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  tipIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: c.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: c.text,
    marginBottom: 4,
  },
  tipText: {
    fontSize: 13,
    color: c.textSecondary,
    lineHeight: 19,
  },
  homeLegalMicro: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
    fontSize: 11,
    lineHeight: 15,
    color: c.textMuted,
    textAlign: 'center',
  },
})
