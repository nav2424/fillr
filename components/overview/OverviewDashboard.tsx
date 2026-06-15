import { memo, type ReactNode } from 'react'
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import type {
  OverviewDashboardModel,
  DeltaTone,
  TrendInsightTone,
  WeekStatChip,
  WatchListItem,
} from '../../lib/buildOverviewDashboardModel'
import type { WeekDayStat } from '../../lib/overviewChartData'
import { OverviewWeekAvgSparklineMini, OverviewWeeklyFitTrendChart } from './OverviewCharts'
import { spacing } from '../../constants/theme'
import { toTitleCase } from '../../lib/formatProductTitle'

const INK = '#0f172a'
const MUTED = '#64748b'
const LINE = 'rgba(15, 23, 42, 0.06)'
const CARD_RAD = 20
const CARD_PAD = spacing.lg
const SCREEN_BG = '#f2f4f7'

function deltaPillStyle(tone: DeltaTone): { bg: string; fg: string } {
  switch (tone) {
    case 'positive':
      return { bg: 'rgba(34, 197, 94, 0.14)', fg: '#15803d' }
    case 'negative':
      return { bg: 'rgba(239, 68, 68, 0.12)', fg: '#b91c1c' }
    default:
      return { bg: 'rgba(100, 116, 139, 0.1)', fg: '#475569' }
  }
}

function trendInsightColors(tone: TrendInsightTone): { fg: string; bg: string; border: string } {
  switch (tone) {
    case 'positive':
      return { fg: '#166534', bg: 'rgba(220, 252, 231, 0.65)', border: 'rgba(34, 197, 94, 0.22)' }
    case 'negative':
      return { fg: '#991b1b', bg: 'rgba(254, 226, 226, 0.55)', border: 'rgba(248, 113, 113, 0.28)' }
    default:
      return { fg: '#475569', bg: 'rgba(241, 245, 249, 0.9)', border: 'rgba(148, 163, 184, 0.35)' }
  }
}

function statChipColors(tone: WeekStatChip['tone']): { bg: string; border: string; icon: string } {
  switch (tone) {
    case 'good':
      return { bg: '#ecfdf5', border: 'rgba(34, 197, 94, 0.2)', icon: '#15803d' }
    case 'warn':
      return { bg: '#fff7ed', border: 'rgba(249, 115, 22, 0.22)', icon: '#c2410c' }
    default:
      return { bg: '#ffffff', border: LINE, icon: '#475569' }
  }
}

function SectionKicker({
  label,
  fonts,
}: {
  label: string
  fonts: { sansSemiBold: string }
}) {
  return (
    <Text style={[styles.sectionKicker, { fontFamily: fonts.sansSemiBold }]} accessibilityRole="header">
      {label}
    </Text>
  )
}

function CardShell({
  children,
  gradient = ['#ffffff', '#fafbfc'] as [string, string],
}: {
  children: ReactNode
  gradient?: [string, string]
}) {
  return (
    <View style={styles.cardShell}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
      <View style={styles.cardInner}>{children}</View>
    </View>
  )
}

const FitScoreRing = memo(function FitScoreRing({ score, color }: { score: number | null; color: string }) {
  const active = score != null && score > 0
  return (
    <View style={styles.ringShell}>
      <View style={[styles.ringTrack, active ? { borderColor: color } : null]}>
        <Text style={[styles.ringScoreMini, { color: active ? color : '#94a3b8' }]}>
          {active ? score : '—'}
        </Text>
      </View>
    </View>
  )
})

