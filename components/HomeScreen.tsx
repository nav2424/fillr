import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  useWindowDimensions,
  Image,
} from 'react-native'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors, homeWordmarkLayout, spacing } from '../constants/theme'
import { formatHistoryListTitle } from '../lib/historyDisplayLabel'
import { resolveSafetyStatusWithCeliac } from '../lib/personalizationEngine'
import type { HomeScreenData, HomeRecentScan, HomeWatchlistCard } from '../lib/buildHomeScreenData'
import { useUserStore } from '../store/userStore'
import type { SafetyStatus } from '../types'
import { FillrHeaderLogo, FILLR_LOGO_MARK } from './FillrHeaderLogo'

const BG = '#ffffff'
const INK = '#0f172a'
const MUTED = '#64748b'
const GREEN = colors.accent
const GREEN_DEEP = '#15803d'
const LINE = 'rgba(15, 23, 42, 0.08)'
const CARD_FILL = '#fafafa'

const WATCH_CARD_W = 168

const STATUS_COLOR: Record<SafetyStatus, string> = {
  SAFE: colors.safe,
  CAUTION: colors.caution,
  UNSAFE: colors.danger,
  UNKNOWN: colors.unknown,
}

const STATUS_MUTED: Record<SafetyStatus, string> = {
  SAFE: colors.safeMuted,
  CAUTION: colors.cautionMuted,
  UNSAFE: colors.dangerMuted,
  UNKNOWN: colors.unknownMuted,
}

const STATUS_LABEL: Record<SafetyStatus, string> = {
  SAFE: 'Safe',
  CAUTION: 'Caution',
  UNSAFE: 'Not safe',
  UNKNOWN: 'Unknown',
}

export type HomeScreenActions = {
  onScanBarcode?: () => void
  onAlertPress?: (alertId: string) => void
  onRecentSeeAll?: () => void
  onRecentCardPress?: (scanId: string) => void
  onShareFillr?: () => void
  onManageWatchlist?: () => void
  /** Opens Profile so the user can adjust allergies, sensitivities, goal, and related settings. */
  onWatchlistCardPress?: (card: HomeWatchlistCard) => void
}

export type HomeScreenProps = HomeScreenData &
  HomeScreenActions & {
    fonts: {
      sansLight: string
      sans: string
      sansMedium: string
      sansSemiBold: string
      sansBold: string
      serif: string
      serifItalic: string
    }
  }

function watchlistColors(v: HomeWatchlistCard['variant']) {
  switch (v) {
    case 'allergy':
      return { tagBg: '#fee2e2', tagText: '#b91c1c', icon: 'warning' as const, iconColor: '#b91c1c' }
    case 'sensitivity':
      return { tagBg: '#ffedd5', tagText: '#c2410c', icon: 'flask-outline' as const, iconColor: '#ea580c' }
    case 'preference':
      return { tagBg: '#e0f2fe', tagText: '#0369a1', icon: 'options-outline' as const, iconColor: '#0284c7' }
    case 'goal':
      return { tagBg: '#dcfce7', tagText: GREEN_DEEP, icon: 'flag-outline' as const, iconColor: GREEN_DEEP }
  }
}

