import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Share,
  Modal,
  FlatList,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native'
import { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { router, useNavigation } from 'expo-router'
import { useFonts } from 'expo-font'
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans'
import {
  OverviewWeekShareCardVisual,
  SHARE_WEEK_MESSAGE,
  buildOverviewWeekShareCardModel,
} from '../../components'
import { OverviewDashboardBody } from '../../components/overview/OverviewDashboard'
import { homeWordmarkLayout, spacing, colors } from '../../constants/theme'
import { useOverviewData } from '../../hooks/useOverviewData'
import {
  computeOverviewMetrics,
  formatWeekRangeLabel,
  getWeekBounds,
  getWeekPickerOptions,
} from '../../lib/overviewAnalytics'
import { buildWeekDayOverviewSeries } from '../../lib/overviewChartData'
import type { WeekWithScanData } from '../../lib/overviewAnalytics'
import { buildOverviewWeekShareContent } from '../../lib/buildOverviewWeekShare'
import { buildOverviewDashboardModel } from '../../lib/buildOverviewDashboardModel'

const H_PAD = homeWordmarkLayout.horizontalPad
const INK = '#0f172a'
const MUTED = '#64748b'
const LINE = 'rgba(15, 23, 42, 0.08)'

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

function WeekRangePill({
  label,
  interactive,
  onPress,
  fillSlot,
}: {
  label: string
  interactive: boolean
  onPress?: () => void
  /** When true, pill stretches in the header row so long ranges ellipsize next to the share control. */
  fillSlot?: boolean
}) {
  const pillStyle = [styles.weekPill, fillSlot ? styles.weekPillWide : styles.weekPillHugEnd]
  const inner = (
    <>
      <Ionicons name="calendar-outline" size={13} color={MUTED} style={styles.weekPillCalendarIcon} />
      <View style={styles.weekPillLabelWrap}>
        <Text style={styles.weekRange} numberOfLines={1} ellipsizeMode="tail">
          {label}
        </Text>
      </View>
      {interactive ? (
        <Ionicons name="chevron-down" size={15} color={MUTED} style={styles.weekPillChevron} />
      ) : null}
    </>
  )
  if (!interactive) {
    return <View style={pillStyle}>{inner}</View>
  }
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pillStyle, pressed && { opacity: 0.88 }]}
      accessibilityRole="button"
      accessibilityHint="Opens a list of weeks that have scans"
      accessibilityLabel={`Week range ${label}. Tap to choose another week.`}
    >
      {inner}
    </Pressable>
  )
}