function MixBar({
  mix,
}: {
  mix: NonNullable<OverviewDashboardModel['ingredientMix']>
}) {
  const segments = [
    { key: 'natural', count: mix.natural, color: '#22c55e' },
    { key: 'processed', count: mix.processed, color: '#eab308' },
    { key: 'additive', count: mix.additive, color: '#f97316' },
    { key: 'flagged', count: mix.flagged, color: '#ef4444' },
  ].filter((s) => s.count > 0)

  return (
    <View style={styles.mixWrap}>
      <View style={styles.mixBarTrack}>
        {segments.map((seg) => (
          <View
            key={seg.key}
            style={[styles.mixBarSegment, { flex: seg.count, backgroundColor: seg.color }]}
          />
        ))}
      </View>
      <View style={styles.mixLegend}>
        {segments.map((seg) => (
          <View key={seg.key} style={styles.mixLegendItem}>
            <View style={[styles.mixDot, { backgroundColor: seg.color }]} />
            <Text style={styles.mixLegendText}>
              {seg.count} {seg.key === 'natural' ? 'natural' : seg.key}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function WatchListRow({ item, fonts }: { item: WatchListItem; fonts: { sans: string; sansSemiBold: string; sansBold: string } }) {
  const tone = item.rating === 'avoid' ? '#ef4444' : '#f97316'
  return (
    <View style={styles.watchRow}>
      <View style={[styles.watchRank, { backgroundColor: `${tone}14` }]}>
        <Text style={[styles.watchRankText, { color: tone, fontFamily: fonts.sansBold }]}>{item.count}×</Text>
      </View>
      <View style={styles.watchCopy}>
        <Text style={[styles.watchName, { fontFamily: fonts.sansSemiBold }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.watchSub, { fontFamily: fonts.sans }]} numberOfLines={2}>
          {item.subtitle}
        </Text>
      </View>
    </View>
  )
}

export function OverviewDashboardBody({
  model,
  daySeries,
  fonts,
  chartWidth,
  onTopInsightPress,
  onRecentScanPress,
  onWatchListPress,
}: {
  model: OverviewDashboardModel
  daySeries: WeekDayStat[]
  fonts: { sans: string; sansMedium: string; sansSemiBold: string; sansBold: string }
  chartWidth: number
  onTopInsightPress?: () => void
  onRecentScanPress?: (productId: string) => void
  onWatchListPress?: () => void
}) {
  const insight = model.topInsight
  const score = model.scoreHero
  const scorePill = score.deltaLabel ? deltaPillStyle(score.deltaTone) : null
  const ti = trendInsightColors(model.trendInsight.tone)
  const hasWeeklyScore = score.score != null && score.score > 0
  const hasDailySeries = daySeries.some((d) => d.avgFit != null && d.avgFit > 0)
  const hasTrendSeries = model.trend.filter((p) => p.avgFit != null && p.avgFit > 0).length >= 2

  return (
    <View style={styles.page}>
      <View style={styles.weekHero}>
        <Text style={[styles.weekHeroTitle, { fontFamily: fonts.sansBold }]}>Your week</Text>
        <Text style={[styles.weekHeroSub, { fontFamily: fonts.sans }]}>{model.weekHeadline}</Text>
      </View>

      {model.weekStats.length > 0 ? (
        <View style={styles.statGrid}>
          {model.weekStats.map((chip) => {
            const colors = statChipColors(chip.tone)
            return (
              <View key={chip.label} style={[styles.statChip, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                <Ionicons name={chip.icon as keyof typeof Ionicons.glyphMap} size={15} color={colors.icon} />
                <Text style={[styles.statValue, { fontFamily: fonts.sansBold }]}>{chip.value}</Text>
                <Text style={[styles.statLabel, { fontFamily: fonts.sansMedium }]}>{chip.label}</Text>
                {chip.hint ? (
                  <Text style={[styles.statHint, { fontFamily: fonts.sans }]} numberOfLines={1}>
                    {chip.hint}
                  </Text>
                ) : null}
              </View>
            )
          })}
        </View>
      ) : null}

      {model.hasScansThisWeek ? (
        <Pressable
          onPress={onTopInsightPress}
          disabled={!onTopInsightPress}
          style={({ pressed }) => [styles.cardBlock, pressed && onTopInsightPress ? styles.cardPressed : null]}
        >
          <CardShell gradient={['#ffffff', '#f0fdf4']}>
            <SectionKicker label="Insight" fonts={fonts} />
            <View style={styles.insightBody}>
              <View style={[styles.topInsightOrb, { backgroundColor: insight.iconBg }]}>
                <Ionicons name={insight.icon as keyof typeof Ionicons.glyphMap} size={22} color={insight.iconColor} />
              </View>
              <View style={styles.topInsightCopy}>
                <Text style={[styles.topInsightHeadline, { fontFamily: fonts.sansBold }]}>
                  {insight.headlineBefore}
                  <Text style={styles.topInsightEm}>{insight.headlineHighlight}</Text>
                  {insight.headlineAfter}
                </Text>
                <Text style={[styles.topInsightSub, { fontFamily: fonts.sans }]}>{insight.subline}</Text>
              </View>
              {onTopInsightPress ? <Ionicons name="chevron-forward" size={18} color="#94a3b8" /> : null}
            </View>
          </CardShell>
        </Pressable>
      ) : null}

      {hasWeeklyScore ? (
        <View style={styles.cardBlock}>
          <CardShell>
            <SectionKicker label="Weekly fit" fonts={fonts} />
            <View style={styles.scoreHeroRow}>
              <FitScoreRing score={score.score} color={score.ringColor} />
              <View style={styles.scoreNumberCol}>
                <Text style={[styles.scoreWord, { fontFamily: fonts.sansBold }]}>{score.scoreWord}</Text>
                <Text style={[styles.scoreMeta, { fontFamily: fonts.sansMedium }]}>Average Fillr fit this week</Text>
                <Text style={[styles.scoreSupport, { fontFamily: fonts.sans }]}>{score.supportLine}</Text>
              </View>
            </View>
            {score.deltaLabel && scorePill ? (
              <View style={[styles.fitDeltaPill, { backgroundColor: scorePill.bg }]}>
                <Ionicons
                  name={
                    score.deltaTone === 'positive'
                      ? 'trending-up'
                      : score.deltaTone === 'negative'
                        ? 'trending-down'
                        : 'remove-outline'
                  }
                  size={14}
                  color={scorePill.fg}
                />
                <Text style={[styles.fitDeltaText, { fontFamily: fonts.sansSemiBold, color: scorePill.fg }]}>
                  {score.deltaLabel}
                </Text>
              </View>
            ) : null}
            {hasDailySeries ? (
              <>
                <View style={styles.inCardDivider} />
                <View style={styles.sparkBlock}>
                  <View style={styles.sparkBlockHeader}>
                    <Text style={[styles.sparkBlockTitle, { fontFamily: fonts.sansSemiBold }]}>Daily rhythm</Text>
                    <Text style={[styles.sparkBlockHint, { fontFamily: fonts.sans }]}>Mon – Sun</Text>
                  </View>
                  <OverviewWeekAvgSparklineMini days={daySeries} height={74} width={chartWidth} />
                </View>
              </>
            ) : null}
          </CardShell>
        </View>
      ) : null}

      {model.ingredientMix ? (
        <View style={styles.cardBlock}>
          <CardShell>
            <SectionKicker label="Ingredient mix" fonts={fonts} />
            <Text style={[styles.mixInsight, { fontFamily: fonts.sans }]}>{model.ingredientMix.insight}</Text>
            <MixBar mix={model.ingredientMix} />
          </CardShell>
        </View>
      ) : null}

      {model.watchList.length > 0 ? (
        <Pressable
          onPress={onWatchListPress}
          disabled={!onWatchListPress}
          style={({ pressed }) => [styles.cardBlock, pressed && onWatchListPress ? styles.cardPressed : null]}
        >
          <CardShell gradient={['#ffffff', '#fff7ed']}>
            <View style={styles.sectionHeaderRow}>
              <SectionKicker label="Watch list" fonts={fonts} />
              {onWatchListPress ? <Text style={[styles.sectionLink, { fontFamily: fonts.sansSemiBold }]}>See all</Text> : null}
            </View>
            <Text style={[styles.sectionIntro, { fontFamily: fonts.sans }]}>
              Ingredients that showed up on multiple scans this week.
            </Text>
            <View style={styles.watchList}>
              {model.watchList.map((item) => (
                <WatchListRow key={item.name} item={item} fonts={fonts} />
              ))}
            </View>
          </CardShell>
        </Pressable>
      ) : null}

      {model.recentScans.length > 0 ? (
        <View style={styles.cardBlock}>
          <CardShell>
            <SectionKicker label="Recent scans" fonts={fonts} />
            <View style={styles.recentList}>
              {model.recentScans.map((scan) => (
                <Pressable
                  key={scan.productId}
                  onPress={() => onRecentScanPress?.(scan.productId)}
                  disabled={!onRecentScanPress}
                  style={({ pressed }) => [styles.recentRow, pressed && onRecentScanPress ? { opacity: 0.88 } : null]}
                >
                  <View style={styles.recentText}>
                    <Text style={[styles.recentName, { fontFamily: fonts.sansSemiBold }]} numberOfLines={1}>
                      {toTitleCase(scan.name)}
                    </Text>
                    {scan.brand ? (
                      <Text style={[styles.recentBrand, { fontFamily: fonts.sans }]} numberOfLines={1}>
                        {toTitleCase(scan.brand)}
                      </Text>
                    ) : null}
                  </View>
                  {scan.score != null && scan.score > 0 ? (
                    <View style={styles.recentScorePill}>
                      <Text style={[styles.recentScoreText, { fontFamily: fonts.sansBold }]}>{scan.score}</Text>
                    </View>
                  ) : null}
                  {onRecentScanPress ? <Ionicons name="chevron-forward" size={16} color="#cbd5e1" /> : null}
                </Pressable>
              ))}
            </View>
          </CardShell>
        </View>
      ) : null}

      {hasTrendSeries ? (
        <View style={styles.cardBlockLast}>
          <CardShell gradient={['#ffffff', '#f8fafc']}>
            <SectionKicker label="Six-week trend" fonts={fonts} />
            <View style={[styles.trendInsightBox, { backgroundColor: ti.bg, borderColor: ti.border }]}>
              <Ionicons
                name={
                  model.trendInsight.tone === 'positive'
                    ? 'arrow-up-circle'
                    : model.trendInsight.tone === 'negative'
                      ? 'arrow-down-circle'
                      : 'ellipse-outline'
                }
                size={16}
                color={ti.fg}
              />
              <Text style={[styles.trendInsightText, { fontFamily: fonts.sans, color: ti.fg }]}>
                {model.trendInsight.line}
              </Text>
            </View>
            <OverviewWeeklyFitTrendChart points={model.trend} width={chartWidth} height={172} />
          </CardShell>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: 'transparent',
    paddingBottom: spacing.xs,
  },
  weekHero: {
    marginBottom: spacing.md,
    paddingHorizontal: 2,
  },
  weekHeroTitle: {
    fontSize: 28,
    color: INK,
    letterSpacing: -0.8,
  },
  weekHeroSub: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: MUTED,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.sm,
  },
  statChip: {
    width: '48%',
    flexGrow: 1,
    minWidth: '46%',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 2,
  },
  statValue: {
    marginTop: 6,
    fontSize: 22,
    color: INK,
    letterSpacing: -0.6,
  },
  statLabel: {
    fontSize: 12,
    color: MUTED,
  },
  statHint: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  cardBlock: {
    marginBottom: spacing.sm,
  },
  cardBlockLast: {
    marginBottom: spacing.lg,
  },
  cardPressed: {
    opacity: 0.97,
  },
  cardShell: {
    borderRadius: CARD_RAD,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    backgroundColor: '#fff',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 16,
      },
      android: { elevation: 2 },
    }),
  },
  cardInner: {
    paddingHorizontal: CARD_PAD,
    paddingTop: CARD_PAD - 2,
    paddingBottom: CARD_PAD,
  },
  sectionKicker: {
    fontSize: 11,
    color: MUTED,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionLink: {
    fontSize: 13,
    color: '#15803d',
    marginBottom: 10,
  },
  sectionIntro: {
    fontSize: 13,
    lineHeight: 19,
    color: MUTED,
    marginBottom: 12,
    marginTop: -4,
  },
  insightBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topInsightOrb: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topInsightCopy: {
    flex: 1,
    minWidth: 0,
  },
  topInsightHeadline: {
    fontSize: 17,
    lineHeight: 24,
    color: INK,
    letterSpacing: -0.35,
  },
  topInsightEm: {
    color: '#15803d',
  },
  topInsightSub: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 19,
    color: MUTED,
  },
  scoreHeroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 10,
  },
  ringShell: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SCREEN_BG,
  },
  ringTrack: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 5,
    borderColor: '#dbe5ef',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  ringScoreMini: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  scoreNumberCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  scoreWord: {
    fontSize: 22,
    color: INK,
    letterSpacing: -0.4,
  },
  scoreMeta: {
    fontSize: 12,
    color: MUTED,
  },
  scoreSupport: {
    fontSize: 13,
    lineHeight: 19,
    color: MUTED,
  },
  fitDeltaPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 4,
  },
  fitDeltaText: {
    fontSize: 12,
  },
  inCardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: LINE,
    marginVertical: 14,
  },
  sparkBlock: {
    gap: 8,
  },
  sparkBlockHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sparkBlockTitle: {
    fontSize: 14,
    color: INK,
  },
  sparkBlockHint: {
    fontSize: 12,
    color: MUTED,
  },
  mixInsight: {
    fontSize: 13,
    lineHeight: 19,
    color: MUTED,
    marginBottom: 12,
  },
  mixWrap: {
    gap: 10,
  },
  mixBarTrack: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: SCREEN_BG,
  },
  mixBarSegment: {
    minWidth: 4,
  },
  mixLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  mixLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  mixDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  mixLegendText: {
    fontSize: 11,
    fontWeight: '600',
    color: MUTED,
    textTransform: 'capitalize',
  },
  watchList: {
    gap: 12,
  },
  watchRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  watchRank: {
    minWidth: 42,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'center',
  },
  watchRankText: {
    fontSize: 13,
  },
  watchCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  watchName: {
    fontSize: 15,
    color: INK,
    letterSpacing: -0.2,
  },
  watchSub: {
    fontSize: 12,
    lineHeight: 17,
    color: MUTED,
  },
  recentList: {
    gap: 2,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  recentText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  recentName: {
    fontSize: 15,
    color: INK,
    letterSpacing: -0.15,
  },
  recentBrand: {
    fontSize: 12,
    color: MUTED,
  },
  recentScorePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#ecfdf5',
  },
  recentScoreText: {
    fontSize: 13,
    color: '#15803d',
  },
  trendInsightBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  trendInsightText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
})
