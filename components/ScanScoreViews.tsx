import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { theme } from '../constants/theme'

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

type HeroProps = {
  score: number | null
  verdict: string
  isLoading?: boolean
}

/** Primary “your fit” score — compact hero under the product title. */
export function ProfileFitHeroScore({ score, verdict, isLoading }: HeroProps) {
  if (isLoading) {
    return (
      <View style={styles.heroRoot}>
        <ActivityIndicator size="small" color={theme.green700} />
        <Text style={styles.heroLoadingText}>Scoring for your profile…</Text>
      </View>
    )
  }

  if (score == null) return null

  const color = scoreColor(score)

  return (
    <View
      style={styles.heroRoot}
      accessibilityLabel={`Your fit ${score} out of 100. ${verdict}.`}
    >
      <Text style={styles.heroKicker}>Your fit</Text>
      <View style={styles.heroRow}>
        <View style={styles.heroScoreWrap}>
          <Text style={[styles.heroScore, { color: theme.textPrimary }]}>{score}</Text>
          <Text style={styles.heroDenom}>/100</Text>
        </View>
        <View style={[styles.heroVerdictPill, { backgroundColor: verdictPillBg(score) }]}>
          <Text style={[styles.heroVerdict, { color }]}>{verdict}</Text>
        </View>
      </View>
      <Text style={styles.heroHint}>Personal score · macros vs your goal</Text>
    </View>
  )
}

type IngredientProps = {
  score: number
  verdict: string
}

/** Objective ingredient quality — shown near the ingredients list. */
export function IngredientQualityBadge({ score, verdict }: IngredientProps) {
  const color = scoreColor(score)

  return (
    <View style={styles.ingredientBadge} accessibilityLabel={`Ingredient quality ${score} out of 100. ${verdict}.`}>
      <Text style={styles.ingredientLabel}>Ingredient quality</Text>
      <View style={styles.ingredientRow}>
        <Text style={[styles.ingredientScore, { color }]}>{score}</Text>
        <Text style={styles.ingredientDenom}>/100</Text>
        <View style={[styles.ingredientVerdictPill, { backgroundColor: verdictPillBg(score) }]}>
          <Text style={[styles.ingredientVerdict, { color }]}>{verdict}</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  heroRoot: {
    marginBottom: 16,
  },
  heroLoadingText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '500',
    color: theme.textFaint,
  },
  heroKicker: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textFaint,
    marginBottom: 6,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroScoreWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  heroScore: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 30,
  },
  heroDenom: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textFaint,
    marginBottom: 3,
  },
  heroVerdictPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  heroVerdict: {
    fontSize: 13,
    fontWeight: '700',
  },
  heroHint: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '500',
    color: theme.textFaint,
  },
  ingredientBadge: {
    alignItems: 'flex-end',
    gap: 2,
  },
  ingredientLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.textFaint,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ingredientScore: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  ingredientDenom: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textFaint,
    marginRight: 4,
  },
  ingredientVerdictPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  ingredientVerdict: {
    fontSize: 11,
    fontWeight: '700',
  },
})