export default function OverviewScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { width: windowWidth } = useWindowDimensions()
  const { rows, loading } = useOverviewData()
  const weekShareCardRef = useRef<View>(null)
  const [selectedWeekAnchor, setSelectedWeekAnchor] = useState(() => new Date())
  const [weekPickerVisible, setWeekPickerVisible] = useState(false)

  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  })

  const fonts = useMemo(
    () => ({
      sans: 'DMSans_400Regular',
      sansMedium: 'DMSans_500Medium',
      sansSemiBold: 'DMSans_600SemiBold',
      sansBold: 'DMSans_700Bold',
    }),
    []
  )

  const week = useMemo(() => getWeekBounds(selectedWeekAnchor), [selectedWeekAnchor])
  const weekLabel = useMemo(() => formatWeekRangeLabel(week.start, week.end), [week])

  const weekPickerOptions = useMemo(() => getWeekPickerOptions(rows), [rows])
  const canPickWeek = !loading && weekPickerOptions.length > 0

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

  const bottomPad = insets.bottom + spacing.xxxl * 2.2

  const Y = metrics.totalScansThisWeek
  const X = metrics.flaggedIngredientsThisWeek

  const daySeries = useMemo(() => buildWeekDayOverviewSeries(rows, week), [rows, week])

  const dashboardModel = useMemo(
    () => buildOverviewDashboardModel(rows, week, metrics),
    [rows, week, metrics]
  )

  /** Width for charts inside padded cards (matches card inner horizontal space). */
  const overviewChartWidth = Math.max(280, windowWidth - H_PAD * 2 - spacing.xl * 2)

  const topInsightDestination = useMemo(() => {
    if (Y === 0) return false
    if (metrics.topFlagged.length > 0) return true
    if (metrics.avgFitThisWeek != null && metrics.avgFitThisWeek > 0 && metrics.avgFitThisWeek < 52) return true
    return false
  }, [Y, metrics.topFlagged.length, metrics.avgFitThisWeek])

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

  useLayoutEffect(() => {
    /** Leave room for Fillr mark + wordmark + header padding so the week row never collides with the logo. */
    const headerRightMaxWidth = Math.max(
      168,
      Math.min(380, windowWidth - 132 - Math.max(insets.left, homeWordmarkLayout.horizontalPad))
    )
    const shareWeekEnabled = !loading && metrics.totalEver > 0 && Y > 0
    /** Tighter to the trailing edge than the default tab padding; safe-area still respected. */
    const headerRightPad = Math.max(spacing.sm, insets.right)
    navigation.setOptions({
      headerRightContainerStyle: {
        paddingRight: headerRightPad,
        paddingLeft: spacing.xs,
        maxWidth: headerRightMaxWidth,
        flexShrink: 1,
      },
      headerRight: () => (
        <View style={styles.headerRightAlignEnd}>
          <View style={styles.overviewHeaderActions}>
            <View style={shareWeekEnabled ? styles.weekPillSlot : styles.weekPillSlotSolo}>
              <WeekRangePill
                label={weekLabel}
                fillSlot={shareWeekEnabled}
                interactive={canPickWeek && !loading}
                onPress={canPickWeek && !loading ? () => setWeekPickerVisible(true) : undefined}
              />
            </View>
            {shareWeekEnabled ? (
              <Pressable
                onPress={() => void onShareMyWeek()}
                accessibilityRole="button"
                accessibilityLabel="Share week summary"
                hitSlop={10}
                style={({ pressed }) => [styles.shareIconBtn, pressed && { opacity: 0.75 }]}
              >
                <Ionicons name="share-outline" size={20} color={INK} />
              </Pressable>
            ) : null}
          </View>
        </View>
      ),
    })
  }, [
    navigation,
    weekLabel,
    canPickWeek,
    loading,
    metrics.totalEver,
    Y,
    onShareMyWeek,
    windowWidth,
    insets.left,
    insets.right,
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
                  {selected ? <Ionicons name="checkmark-circle" size={22} color="#16a34a" /> : null}
                </Pressable>
              )
            }}
          />
        </View>
      </View>
    </Modal>
  )

  if (!fontsLoaded) {
    return (
      <View style={[styles.overviewScreenRoot, styles.boot]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    )
  }

  if (loading) {
    return (
      <View style={styles.overviewScreenRoot}>
        {weekPickerModal}
        <SafeAreaView style={styles.screen} edges={['bottom']}>
          <View style={styles.loadingBody}>
            <View style={styles.skelHero} />
            <View style={styles.skelLine} />
            <View style={styles.skelLineShort} />
            <View style={styles.skelCard} />
            <View style={styles.skelCard} />
          </View>
        </SafeAreaView>
      </View>
    )
  }

  if (metrics.totalEver === 0) {
    return (
      <View style={styles.overviewScreenRoot}>
        {weekPickerModal}
        <SafeAreaView style={styles.screen} edges={['bottom']}>
          <View style={{ flex: 1 }}>
            <View style={[styles.emptyWrap, { paddingTop: spacing.sm }]}>
              <LinearGradient colors={['#ecfdf5', '#bbf7d0']} style={styles.emptyIconOrb}>
                <Ionicons name="sparkles-outline" size={44} color="#15803d" />
              </LinearGradient>
              <Text style={[styles.emptyTitle, { fontFamily: fonts.sansBold }]}>Your overview is empty</Text>
              <Text style={[styles.emptyBody, { fontFamily: fonts.sans }]}>
                Scan a few products — we’ll turn barcode pulls into week-level patterns: fit scores, flagged
                ingredients, and how often you reach for the scanner.
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
                  <Text style={[styles.emptyCtaText, { fontFamily: fonts.sansSemiBold }]}>Start scanning</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </View>
    )
  }

  return (
    <View style={styles.overviewScreenRoot}>
      {weekPickerModal}
      <SafeAreaView style={styles.screen} edges={['bottom']}>
        <View style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={[styles.scrollDashboard, { paddingBottom: bottomPad }]}
            showsVerticalScrollIndicator={false}
          >
            <OverviewDashboardBody
              model={dashboardModel}
              daySeries={daySeries}
              fonts={fonts}
              chartWidth={overviewChartWidth}
              onTopInsightPress={topInsightDestination ? () => router.push('/worst-offenders') : undefined}
            />
          </ScrollView>
          <View
            style={[styles.shareCardHiddenWrap, { width: windowWidth }]}
            pointerEvents="none"
            collapsable={false}
          >
            <OverviewWeekShareCardVisual ref={weekShareCardRef} {...weekShareCardModel} />
          </View>
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  overviewScreenRoot: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollDashboard: {
    paddingHorizontal: H_PAD,
    paddingTop: spacing.md,
    backgroundColor: '#ffffff',
  },
  boot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  screen: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  shareCardHiddenWrap: {
    position: 'absolute',
    left: -9999,
    top: -9999,
    opacity: 0,
  },
  loadingBody: {
    flex: 1,
    paddingHorizontal: H_PAD,
    paddingTop: spacing.lg,
    gap: 12,
  },
  skelHero: {
    height: 140,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
  },
  skelLine: {
    height: 22,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    width: '88%',
  },
  skelLineShort: {
    height: 16,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    width: '62%',
  },
  skelCard: {
    height: 96,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
  },
  headerRightAlignEnd: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  overviewHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
    minWidth: 0,
    justifyContent: 'flex-end',
  },
  weekPillSlot: {
    flex: 1,
    minWidth: 0,
  },
  weekPillSlotSolo: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
  },
  shareIconBtn: {
    flexShrink: 0,
    padding: 7,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: LINE,
  },
  weekPill: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: LINE,
  },
  weekPillWide: {
    alignSelf: 'stretch',
    width: '100%',
  },
  weekPillHugEnd: {
    alignSelf: 'flex-end',
    maxWidth: '100%',
  },
  weekPillCalendarIcon: {
    marginRight: 6,
    flexShrink: 0,
  },
  weekPillLabelWrap: {
    flex: 1,
    minWidth: 0,
  },
  weekPillChevron: {
    marginLeft: 4,
    flexShrink: 0,
  },
  weekRange: {
    fontSize: 12,
    color: MUTED,
    fontWeight: '600',
    letterSpacing: 0.15,
  },
  emptyWrap: {
    flex: 1,
    paddingHorizontal: H_PAD,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  emptyIconOrb: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 24,
    color: INK,
    letterSpacing: -0.5,
    marginTop: 12,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 15,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 10,
    maxWidth: 320,
  },
  emptyCta: {
    marginTop: 28,
    borderRadius: 100,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#22c55e',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
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
    color: INK,
    letterSpacing: -0.4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: MUTED,
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
    color: INK,
    letterSpacing: -0.2,
  },
  modalRowMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: MUTED,
    marginTop: 4,
  },
})
