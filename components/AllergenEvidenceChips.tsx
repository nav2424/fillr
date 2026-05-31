import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { MatchedAllergen } from '../types'
import { theme } from '../constants/theme'

const SECTION_LABELS: Record<string, string> = {
  ingredients: 'Ingredients',
  contains: 'Contains',
  may_contain: 'May contain',
  open_food_facts: 'OFF record',
}

type Props = {
  matches: MatchedAllergen[]
  /** Hides intro copy — for expandable detail panels. */
  compact?: boolean
}

export function AllergenEvidenceChips({ matches, compact = false }: Props) {
  if (!matches.length) return null

  return (
    <View
      style={[styles.shell, compact && styles.shellCompact]}
      accessibilityRole="summary"
      accessibilityLabel="Allergen evidence"
    >
      {!compact ? (
        <>
          <View style={styles.headerRow}>
            <Ionicons name="shield-checkmark-outline" size={18} color={theme.flagged.text} />
            <Text style={styles.title}>Why we flagged this</Text>
          </View>
          <Text style={styles.subtitle}>
            Every allergy alert cites the exact line or database signal Fillr matched — not a black-box guess.
          </Text>
        </>
      ) : null}
      {matches.map((m, i) => {
        const isMayContain = m.severity === 'MAY_CONTAIN'
        const sectionKey = m.evidenceSection ?? 'ingredients'
        const sectionLabel = SECTION_LABELS[sectionKey] ?? 'Label'
        const evidence = (m.evidenceText ?? m.matchedIngredient).trim()
        return (
          <View
            key={`${m.allergenKey}-${i}`}
            style={[styles.row, i === matches.length - 1 && styles.rowLast]}
          >
            <View style={styles.rowTop}>
              <Text style={styles.allergenName}>{m.allergenName}</Text>
              <View style={[styles.severityPill, isMayContain && styles.severityPillCaution]}>
                <Text style={[styles.severityText, isMayContain && styles.severityTextCaution]}>
                  {isMayContain ? 'May contain' : 'Contains'}
                </Text>
              </View>
            </View>
            <Text style={styles.matchQuote} numberOfLines={3}>
              Matched: “{evidence}”
            </Text>
            <View style={styles.chipRow}>
              <View style={styles.chip}>
                <Text style={styles.chipText}>{sectionLabel}</Text>
              </View>
              {m.matchedIngredient !== evidence ? (
                <View style={styles.chipMuted}>
                  <Text style={styles.chipTextMuted}>Shown as {m.matchedIngredient}</Text>
                </View>
              ) : null}
            </View>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  shellCompact: {
    marginTop: 0,
    padding: 12,
    borderRadius: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.flagged.text,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: '#7f1d1d',
    marginBottom: 12,
  },
  row: {
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#fecaca',
    gap: 6,
  },
  rowLast: {
    paddingBottom: 0,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  allergenName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#991b1b',
    flex: 1,
  },
  severityPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
  },
  severityPillCaution: {
    backgroundColor: '#fef3c7',
  },
  severityText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b91c1c',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  severityTextCaution: {
    color: '#92400e',
  },
  matchQuote: {
    fontSize: 13,
    lineHeight: 18,
    color: '#450a0a',
    fontStyle: 'italic',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#991b1b',
  },
  chipMuted: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  chipTextMuted: {
    fontSize: 11,
    fontWeight: '500',
    color: '#7f1d1d',
  },
})
