import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Easing,
  Platform,
  Share,
  Modal,
  FlatList,
  Dimensions,
} from 'react-native'
import { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import {
  FillrHeaderLogo,
  GradientBackground,
  OverviewWeekShareCardVisual,
  SHARE_WEEK_MESSAGE,
  buildOverviewWeekShareCardModel,
} from '../../components'
import { spacing } from '../../constants/theme'
import { useOverviewData } from '../../hooks/useOverviewData'
import {
  computeOverviewMetrics,
  formatWeekRangeLabel,
  getWeekBounds,
  getWeekPickerOptions,
} from '../../lib/overviewAnalytics'
import type { TopFlaggedRow, WeekWithScanData } from '../../lib/overviewAnalytics'
import { buildOverviewWeekShareContent } from '../../lib/buildOverviewWeekShare'

const H_PAD = 24
const MINT_DIVIDER = '#e8f5e9'
const TEXT_PRIMARY = '#0a0a0a'
const TEXT_MUTED = '#9ca3af'

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

function useSkeletonPulse() {
  const v = useRef(new Animated.Value(0.5)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0.5,
          duration: 600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [v])
  return v
}

function SkelBox({ w, h, style }: { w?: number; h: number; style?: object }) {
  const o = useSkeletonPulse()
  return (
    <Animated.View style={[styles.skelBox, { height: h, opacity: o, width: w }, style]} />
  )
}

function OverviewSkeleton() {
  return (
    <View style={styles.skelWrap}>
      <SkelBox w={280} h={24} />
      <SkelBox w={200} h={16} style={{ marginTop: 10 }} />
      {[0, 1, 2, 3].map((i) => (
        <SkelBox key={i} h={40} style={{ marginTop: 14, alignSelf: 'stretch' }} />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <SkelBox key={`b${i}`} h={3} style={{ marginTop: 12, alignSelf: 'stretch' }} />
      ))}
    </View>
  )
}

const BAR_GRADS: Record<string, [string, string]> = {
  natural: ['#4ade80', '#22c55e'],
  processed: ['#fcd34d', '#fbbf24'],
  additives: ['#fdba74', '#fb923c'],
  flagged: ['#f87171', '#ef4444'],
}

function BreakdownBarRow({
  label,
  count,
  maxCount,
  countColor,
  gradKey,
}: {
  label: string
  count: number
  maxCount: number
  countColor: string
  gradKey: keyof typeof BAR_GRADS
}) {
  const pct = maxCount > 0 ? Math.min(100, (count / maxCount) * 100) : 0
  const [g0, g1] = BAR_GRADS[gradKey]
  return (
    <View style={styles.breakRow}>
      <View style={styles.breakTop}>
        <Text style={styles.breakLabel}>{label}</Text>
        <Text style={[styles.breakCount, { color: countColor }]}>{count}</Text>
      </View>
      <View style={styles.breakTrack}>
        {pct > 0 ? (
          <LinearGradient
            colors={[g0, g1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.breakFillGrad, { width: `${pct}%` }]}
          />
        ) : null}
      </View>
    </View>
  )
}

function StatDivider() {
  return <View style={styles.statDivider} />
}

function StatCol({
  value,
  label,
  valueColor,
}: {
  value: string
  label: string
  valueColor: string
}) {
  return (
    <View style={styles.statCol}>
      <Text style={[styles.statNum, { color: valueColor }]}>{value}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  )
}

function avgFitDisplayColor(score: number | null): string {
  if (score == null) return '#6b7280'
  if (score >= 80) return '#16a34a'
  if (score >= 60) return '#d97706'
  if (score >= 40) return '#ea580c'
  return '#dc2626'
}

function WeekRangePill({
  label,
  interactive,
  onPress,
}: {
  label: string
  interactive: boolean
  onPress?: () => void
}) {
  const inner = (
    <>
      <Ionicons name="calendar-outline" size={12} color={TEXT_MUTED} style={{ marginRight: 4 }} />
      <Text style={styles.weekRange}>{label}</Text>
      {interactive ? (
        <Ionicons name="chevron-down" size={14} color={TEXT_MUTED} style={{ marginLeft: 2 }} />
      ) : null}
    </>
  )
  if (!interactive) {
    return <View style={styles.weekPill}>{inner}</View>
  }
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.weekPill, pressed && styles.weekPillPressed]}
      accessibilityRole="button"
      accessibilityHint="Opens a list of weeks that have scans"
      accessibilityLabel={`Week range ${label}. Tap to choose another week.`}
    >
      {inner}
    </Pressable>
  )
}

