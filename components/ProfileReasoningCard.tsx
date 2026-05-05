import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { ProfileReasoningModel, ProfileReasonSeverity } from '../lib/buildProfileReasoning'
import type { ScoreContributor } from '../lib/buildScoreExplainability'
import { theme } from '../constants/theme'

export type ProfileReasoningCardProps = {
  model: ProfileReasoningModel
  contributors?: ScoreContributor[]
}

function severityColor(sev: ProfileReasonSeverity): string {
  if (sev === 'high') return theme.flagged.text
  if (sev === 'medium') return theme.processed.text
  return theme.textMuted
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

export function ProfileReasoningCard({
  model,
  contributors = [],
}: ProfileReasoningCardProps) {
  const hasContributors = contributors.length > 0
  const hasCap = contributors.some((c) => c.capMaxScore != null)
  const hasNegPenalty = contributors.some((c) => c.delta < 0)
  const hasPosBonus = contributors.some((c) => c.delta > 0)
  /** Caps apply after the quality blend; linear penalties are not stacked on top of a ceiling. */
  const showCapBlendExplainer = hasCap && hasNegPenalty
  const primaryCapMax = contributors.find((c) => c.capMaxScore != null)?.capMaxScore
  const panelTone: 'negative' | 'positive' | 'mixed' = hasPosBonus && !hasNegPenalty && !hasCap
    ? 'positive'
    : !hasPosBonus && (hasNegPenalty || hasCap)
      ? 'negative'
      : 'mixed'

  const panelStyles =
    panelTone === 'negative'
      ? {
          card: styles.quickExplainCardNegative,
          kicker: styles.quickKickerNegative,
          bar: styles.driverFillNegative,
        }
      : panelTone === 'positive'
        ? {
            card: styles.quickExplainCardPositive,
            kicker: styles.quickKickerPositive,
            bar: styles.driverFillPositive,
          }
        : {
            card: styles.quickExplainCardMixed,
            kicker: styles.quickKickerMixed,
            bar: styles.driverFillMixed,
          }

  const filteredReasons = model.reasons
    .filter((r) => {
      if (contributors.length > 0 && r.type === 'processing_concern') return false
      return true
    })
    .slice(0, 3)
  const showSummary = shouldShowSummary(model.summary, filteredReasons[0]?.body)

  return (
    <View style={styles.root} accessibilityRole="summary">
      <Text style={styles.headline}>{model.headline}</Text>
      {showSummary ? <Text style={styles.summary}>{model.summary}</Text> : null}
      {contributors.length > 0 ? (
        <View style={[styles.quickExplainCard, panelStyles.card]}>
          <View style={styles.quickBlock}>
            <Text style={[styles.quickKicker, panelStyles.kicker]}>Top score drivers</Text>
            <View style={styles.driverList}>
              {contributors.slice(0, 2).map((c) => {
                const isCap = c.capMaxScore != null
                const widthPct = (
                  isCap
                    ? '100%'
                    : `${Math.max(28, Math.min(100, Math.abs(c.delta) * 2))}%`
                ) as `${number}%`
                const rightLabel = isCap ? `Max ${c.capMaxScore}` : String(c.delta)
                return (
                  <View key={`${c.label}-${c.capMaxScore ?? ''}-${c.delta}`} style={styles.driverRow}>
                    <View style={styles.driverRowTop}>
                      <Text style={styles.driverLabel}>{c.label}</Text>
                      <Text style={[styles.driverDelta, isCap ? styles.driverDeltaCap : null]}>
                        {rightLabel}
                      </Text>
                    </View>
                    <View style={styles.driverTrack}>
                      <View style={[styles.driverFill, panelStyles.bar, { width: widthPct }]} />
                    </View>
                  </View>
                )
              })}
            </View>
            {showCapBlendExplainer && primaryCapMax != null ? (
              <Text style={styles.driverBlendNote}>
                Penalties like additive load are baked into your quality score before limits apply. Max{' '}
                {primaryCapMax} caps the headline score; it is not an extra subtraction stacked after those
                penalties.
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
      {filteredReasons.length > 0 ? <View style={styles.divider} /> : null}
      <View style={styles.rows}>
        {filteredReasons.map((r, i) => (
          <View
            key={`${r.type}-${r.title}-${i}`}
            style={[styles.row, i > 0 ? styles.rowSpacing : null]}
            accessibilityLabel={`${r.title}. ${r.body}`}
          >
            <View style={[styles.iconOrb, { borderColor: `${severityColor(r.severity)}33` }]}>
              <Ionicons
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                name={r.icon as any}
                size={18}
                color={severityColor(r.severity)}
              />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{r.title}</Text>
              <Text style={styles.rowBody}>{r.body}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    marginTop: 4,
  },
  headline: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.textPrimary,
    letterSpacing: -0.35,
    lineHeight: 23,
    marginBottom: 8,
  },
  summary: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.textSecondary,
    lineHeight: 21,
    letterSpacing: -0.1,
    marginBottom: 16,
  },
  quickExplainCard: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.22)',
    backgroundColor: '#fcfdfd',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 12,
    gap: 10,
  },
  quickExplainCardNegative: {
    borderColor: 'rgba(239, 68, 68, 0.2)',
    backgroundColor: '#fff8f8',
  },
  quickExplainCardPositive: {
    borderColor: 'rgba(22, 163, 74, 0.16)',
    backgroundColor: '#fbfefc',
  },
  quickExplainCardMixed: {
    borderColor: 'rgba(217, 119, 6, 0.18)',
    backgroundColor: '#fffcf7',
  },
  quickBlock: {
    gap: 5,
  },
  quickKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
    color: theme.textSecondary,
    textTransform: 'uppercase',
  },
  quickKickerNegative: {
    color: theme.flagged.text,
  },
  quickKickerPositive: {
    color: theme.green800,
  },
  quickKickerMixed: {
    color: theme.processed.text,
  },
  driverList: {
    gap: 8,
    marginTop: 2,
  },
  driverBlendNote: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
    letterSpacing: -0.05,
    color: theme.textMuted,
  },
  driverRow: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    paddingVertical: 7,
    paddingHorizontal: 9,
    gap: 5,
  },
  driverRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  driverLabel: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '700',
    color: theme.textPrimary,
    textTransform: 'capitalize',
  },
  driverDelta: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.flagged.text,
  },
  driverDeltaCap: {
    color: theme.processed.text,
  },
  driverTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
  },
  driverFill: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#94a3b8',
  },
  driverFillNegative: {
    backgroundColor: '#f87171',
  },
  driverFillPositive: {
    backgroundColor: '#22c55e',
  },
  driverFillMixed: {
    backgroundColor: '#f59e0b',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
    marginBottom: 14,
  },
  rows: {
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  rowSpacing: {
    marginTop: 13,
    paddingTop: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15, 23, 42, 0.06)',
  },
  iconOrb: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.textPrimary,
    letterSpacing: -0.15,
    marginBottom: 4,
  },
  rowBody: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.textMuted,
    lineHeight: 19,
    letterSpacing: -0.05,
  },
})
