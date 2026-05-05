import { memo, type ReactNode } from 'react'
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import type { OverviewDashboardModel, DeltaTone, TrendInsightTone } from '../../lib/buildOverviewDashboardModel'
import type { WeekDayStat } from '../../lib/overviewChartData'
import { OverviewWeekAvgSparklineMini, OverviewWeeklyFitTrendChart } from './OverviewCharts'
import { spacing } from '../../constants/theme'

const INK = '#0f172a'
const MUTED = '#64748b'
const LINE = 'rgba(15, 23, 42, 0.055)'
const CARD_RAD = 24
const CARD_PAD = spacing.xl

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

const FitScoreRing = memo(function FitScoreRing({ score, color }: { score: number | null; color: string }) {
  const active = score != null && score > 0
  return (
    <View style={styles.ringShell}>
      <View style={[styles.ringTrack, active ? { borderColor: color } : null]}>
        <Ionicons name="analytics-outline" size={26} color={active ? color : '#94a3b8'} />
      </View>
    </View>
  )
})

function InsightShell({ children }: { children: ReactNode }) {
  return (
    <View style={styles.cardShell}>
      <LinearGradient
        colors={['#ffffff', '#f8fafc']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.accentBar} />
      <View style={styles.cardInner}>{children}</View>
    </View>
  )
}

function ScoreShell({ children }: { children: ReactNode }) {
  return (
    <View style={styles.cardShell}>
      <LinearGradient
        colors={['#ffffff', '#fafefd']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.cardInner}>{children}</View>
    </View>
  )
}

function TrendShell({ children }: { children: ReactNode }) {
  return (
    <View style={styles.cardShell}>
      <LinearGradient
        colors={['#ffffff', '#f7faf9']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.cardInner}>{children}</View>
    </View>
  )
}

