import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { ProfileReasoningModel, ProfileReasonSeverity } from '../lib/buildProfileReasoning'
import type { ScoreContributor } from '../lib/buildScoreExplainability'
import type { FillrScoringDataSnapshot } from '../types'
import { theme } from '../constants/theme'

export type ProfileReasoningCardProps = {
  model: ProfileReasoningModel
  contributors?: ScoreContributor[]
  score?: number
  scoringData?: FillrScoringDataSnapshot
  /** Parent already shows the score badge (e.g. For You header). */
  hideScoreBadge?: boolean
}

type DriverPill = {
  sign: '+' | '−' | '!'
  label: string
  tone: 'good' | 'warn' | 'bad'
}

function severityColor(sev: ProfileReasonSeverity): string {
  if (sev === 'high') return theme.flagged.text
  if (sev === 'medium') return theme.processed.text
  return theme.textMuted
}

function severityBg(sev: ProfileReasonSeverity): string {
  if (sev === 'high') return theme.flagged.bg
  if (sev === 'medium') return theme.processed.bg
  return '#f8fafc'
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function shouldShowSummary(summary: string, firstReasonBody: string | undefined): boolean {
  if (!summary.trim()) return false
  if (!firstReasonBody?.trim()) return true
  const a = norm(summary)
  const b = norm(firstReasonBody)
  if (!a || !b) return true
  return !(a.includes(b) || b.includes(a))
}

function titleCaseDriver(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function scoreAccent(score: number): { bg: string; text: string; ring: string } {
  if (score >= 75) return { bg: theme.green50, text: theme.green800, ring: theme.greenBorder }
  if (score >= 55) return { bg: '#fffbeb', text: '#b45309', ring: '#fde68a' }
  if (score >= 35) return { bg: '#fff7ed', text: '#c2410c', ring: '#fed7aa' }
  return { bg: theme.flagged.bg, text: theme.flagged.text, ring: '#fecaca' }
}

function fitLabel(model: ProfileReasoningModel): string {
  if (model.fit === 'good') return 'Good match'
  if (model.fit === 'poor') return 'Needs caution'
  return 'Mixed fit'
}

function driverFromContributor(c: ScoreContributor): DriverPill {
  if (c.capMaxScore != null) {
    return { sign: '!', label: `${titleCaseDriver(c.label)} cap`, tone: 'bad' }
  }
  return {
    sign: c.delta >= 0 ? '+' : '−',
    label: titleCaseDriver(c.label),
    tone: c.delta >= 0 ? 'good' : Math.abs(c.delta) >= 18 ? 'bad' : 'warn',
  }
}

function positiveDrivers(scoringData?: FillrScoringDataSnapshot): DriverPill[] {
  if (!scoringData) return []
  const counts = scoringData.ingredientCounts
  const total = Math.max(1, scoringData.totalIngredients ?? 0)
  const rows: DriverPill[] = []
  if ((counts?.natural ?? 0) >= Math.max(2, total * 0.45)) {
    rows.push({ sign: '+', label: 'Whole-food base', tone: 'good' })
  }
  if (scoringData.productCategory === 'whole_food' || scoringData.productCategory === 'clean_snack') {
    rows.push({ sign: '+', label: 'Simple formula', tone: 'good' })
  }
  if ((counts?.additive ?? 0) === 0 && (counts?.flagged ?? 0) === 0 && total > 0) {
    rows.push({ sign: '+', label: 'Low additive load', tone: 'good' })
  }
  return rows
}

function buildDriverPills(contributors: ScoreContributor[], scoringData?: FillrScoringDataSnapshot): DriverPill[] {
  const rows = [...positiveDrivers(scoringData), ...contributors.map(driverFromContributor)]
  const seen = new Set<string>()
  return rows
    .filter((row) => {
      const key = row.label.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 4)
}

function pillStyles(tone: DriverPill['tone']) {
  if (tone === 'good') {
    return { wrap: styles.pillGood, sign: styles.pillGoodSign, text: styles.pillGoodText }
  }
  if (tone === 'bad') {
    return { wrap: styles.pillBad, sign: styles.pillBadSign, text: styles.pillBadText }
  }
  return { wrap: styles.pillWarn, sign: styles.pillWarnSign, text: styles.pillWarnText }
}

export function ProfileReasoningCard({
  model,
  contributors = [],
  score,
  scoringData,
  hideScoreBadge,
}: ProfileReasoningCardProps) {
  const filteredReasons = model.reasons
    .filter((r) => {
      if (contributors.length > 0 && r.type === 'processing_concern') return false
      return true
    })
    .slice(0, 3)
  const showSummary = shouldShowSummary(model.summary, filteredReasons[0]?.body)
  const driverPills = buildDriverPills(contributors, scoringData)
  const scoreTheme = typeof score === 'number' && !hideScoreBadge ? scoreAccent(score) : null

  const showHero = !hideScoreBadge

  return (
    <View style={styles.root} accessibilityRole="summary">
      {showHero ? (
        <View style={styles.heroRow}>
          {scoreTheme != null ? (
            <View style={[styles.scoreBadge, { backgroundColor: scoreTheme.bg, borderColor: scoreTheme.ring }]}>
              <Text style={[styles.scoreValue, { color: scoreTheme.text }]}>{score}</Text>
              <Text style={[styles.scoreDenom, { color: scoreTheme.text }]}>/100</Text>
            </View>
          ) : null}
          <View style={styles.heroText}>
            <Text style={styles.fitTitle}>{fitLabel(model)}</Text>
            {showSummary ? (
              <Text style={styles.summary}>{model.summary}</Text>
            ) : (
              <Text style={styles.summary}>{model.headline}</Text>
            )}
          </View>
        </View>
      ) : null}

      {driverPills.length > 0 ? (
        <View style={[styles.driversBlock, hideScoreBadge && styles.driversBlockFlush]}>
          <Text style={styles.driversLabel}>What shaped the score</Text>
          <View style={styles.pillRow}>
            {driverPills.map((pill) => {
              const ps = pillStyles(pill.tone)
              return (
                <View key={`${pill.sign}-${pill.label}`} style={[styles.pill, ps.wrap]}>
                  <Text style={[styles.pillSign, ps.sign]}>{pill.sign}</Text>
                  <Text style={[styles.pillText, ps.text]} numberOfLines={1}>
                    {pill.label}
                  </Text>
                </View>
              )
            })}
          </View>
        </View>
      ) : null}

      {filteredReasons.length > 0 ? (
        <View style={styles.reasonsBlock}>
          {filteredReasons.map((r, i) => (
            <View
              key={`${r.type}-${r.title}-${i}`}
              style={[styles.reasonRow, i > 0 ? styles.reasonRowSpacing : null]}
              accessibilityLabel={`${r.title}. ${r.body}`}
            >
              <View style={[styles.iconOrb, { backgroundColor: severityBg(r.severity) }]}>
                <Ionicons
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  name={r.icon as any}
                  size={17}
                  color={severityColor(r.severity)}
                />
              </View>
              <View style={styles.reasonText}>
                <Text style={styles.reasonTitle}>{r.title}</Text>
                <Text style={styles.reasonBody}>{r.body}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    gap: 16,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  scoreBadge: {
    width: 58,
    height: 58,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scoreValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 24,
  },
  scoreDenom: {
    fontSize: 10,
    fontWeight: '700',
    opacity: 0.72,
    marginTop: -2,
  },
  heroText: {
    flex: 1,
    minWidth: 0,
    paddingTop: 2,
  },
  fitTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.textPrimary,
    letterSpacing: -0.35,
    marginBottom: 5,
  },
  summary: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.textMuted,
    lineHeight: 21,
    letterSpacing: -0.1,
  },
  driversBlock: {
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15, 23, 42, 0.07)',
    paddingTop: 14,
  },
  driversBlockFlush: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  driversLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: theme.textFaint,
    textTransform: 'uppercase',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f4f6f8',
    maxWidth: '100%',
  },
  pillSign: {
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 16,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    flexShrink: 1,
  },
  pillGood: {
    backgroundColor: '#f0fdf4',
  },
  pillGoodSign: { color: '#15803d' },
  pillGoodText: { color: '#166534' },
  pillWarn: {
    backgroundColor: '#fffbeb',
  },
  pillWarnSign: { color: '#b45309' },
  pillWarnText: { color: '#92400e' },
  pillBad: {
    backgroundColor: '#fef2f2',
  },
  pillBadSign: { color: '#dc2626' },
  pillBadText: { color: '#991b1b' },
  reasonsBlock: {
    gap: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15, 23, 42, 0.07)',
    paddingTop: 14,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  reasonRowSpacing: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15, 23, 42, 0.05)',
  },
  iconOrb: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  reasonText: {
    flex: 1,
    minWidth: 0,
    paddingTop: 1,
  },
  reasonTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.textPrimary,
    letterSpacing: -0.15,
    marginBottom: 3,
  },
  reasonBody: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.textMuted,
    lineHeight: 19,
    letterSpacing: -0.05,
  },
})