function FlaggedRow({ row, isLast }: { row: TopFlaggedRow; isLast: boolean }) {
  return (
    <View style={[styles.flagRow, isLast && styles.flagRowLast]}>
      <View style={[styles.flagAccent, { backgroundColor: row.dotColor }]} />
      <View style={styles.flagBody}>
        <View style={styles.flagTop}>
          <Text style={styles.flagName} numberOfLines={2}>
            {row.name}
          </Text>
          <View style={styles.flagBadge}>
            <Text style={styles.flagBadgeText}>{row.count}×</Text>
          </View>
        </View>
        <Text style={styles.flagDesc} numberOfLines={2}>
          {row.subtitle}
        </Text>
      </View>
    </View>
  )
}

export default function OverviewScreen() {
  const insets = useSafeAreaInsets()
  const { rows, loading } = useOverviewData()
  const weekShareCardRef = useRef<View>(null)
  const [selectedWeekAnchor, setSelectedWeekAnchor] = useState(() => new Date())
  const [weekPickerVisible, setWeekPickerVisible] = useState(false)

  const week = useMemo(() => getWeekBounds(selectedWeekAnchor), [selectedWeekAnchor])
  const weekLabel = useMemo(() => formatWeekRangeLabel(week.start, week.end), [week])

  const weekPickerOptions = useMemo(() => getWeekPickerOptions(rows), [rows])
  const canPickWeek = !loading && weekPickerOptions.length > 0

  const isCurrentCalendarWeek =
    getWeekBounds(new Date()).start.getTime() === week.start.getTime()

  const metrics = useMemo(() => computeOverviewMetrics(rows, week), [rows, week])

  const weekShareCardModel = useMemo(
    () =>
      buildOverviewWeekShareCardModel({
        weekLabel,
        scansThisWeek: metrics.totalScansThisWeek,
        flaggedIngredientsThisWeek: metrics.flaggedIngredientsThisWeek,
        avgFitThisWeek: metrics.avgFitThisWeek,
        totalScansEver: metrics.totalEver,
        topFlagged: metrics.topFlagged,
        cumulative: metrics.cumulative,
      }),
    [
      weekLabel,
      metrics.totalScansThisWeek,
      metrics.flaggedIngredientsThisWeek,
      metrics.avgFitThisWeek,
      metrics.totalEver,
      metrics.topFlagged,
      metrics.cumulative,
    ]
  )

  const maxBar = useMemo(() => {
    const c = metrics.cumulative
    return Math.max(c.natural, c.processed, c.additive, c.flagged, 1)
  }, [metrics.cumulative])

  const bottomPad = insets.bottom + spacing.xxxl * 2.2

  const Y = metrics.totalScansThisWeek
  const X = metrics.flaggedIngredientsThisWeek
  const flaggedZero = X === 0

  const scansWord = plural(Y, 'scan', 'scans')
  const ingredientsWord = plural(X, 'ingredient', 'ingredients')

  const avgFit = metrics.avgFitThisWeek
  const avgFitStr = avgFit != null && avgFit > 0 ? String(avgFit) : '—'
  const avgFitColor = avgFit != null && avgFit > 0 ? avgFitDisplayColor(avgFit) : '#6b7280'

  const line2 = useMemo(() => {
    if (Y === 0) {
      if (isCurrentCalendarWeek) {
        return 'Scan your first product to see your weekly summary here.'
      }
      return 'No scans in this week — choose another date range above.'
    }
    if (flaggedZero) {
      return isCurrentCalendarWeek
        ? 'Every product you scanned this week had zero flagged ingredients.'
        : 'Every product you scanned that week had zero flagged ingredients.'
    }
    if (metrics.topNameThisWeek && metrics.topNameCount > 0) {
      const t = metrics.topNameCount
      const timePhrase = t === 1 ? 'once' : `${t} times`
      return `${metrics.topNameThisWeek} showed up most — ${timePhrase}.`
    }
    return 'Review ingredient cards on each scan for details.'
  }, [Y, flaggedZero, metrics.topNameThisWeek, metrics.topNameCount, isCurrentCalendarWeek])

  const onPickWeek = useCallback((item: WeekWithScanData) => {
    const d = new Date(item.start)
    d.setHours(12, 0, 0, 0)
    setSelectedWeekAnchor(d)
    setWeekPickerVisible(false)
  }, [])

  useEffect(() => {
    if (loading) setWeekPickerVisible(false)
  }, [loading])

  const onShareMyWeek = useCallback(async () => {
    const textFallback = () => {
      const { message, title, url } = buildOverviewWeekShareContent({
        weekLabel,
        scansThisWeek: Y,
        flaggedIngredientsThisWeek: X,
        avgFit: metrics.avgFitThisWeek,
        topName: metrics.topNameThisWeek,
        topCount: metrics.topNameCount,
      })
      try {
        if (Platform.OS === 'web') {
          void Share.share({ message, title })
        } else if (Platform.OS === 'ios' && url) {
          void Share.share({ message, url, title })
        } else {
          void Share.share({ message, title })
        }
      } catch {
        // dismissed
      }
    }

    if (Platform.OS === 'web') {
      textFallback()
      return
    }

    await new Promise((r) => setTimeout(r, 160))
    let uri: string | null = null
    try {
      uri = await captureRef(weekShareCardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      })
    } catch {
      uri = null
    }
    if (!uri) {
      textFallback()
      return
    }
    try {
      await Share.share({ url: uri, message: SHARE_WEEK_MESSAGE })
    } catch {
      try {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: 'Share Fillr week',
            UTI: 'public.png',
          })
          return
        }
      } catch {
        // fall through
      }
      textFallback()
    }
  }, [
    weekLabel,
    Y,
    X,
    metrics.avgFitThisWeek,
    metrics.topNameThisWeek,
    metrics.topNameCount,
  ])

  const weekPickerModal = (
    <Modal
      visible={weekPickerVisible && canPickWeek}
      transparent
      animationType="fade"
      onRequestClose={() => setWeekPickerVisible(false)}
    >
      <View style={styles.modalRoot}>
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setWeekPickerVisible(false)}
          accessibilityLabel="Dismiss week picker"
        />
        <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <Text style={styles.modalTitle}>Choose a week</Text>
          <Text style={styles.modalSubtitle}>
            Includes the current week even with no scans, so you can jump back.
          </Text>
          <FlatList
            data={weekPickerOptions}
            keyExtractor={(item) => String(item.start.getTime())}
            style={styles.modalList}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const lbl = formatWeekRangeLabel(item.start, item.end)
              const selected = item.start.getTime() === week.start.getTime()
              const scansLbl = plural(item.scanCount, 'scan', 'scans')
              return (
                <Pressable
                  onPress={() => onPickWeek(item)}
                  style={({ pressed }) => [
                    styles.modalRow,
                    selected && styles.modalRowSelected,
                    pressed && styles.modalRowPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${lbl}, ${item.scanCount} ${scansLbl}`}
                >
                  <View style={styles.modalRowText}>
                    <Text style={styles.modalRowLabel}>{lbl}</Text>
                    <Text style={styles.modalRowMeta}>
                      {item.scanCount} {scansLbl}
                    </Text>
                  </View>
                  {selected ? (
                    <Ionicons name="checkmark-circle" size={22} color="#16a34a" />
                  ) : null}
                </Pressable>
              )
            }}
          />
        </View>
      </View>
    </Modal>
  )

  if (loading) {
    return (
      <GradientBackground variant="home">
        {weekPickerModal}
        <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
          <View style={{ paddingHorizontal: H_PAD }}>
            <View style={[styles.headerRow, { paddingTop: 8 }]}>
              <FillrHeaderLogo />
              <WeekRangePill label={weekLabel} interactive={false} />
            </View>
            <OverviewSkeleton />
          </View>
        </SafeAreaView>
      </GradientBackground>
    )
  }

  if (metrics.totalEver === 0) {
    return (
      <GradientBackground variant="home">
        {weekPickerModal}
        <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
          <View style={[styles.headerRow, { paddingTop: 8, paddingHorizontal: H_PAD }]}>
            <FillrHeaderLogo />
            <WeekRangePill label={weekLabel} interactive={false} />
          </View>
          <View style={styles.emptyWrap}>
            <LinearGradient
              colors={['#ecfdf5', '#d1fae5']}
              style={styles.emptyIconOrb}
            >
              <Ionicons name="barcode-outline" size={52} color="#22c55e" />
            </LinearGradient>
            <Text style={styles.emptyTitle}>No scans yet</Text>
            <Text style={styles.emptyBody}>
              Start scanning products to unlock your weekly ingredient story — built for sharing.
            </Text>
            <Pressable
              onPress={() => router.push('/(tabs)/scan')}
              style={({ pressed }) => [styles.emptyCta, pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] }]}
            >
              <LinearGradient
                colors={['#4ade80', '#22c55e']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyCtaGrad}
              >
                <Ionicons name="scan-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.emptyCtaText}>Scan your first product</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </SafeAreaView>
      </GradientBackground>
    )
  }

  return (
    <GradientBackground variant="home">
      {weekPickerModal}
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <FillrHeaderLogo />
            <WeekRangePill
              label={weekLabel}
              interactive={canPickWeek}
              onPress={canPickWeek ? () => setWeekPickerVisible(true) : undefined}
            />
          </View>

          <LinearGradient
            colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.78)']}
            style={styles.heroCard}
          >
            <Text style={styles.heroKicker}>
              {isCurrentCalendarWeek ? 'THIS WEEK' : 'SELECTED WEEK'}
            </Text>
            <Text style={styles.headlineLine1}>
              {flaggedZero ? (
                <>
                  <Text style={styles.headlineCelebrate}>Clean streak. </Text>
                  No flagged {ingredientsWord} across your {Y} {scansWord}.
                </>
              ) : (
                <>
                  We flagged{' '}
                  <Text style={styles.headlineRed}>
                    {X} {ingredientsWord}
                  </Text>{' '}
                  across your {Y} {scansWord}.
                </>
              )}
            </Text>
            <Text style={styles.headlineLine2}>{line2}</Text>
            <Pressable
              onPress={() => void onShareMyWeek()}
              accessibilityRole="button"
              accessibilityLabel="Share my week"
              style={({ pressed }) => [
                styles.shareWeekBtn,
                pressed && styles.shareWeekBtnPressed,
              ]}
            >
              <Ionicons name="share-outline" size={18} color="#15803d" />
              <Text style={styles.shareWeekBtnText}>Share my week</Text>
            </Pressable>
          </LinearGradient>

          <View style={styles.divider} />

          <Text style={styles.sectionKicker}>WATCH LIST</Text>
          <Text style={styles.sectionTitle}>
            {isCurrentCalendarWeek ? 'Most flagged this week' : 'Most flagged that week'}
          </Text>
          {flaggedZero ? (
            <View style={styles.cleanBanner}>
              <Ionicons name="checkmark-circle" size={22} color="#16a34a" />
              <Text style={styles.cleanBannerText}>
                {isCurrentCalendarWeek
                  ? 'No flagged ingredients this week'
                  : 'No flagged ingredients that week'}
              </Text>
            </View>
          ) : (
            <View style={styles.flaggedPanel}>
              {metrics.topFlagged.map((row, i) => (
                <FlaggedRow
                  key={`${row.name}-${i}`}
                  row={row}
                  isLast={i === metrics.topFlagged.length - 1}
                />
              ))}
            </View>
          )}

          <View style={styles.divider} />

          <Text style={styles.sectionKicker}>ALL TIME</Text>
          <Text style={styles.sectionTitle}>Ingredient breakdown</Text>
          <Text style={styles.sectionHint}>{"Totals from every scan you've saved"}</Text>

          <View style={styles.breakdownPanel}>
            <BreakdownBarRow
              label="Natural"
              count={metrics.cumulative.natural}
              maxCount={maxBar}
              countColor="#16a34a"
              gradKey="natural"
            />
            <BreakdownBarRow
              label="Processed"
              count={metrics.cumulative.processed}
              maxCount={maxBar}
              countColor="#d97706"
              gradKey="processed"
            />
            <BreakdownBarRow
              label="Additives"
              count={metrics.cumulative.additive}
              maxCount={maxBar}
              countColor="#ea580c"
              gradKey="additives"
            />
            <BreakdownBarRow
              label="Flagged"
              count={metrics.cumulative.flagged}
              maxCount={maxBar}
              countColor="#dc2626"
              gradKey="flagged"
            />
          </View>

          <View style={styles.divider} />

          <LinearGradient
            colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.65)']}
            style={styles.statsRail}
          >
            <StatCol value={String(Y)} label="SCANS" valueColor={TEXT_PRIMARY} />
            <StatDivider />
            <StatCol
              value={String(X)}
              label="FLAGGED"
              valueColor={X > 0 ? '#dc2626' : '#16a34a'}
            />
            <StatDivider />
            <StatCol value={avgFitStr} label="AVG FIT" valueColor={avgFitColor} />
          </LinearGradient>
        </ScrollView>
        <View
          style={[styles.shareCardHiddenWrap, { width: Dimensions.get('window').width }]}
          pointerEvents="none"
          collapsable={false}
        >
          <OverviewWeekShareCardVisual ref={weekShareCardRef} {...weekShareCardModel} />
        </View>
      </SafeAreaView>
    </GradientBackground>
  )
}

const shadowSoft = Platform.select({
  ios: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
  },
  android: { elevation: 3 },
  default: {},
})

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  shareCardHiddenWrap: {
    position: 'absolute',
    left: -9999,
    top: -9999,
    opacity: 0,
  },
  scroll: {
    paddingHorizontal: H_PAD,
    paddingTop: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 8,
  },
  weekPill: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '58%',
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.15)',
  },
  weekPillPressed: {
    opacity: 0.88,
  },
  weekRange: {
    fontSize: 11,
    color: TEXT_MUTED,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  heroCard: {
    borderRadius: 22,
    padding: 20,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.12)',
    ...shadowSoft,
  },
  heroKicker: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16a34a',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  headlineLine1: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    lineHeight: 28,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  headlineCelebrate: {
    color: '#15803d',
    fontWeight: '800',
  },
  headlineRed: {
    color: '#dc2626',
    fontWeight: '800',
  },
  headlineLine2: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 21,
    fontWeight: '500',
  },
  shareWeekBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.22)',
    gap: 8,
  },
  shareWeekBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  shareWeekBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#15803d',
    letterSpacing: -0.2,
  },
  divider: {
    height: 1,
    backgroundColor: MINT_DIVIDER,
    marginBottom: 22,
  },
  sectionKicker: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: -0.35,
    marginBottom: 6,
  },
  sectionHint: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginBottom: 14,
    fontWeight: '500',
  },
  flaggedPanel: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.05)',
    overflow: 'hidden',
    marginBottom: 4,
    ...shadowSoft,
  },
  flagRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(15, 23, 42, 0.06)',
  },
  flagRowLast: {
    borderBottomWidth: 0,
  },
  flagAccent: {
    width: 4,
    marginVertical: 12,
    marginLeft: 0,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  flagBody: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: 14,
    paddingLeft: 12,
  },
  flagTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  flagName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  flagBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  flagBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4b5563',
  },
  flagDesc: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 6,
    lineHeight: 17,
    fontWeight: '500',
  },
  cleanBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(220, 252, 231, 0.65)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
    marginBottom: 4,
  },
  cleanBannerText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#15803d',
    flex: 1,
  },
  breakdownPanel: {
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 18,
    padding: 16,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.05)',
    marginBottom: 4,
    ...shadowSoft,
  },
  breakRow: {
    marginBottom: 14,
  },
  breakTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  breakLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  breakCount: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  breakTrack: {
    height: 8,
    borderRadius: 100,
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
    overflow: 'hidden',
  },
  breakFillGrad: {
    height: 8,
    borderRadius: 100,
    minWidth: 8,
  },
  statsRail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 8,
    borderRadius: 20,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.12)',
    ...shadowSoft,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statNum: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  statLbl: {
    fontSize: 9,
    fontWeight: '700',
    color: TEXT_MUTED,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 6,
    textAlign: 'center',
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 36,
    backgroundColor: MINT_DIVIDER,
    alignSelf: 'center',
  },
  emptyWrap: {
    flex: 1,
    paddingHorizontal: H_PAD,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  emptyIconOrb: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: -0.4,
    marginTop: 12,
  },
  emptyBody: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 10,
    maxWidth: 300,
    fontWeight: '500',
  },
  emptyCta: {
    marginTop: 28,
    borderRadius: 100,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#22c55e',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  emptyCtaGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    paddingHorizontal: 28,
  },
  emptyCtaText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: '78%',
    width: '100%',
    alignSelf: 'stretch',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: -0.4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: TEXT_MUTED,
    marginTop: 6,
    lineHeight: 18,
    fontWeight: '500',
  },
  modalList: {
    marginTop: 16,
    flexGrow: 0,
    maxHeight: 420,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  modalRowPressed: {
    opacity: 0.92,
  },
  modalRowSelected: {
    borderColor: 'rgba(34, 197, 94, 0.45)',
    backgroundColor: 'rgba(236, 253, 245, 0.65)',
  },
  modalRowText: {
    flex: 1,
    marginRight: 10,
  },
  modalRowLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    letterSpacing: -0.2,
  },
  modalRowMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_MUTED,
    marginTop: 4,
  },
  skelWrap: {
    marginTop: 8,
    alignSelf: 'stretch',
    width: '100%',
  },
  skelBox: {
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
  },
})