export function OverviewDashboardBody({
  model,
  daySeries,
  fonts,
  chartWidth,
  onTopInsightPress,
}: {
  model: OverviewDashboardModel
  daySeries: WeekDayStat[]
  fonts: { sans: string; sansMedium: string; sansSemiBold: string; sansBold: string }
  /** Inner width for SVG charts (card padding already accounted for). */
  chartWidth: number
  onTopInsightPress?: () => void
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
      {hasWeeklyScore ? (
        <Pressable
          onPress={onTopInsightPress}
          disabled={!onTopInsightPress}
          accessibilityRole={onTopInsightPress ? 'button' : undefined}
          accessibilityHint={onTopInsightPress ? 'Opens your watchlist and flagged ingredients' : undefined}
          android_ripple={onTopInsightPress ? { color: 'rgba(15,23,42,0.07)' } : undefined}
          style={({ pressed }) => [
            styles.cardBlock,
            pressed && onTopInsightPress ? styles.cardPressed : null,
          ]}
        >
          <InsightShell>
            <SectionKicker label="Highlight" fonts={fonts} />
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
              {onTopInsightPress ? (
                <View style={styles.chevronWrap}>
                  <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                </View>
              ) : null}
            </View>
          </InsightShell>
        </Pressable>
      ) : null}

      {hasWeeklyScore ? (
        <View style={styles.cardBlock}>
          <ScoreShell>
            <SectionKicker label="This week" fonts={fonts} />

            <View style={styles.scoreHeroRow}>
              <FitScoreRing score={score.score} color={score.ringColor} />
              <View style={styles.scoreNumberCol}>
                <Text style={[styles.scoreBig, { fontFamily: fonts.sansBold, color: score.ringColor }]}>
                  {score.score}
                </Text>
                <Text style={[styles.scoreWord, { fontFamily: fonts.sansSemiBold }]}>{score.scoreWord}</Text>
                <Text style={[styles.scoreMeta, { fontFamily: fonts.sansMedium }]}>
                  Weekly Fillr fit score
                </Text>
              </View>
            </View>

            <Text style={[styles.scoreSupport, { fontFamily: fonts.sans }]}>{score.supportLine}</Text>

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
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.fitDeltaText, { fontFamily: fonts.sansSemiBold, color: scorePill.fg }]}>
                  {score.deltaLabel}
                </Text>
              </View>
            ) : null}

            {hasDailySeries ? <View style={styles.inCardDivider} /> : null}

            {hasDailySeries ? (
              <View style={styles.sparkBlock}>
                <View style={styles.sparkBlockHeader}>
                  <Text style={[styles.sparkBlockTitle, { fontFamily: fonts.sansSemiBold }]}>Daily fit score</Text>
                  <Text style={[styles.sparkBlockHint, { fontFamily: fonts.sans }]}>Mon to Sun</Text>
                </View>
                <Text style={[styles.sparkContext, { fontFamily: fonts.sans }]}>
                  Taller bars mean better daily fit.
                </Text>
                <View style={styles.sparkChartWrap}>
                  <OverviewWeekAvgSparklineMini days={daySeries} height={74} width={chartWidth} />
                </View>
              </View>
            ) : null}
          </ScoreShell>
        </View>
      ) : null}

      {hasTrendSeries ? (
        <View style={styles.cardBlockLast}>
          <TrendShell>
            <SectionKicker label="Six weeks" fonts={fonts} />

            <View style={styles.trendTitleRow}>
              <View style={styles.trendTitleText}>
                <Text style={[styles.trendTitle, { fontFamily: fonts.sansBold }]}>Fillr fit trajectory</Text>
                <Text style={[styles.trendSubtitle, { fontFamily: fonts.sans }]}>
                  One averaged point per calendar week
                </Text>
              </View>
              <View style={styles.trendIconBadge}>
                <Ionicons name="analytics-outline" size={18} color="#15803d" />
              </View>
            </View>

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
                style={{ marginRight: 8, marginTop: 1 }}
              />
              <Text style={[styles.trendInsightText, { fontFamily: fonts.sans, color: ti.fg }]}>
                {model.trendInsight.line}
              </Text>
            </View>

            <View style={styles.trendChartWrap}>
              <OverviewWeeklyFitTrendChart points={model.trend} width={chartWidth} height={182} />
            </View>
          </TrendShell>
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
    ...Platform.select({
      ios: {
        shadowColor: '#0c4a1e',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.07,
        shadowRadius: 22,
      },
      android: { elevation: 3 },
    }),
  },
  cardInner: {
    paddingHorizontal: CARD_PAD,
    paddingTop: CARD_PAD - 4,
    paddingBottom: CARD_PAD - 2,
    position: 'relative',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 20,
    bottom: 20,
    width: 3,
    borderRadius: 2,
    backgroundColor: '#22c55e',
    opacity: 0.85,
  },
  sectionKicker: {
    fontSize: 11,
    color: '#64748b',
    letterSpacing: 1.35,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginLeft: 2,
  },
  insightBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingLeft: 4,
  },
  topInsightOrb: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  topInsightCopy: {
    flex: 1,
    minWidth: 0,
  },
  topInsightHeadline: {
    fontSize: 19,
    lineHeight: 26,
    color: INK,
    letterSpacing: -0.48,
  },
  topInsightEm: {
    color: '#15803d',
    fontWeight: '800',
  },
  topInsightSub: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    color: MUTED,
  },
  chevronWrap: {
    alignSelf: 'center',
    paddingLeft: 2,
    opacity: 0.88,
  },
  scoreHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginBottom: 8,
    paddingLeft: 2,
  },
  ringShell: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  ringTrack: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 6,
    borderColor: '#dbe5ef',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  scoreNumberCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  scoreBig: {
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.25,
  },
  scoreWord: {
    fontSize: 16,
    color: INK,
    marginTop: 2,
    letterSpacing: -0.25,
  },
  scoreMeta: {
    fontSize: 12,
    color: MUTED,
    marginTop: 4,
    letterSpacing: -0.1,
  },
  scoreSupport: {
    fontSize: 13,
    lineHeight: 20,
    color: MUTED,
    marginBottom: 8,
    paddingLeft: 2,
  },
  fitDeltaPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 4,
    marginLeft: 2,
  },
  fitDeltaText: {
    fontSize: 12,
    letterSpacing: -0.06,
  },
  inCardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: LINE,
    marginVertical: 12,
    marginHorizontal: -4,
  },
  sparkBlock: {
    paddingLeft: 2,
  },
  sparkBlockHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingRight: 2,
  },
  sparkBlockTitle: {
    fontSize: 14,
    color: INK,
    letterSpacing: -0.28,
  },
  sparkBlockHint: {
    fontSize: 12,
    color: MUTED,
  },
  sparkContext: {
    fontSize: 11,
    color: '#7b8a9a',
    marginBottom: 8,
    paddingRight: 2,
  },
  sparkChartWrap: {
    alignItems: 'flex-start',
  },
  trendTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
    paddingLeft: 2,
  },
  trendTitleText: {
    flex: 1,
    minWidth: 0,
  },
  trendTitle: {
    fontSize: 16,
    color: INK,
    letterSpacing: -0.42,
  },
  trendSubtitle: {
    fontSize: 12,
    color: MUTED,
    marginTop: 2,
    lineHeight: 17,
  },
  trendIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(34, 197, 94, 0.18)',
  },
  trendInsightBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
    marginLeft: 2,
    marginRight: 2,
  },
  trendInsightText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  trendChartWrap: {
    alignItems: 'center',
  },
})
