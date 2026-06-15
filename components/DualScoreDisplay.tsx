import { View, Text, StyleSheet } from 'react-native'
import type { NutritionLensScores } from '../lib/buildNutritionViewModel'
import { ScanResultCard } from './ScanResultCard'
import { theme } from '../constants/theme'

type Props = {
  lensScores: NutritionLensScores
  showNutritionLens: boolean
}

function scoreColor(score: number): string {
  if (score >= 75) return theme.green700
  if (score >= 55) return '#b45309'
  if (score >= 35) return theme.additive.text
  return theme.flagged.text
}

function verdictPillBg(score: number): string {
  if (score >= 75) return theme.green50
  if (score >= 55) return '#fffbeb'
  if (score >= 35) return '#fff7ed'
  return theme.flagged.bg
}

function LensColumn({
  label,
  score,
  verdict,
  muted,
  showDivider,
}: {
  label: string
  score: number
  verdict: string
  muted?: boolean
  showDivider?: boolean
}) {
  const color = muted ? theme.textFaint : scoreColor(score)

  return (
    <>
      {showDivider ? <View style={styles.divider} /> : null}
      <View style={styles.lensCol}>
        <Text style={styles.lensLabel}>{label}</Text>
        <View style={styles.lensScoreRow}>
          <Text style={[styles.lensScore, { color: muted ? theme.textFaint : theme.textPrimary }]}>
            {muted ? '—' : score}
          </Text>
          {!muted ? <Text style={styles.lensDenom}>/100</Text> : null}
        </View>
        <View style={[styles.verdictPill, { backgroundColor: muted ? '#f4f6f8' : verdictPillBg(score) }]}>
          <Text style={[styles.verdictText, { color: muted ? theme.textMuted : color }]} numberOfLines={1}>
            {muted ? 'No data' : verdict}
          </Text>
        </View>
      </View>
    </>
  )
}

export function DualScoreDisplay({ lensScores, showNutritionLens }: Props) {
  const nutritionMuted = !showNutritionLens || lensScores.nutritionFit <= 0

  return (
    <ScanResultCard flush bodyStyle={styles.cardBody}>
      <View style={styles.row}>
        <LensColumn
          label="Ingredients"
          score={lensScores.ingredientQuality}
          verdict={lensScores.ingredientLabel}
        />
        <LensColumn
          label="Your fit"
          score={lensScores.nutritionFit}
          verdict={lensScores.nutritionLabel}
          muted={nutritionMuted}
          showDivider
        />
      </View>
    </ScanResultCard>
  )
}

const styles = StyleSheet.create({
  cardBody: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  lensCol: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
    marginVertical: 4,
  },
  lensLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textFaint,
    letterSpacing: -0.1,
  },
  lensScoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    marginTop: 6,
  },
  lensScore: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1.5,
    lineHeight: 38,
  },
  lensDenom: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textFaint,
    marginBottom: 6,
  },
  verdictPill: {
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  verdictText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
})