function WatchlistPill({
  card,
  fonts,
  onPress,
}: {
  card: HomeWatchlistCard
  fonts: HomeScreenProps['fonts']
  onPress?: (card: HomeWatchlistCard) => void
}) {
  const c = watchlistColors(card.variant)
  const a11yHint = 'Opens Profile to manage your diet'
  return (
    <Pressable
      onPress={() => onPress?.(card)}
      disabled={!onPress}
      style={({ pressed }) => [styles.watchPill, pressed && onPress && styles.watchPillPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${card.title}. ${card.subtitle}`}
      accessibilityHint={onPress ? a11yHint : undefined}
    >
      <View style={[styles.watchIconOrb, { backgroundColor: c.tagBg }]}>
        <Ionicons name={c.icon} size={22} color={c.iconColor} />
      </View>
      <Text style={[styles.watchTitle, { fontFamily: fonts.sansSemiBold }]} numberOfLines={1}>
        {card.title}
      </Text>
      <View style={[styles.watchTag, { backgroundColor: c.tagBg }]}>
        <Text style={[styles.watchTagText, { color: c.tagText, fontFamily: fonts.sansSemiBold }]}>{card.tag}</Text>
      </View>
      <Text style={[styles.watchSub, { fontFamily: fonts.sans }]} numberOfLines={2}>
        {card.subtitle}
      </Text>
    </Pressable>
  )
}

function RecentRow({
  scan,
  fonts,
  onPress,
  isLast,
}: {
  scan: HomeRecentScan
  fonts: HomeScreenProps['fonts']
  onPress?: (id: string) => void
  isLast?: boolean
}) {
  const celiacStrictGluten = useUserStore((s) => s.celiacStrictGluten)
  const status = resolveSafetyStatusWithCeliac(
    scan.safetyStatus,
    { celiacStrictGluten },
    scan.celiac
  )
  const color = STATUS_COLOR[status] ?? STATUS_COLOR.UNKNOWN
  const pillBg = STATUS_MUTED[status] ?? STATUS_MUTED.UNKNOWN

  return (
    <Pressable
      onPress={() => onPress?.(scan.id)}
      style={({ pressed }) => [
        styles.recRowOuter,
        !isLast && styles.recRowGap,
        pressed && styles.recRowPressed,
      ]}
    >
      <View style={styles.recRowCard}>
        <View
          style={[
            styles.recStatusStripe,
            { backgroundColor: color, borderTopLeftRadius: 18, borderBottomLeftRadius: 18 },
          ]}
        />
        <View style={styles.recIconWrap}>
          <Ionicons
            name={scan.source === 'ocr' ? 'camera' : 'barcode-outline'}
            size={18}
            color={MUTED}
          />
        </View>
        <View style={styles.recMain}>
          <View style={styles.recBody}>
            <Text style={[styles.recProductName, { fontFamily: fonts.sansSemiBold }]} numberOfLines={2}>
              {formatHistoryListTitle(scan.productName, scan.date, scan.source)}
            </Text>
            <Text style={[styles.recDate, { fontFamily: fonts.sans }]}>{scan.scannedAtLabel}</Text>
          </View>
          <View style={styles.recMeta}>
            <View style={[styles.recStatusPill, { backgroundColor: pillBg, borderColor: `${color}40` }]}>
              <Text style={[styles.recStatusPillText, { color, fontFamily: fonts.sansBold }]}>
                {STATUS_LABEL[status]}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={MUTED} />
          </View>
        </View>
      </View>
    </Pressable>
  )
}

export function HomeScreen({
  firstName,
  greetingTitle,
  headlineLead,
  headlineAccent,
  subhead,
  watchlistCards,
  alerts,
  recentScans,
  fonts,
  onScanBarcode,
  onAlertPress,
  onRecentSeeAll,
  onRecentCardPress,
  onShareFillr,
  onManageWatchlist,
  onWatchlistCardPress,
}: HomeScreenProps) {
  const insets = useSafeAreaInsets()
  const tabBarHeight = useBottomTabBarHeight()
  const { width: windowWidth } = useWindowDimensions()
  const bottomPad = tabBarHeight + 20
  const hPad = homeWordmarkLayout.horizontalPad
  const padLeft = Math.max(hPad, insets.left)
  const padRight = Math.max(hPad, insets.right)
  const contentWidth = windowWidth - padLeft - padRight
  const heroSideBySide = contentWidth >= 340
  const heroScanColWidth = Math.min(200, Math.max(148, Math.floor(contentWidth * 0.4)))
  const recentList = recentScans.slice(0, 4)

  return (
    <View style={styles.root}>
      {/*
        Horizontal padding lives on this wrapper — not on ScrollView contentContainerStyle.
        Otherwise a nested horizontal ScrollView can expand the vertical content width and clip the right edge.
      */}
      <View style={[styles.hPadShell, { paddingLeft: padLeft, paddingRight: padRight }]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ paddingTop: Math.max(insets.top, homeWordmarkLayout.minStatusPad) + 4 }}>
          <View style={styles.topRow}>
            <FillrHeaderLogo />
            <View style={styles.topActions}>
              <Pressable
                onPress={onShareFillr}
                hitSlop={10}
                style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.75 }]}
                accessibilityRole="button"
                accessibilityLabel="Share Fillr with a friend"
              >
                <Ionicons name="share-outline" size={22} color={INK} />
              </Pressable>
            </View>
          </View>

          <View style={[styles.heroRow, !heroSideBySide && styles.heroRowStacked]}>
            <View style={styles.heroCopy}>
              <Text style={[styles.greet, { fontFamily: fonts.sansSemiBold, color: GREEN_DEEP }]}>{greetingTitle}</Text>

              <Text style={[styles.headlineLine1, { fontFamily: fonts.sansBold }]}>{headlineLead}</Text>
              <View style={styles.headlineAccentBlock}>
                <Text style={[styles.headlineAccentText, { fontFamily: fonts.sansBold }]}>{headlineAccent}</Text>
                <View style={styles.headlineUnderline} />
              </View>

              <Text style={[styles.sub, { fontFamily: fonts.sans }]}>{subhead}</Text>
            </View>

            <View
              style={[
                styles.heroScanCol,
                !heroSideBySide && styles.heroScanColStacked,
                heroSideBySide && { width: heroScanColWidth },
              ]}
            >
              <View style={styles.scanZone}>
                <Pressable
                  onPress={onScanBarcode}
                  style={({ pressed }) => [styles.scanTile, pressed && { transform: [{ scale: 0.98 }] }]}
                  accessibilityRole="button"
                  accessibilityLabel="Scan now"
                >
                  <Image source={FILLR_LOGO_MARK} style={styles.scanMark} resizeMode="contain" />
                </Pressable>
                <Text style={[styles.scanNowLabel, { fontFamily: fonts.sansBold }]}>Scan now</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionHead}>
            <View style={styles.sectionTitleWrap}>
              <Text style={[styles.sectionTitle, { fontFamily: fonts.sansSemiBold }]} numberOfLines={1}>
                Your watchlist
              </Text>
            </View>
            <Pressable onPress={onManageWatchlist} hitSlop={10} style={styles.sectionLinkPress}>
              <Text
                style={[styles.sectionLink, { fontFamily: fonts.sansSemiBold }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Manage ›
              </Text>
            </Pressable>
          </View>
          <View
            style={[
              styles.watchStripWrap,
              {
                width: windowWidth,
                marginLeft: -padLeft,
                marginRight: -padRight,
              },
            ]}
          >
            <ScrollView
              horizontal
              style={[styles.watchScroll, { width: windowWidth }]}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.watchRow, { paddingLeft: padLeft, paddingRight: 0 }]}
            >
              {watchlistCards.length > 0 ? (
                <>
                  {watchlistCards.map((c) => (
                    <WatchlistPill key={c.id} card={c} fonts={fonts} onPress={onWatchlistCardPress} />
                  ))}
                  {/*
                    End spacer (RN has no ::after): matches left inset so the last card can scroll past
                    the edge without right padding clipping the strip.
                  */}
                  <View style={[styles.watchScrollEndSpacer, { width: padLeft }]} />
                </>
              ) : (
                <Text style={[styles.emptyHint, { fontFamily: fonts.sans }]}>
                  Add allergies, sensitivities, or preferences in Profile to populate.
                </Text>
              )}
            </ScrollView>
          </View>

          {alerts.length > 0 ? (
            <Pressable style={styles.alertBanner} onPress={() => onAlertPress?.(alerts[0].id)}>
              <Ionicons name="alert-circle" size={20} color="#b91c1c" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.alertTitle, { fontFamily: fonts.sansSemiBold }]}>{alerts[0].title}</Text>
                <Text style={[styles.alertSub, { fontFamily: fonts.sans }]} numberOfLines={2}>
                  {alerts[0].subtitle}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#b91c1c" />
            </Pressable>
          ) : null}

          <View style={styles.sectionHead}>
            <View style={styles.sectionTitleWrap}>
              <Text style={[styles.sectionTitle, { fontFamily: fonts.sansSemiBold }]} numberOfLines={1}>
                Recent scans
              </Text>
            </View>
            <Pressable onPress={onRecentSeeAll} hitSlop={10} style={styles.sectionLinkPress}>
              <Text
                style={[styles.sectionLink, { fontFamily: fonts.sansSemiBold }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                View all history ›
              </Text>
            </Pressable>
          </View>
          <View style={styles.recentListBlock}>
            {recentList.length === 0 ? (
              <Text style={[styles.emptyHint, { fontFamily: fonts.sans, paddingVertical: 20 }]}>
                Scan a barcode to build your history.
              </Text>
            ) : (
              recentList.map((s, i) => (
                <RecentRow
                  key={s.id}
                  scan={s}
                  fonts={fonts}
                  onPress={onRecentCardPress}
                  isLast={i === recentList.length - 1}
                />
              ))
            )}
          </View>
          </View>
        </ScrollView>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  hPadShell: { flex: 1, maxWidth: '100%' },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, backgroundColor: BG },
  watchScroll: { flexGrow: 0 },
  watchStripWrap: {
    marginBottom: spacing.xl + spacing.md,
  },
  watchScrollEndSpacer: {
    flexShrink: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconBtn: { position: 'relative', padding: 4 },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 28,
    width: '100%',
    maxWidth: '100%',
  },
  heroRowStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  heroScanCol: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  heroScanColStacked: {
    width: '100%' as const,
    marginTop: 8,
    alignItems: 'center',
  },
  greet: { fontSize: 16, marginBottom: 10, letterSpacing: -0.2 },
  headlineLine1: {
    fontSize: 26,
    lineHeight: 32,
    color: INK,
    letterSpacing: -0.6,
    marginBottom: 2,
  },
  headlineAccentBlock: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  headlineAccentText: {
    fontSize: 26,
    lineHeight: 32,
    color: GREEN,
    letterSpacing: -0.6,
  },
  headlineUnderline: {
    marginTop: 8,
    height: 5,
    borderRadius: 4,
    backgroundColor: GREEN,
    opacity: 0.9,
    alignSelf: 'stretch',
    transform: [{ rotate: '-1deg' }],
  },
  sub: { fontSize: 15, lineHeight: 22, color: MUTED, marginBottom: 0 },
  scanZone: {
    alignItems: 'center',
    marginBottom: 0,
    width: '100%',
    justifyContent: 'flex-start',
  },
  scanTile: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
      },
      android: { elevation: 8 },
    }),
    borderWidth: 1,
    borderColor: LINE,
  },
  scanMark: { width: 76, height: 76 },
  scanNowLabel: {
    marginTop: 2,
    fontSize: 16,
    color: INK,
    letterSpacing: -0.35,
    textAlign: 'center',
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  sectionTitleWrap: {
    flex: 1,
    minWidth: 0,
    marginRight: 4,
  },
  sectionTitle: { fontSize: 17, color: INK, letterSpacing: -0.3 },
  sectionLinkPress: { flexShrink: 1, minWidth: 0, alignItems: 'flex-end' },
  sectionLink: { fontSize: 14, color: GREEN },
  watchRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    paddingBottom: 8,
    paddingLeft: 0,
    paddingRight: 0,
  },
  watchPill: {
    width: WATCH_CARD_W,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: LINE,
  },
  watchPillPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  watchIconOrb: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  watchTitle: { fontSize: 15, color: INK, marginBottom: 8 },
  watchTag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginBottom: 8 },
  watchTagText: { fontSize: 11 },
  watchSub: { fontSize: 12, color: MUTED, lineHeight: 17 },
  emptyHint: { fontSize: 13, color: MUTED, paddingVertical: 8 },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.2)',
    marginBottom: 22,
  },
  alertTitle: { fontSize: 14, color: '#b91c1c', marginBottom: 4 },
  alertSub: { fontSize: 12, color: '#7f1d1d', lineHeight: 17 },
  recentListBlock: {
    marginBottom: 22,
    alignSelf: 'stretch',
    maxWidth: '100%',
  },
  recRowOuter: {
    borderRadius: 18,
  },
  recRowGap: {
    marginBottom: 10,
  },
  recRowPressed: {
    opacity: 0.92,
  },
  recRowCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 18,
    overflow: 'hidden',
    minHeight: 76,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: CARD_FILL,
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
    }),
  },
  recStatusStripe: {
    width: 4,
    zIndex: 1,
  },
  recIconWrap: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: spacing.sm,
    zIndex: 3,
  },
  recMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md + 2,
    paddingRight: spacing.md,
    paddingLeft: spacing.sm,
    gap: spacing.sm,
    minHeight: 76,
    zIndex: 3,
  },
  recBody: {
    flex: 1,
    minWidth: 0,
  },
  recMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  recStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  recStatusPillText: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
  recProductName: {
    fontSize: 15,
    color: INK,
    marginBottom: 5,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  recDate: {
    fontSize: 13,
    color: MUTED,
  },
})
