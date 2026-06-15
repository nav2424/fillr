import { useState } from 'react'
import { View, Text, StyleSheet, Pressable, LayoutAnimation, Platform, UIManager, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { NutritionViewModel } from '../lib/buildNutritionViewModel'
import { ScanResultCard } from './ScanResultCard'
import { theme } from '../constants/theme'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

type Props = {
  model: NutritionViewModel
}

function toneColors(tone: 'good' | 'warn' | 'bad' | 'neutral') {
  if (tone === 'good') return { bar: theme.green500, text: theme.green800 }
  if (tone === 'warn') return { bar: theme.processed.accent, text: theme.processed.text }
  if (tone === 'bad') return { bar: theme.flagged.accent, text: theme.flagged.text }
  return { bar: '#94a3b8', text: theme.textSecondary }
}

function MacroBar({ row }: { row: NutritionViewModel['macros'][number] }) {
  const colors = toneColors(row.tone)
  return (
    <View style={styles.macroRow}>
      <View style={styles.macroTop}>
        <Text style={styles.macroLabel}>{row.label}</Text>
        <Text style={styles.macroValue}>{row.display}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${row.barPercent}%`, backgroundColor: colors.bar }]} />
      </View>
      {row.callout ? <Text style={[styles.macroCallout, { color: colors.text }]}>{row.callout}</Text> : null}
    </View>
  )
}

function macroChips(model: NutritionViewModel) {
  const picks = model.macros.filter((m) =>
    ['calories', 'protein', 'sugars', 'sodium', 'fat', 'carbs'].includes(m.key)
  )
  return (picks.length > 0 ? picks : model.macros.slice(0, 4)).map((m) => ({
    key: m.key,
    label: m.label,
    value: m.display,
    tone: m.tone,
  }))
}

export function ProductNutritionSection({ model }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (!model.hasData && model.macros.length === 0) return null

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setExpanded((v) => !v)
  }

  const chips = macroChips(model)

  return (
    <ScanResultCard flush bodyStyle={styles.body}>
      <Pressable
        onPress={toggle}
        style={({ pressed }) => [styles.headerRow, pressed && { opacity: 0.92 }]}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={expanded ? 'Collapse nutrition details' : 'Expand nutrition details'}
      >
        <View style={styles.headerText}>
          <Text style={styles.title}>Nutrition</Text>
          <Text style={styles.subtitle}>{model.servingLabel ?? 'Per serving'}</Text>
        </View>
        <View style={styles.chevronWrap}>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textFaint} />
        </View>
      </Pressable>

      {model.targetVerdict && model.targetVerdict.status !== 'pass' ? (
        <Text style={styles.verdictLine} numberOfLines={2}>
          {model.targetVerdict.headline}
        </Text>
      ) : null}

      {model.categoryContext ? (
        <Text style={styles.categoryLine} numberOfLines={2}>
          {model.categoryContext.line}
        </Text>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        style={styles.chipScroll}
      >
        {chips.map((chip) => (
          <View key={chip.key} style={styles.chip}>
            <Text style={styles.chipLabel}>{chip.label}</Text>
            <Text style={styles.chipValue}>{chip.value}</Text>
          </View>
        ))}
      </ScrollView>

      {expanded ? (
        <View style={styles.expandedBlock}>
          <View style={styles.macroList}>
            {model.macros.map((row) => (
              <MacroBar key={row.key} row={row} />
            ))}
          </View>

          {(model.intelligence.sweetenerStack ||
            model.intelligence.sodiumSources.length > 0 ||
            model.intelligence.hiddenSugarNote) && (
            <View style={styles.intelBlock}>
              {model.intelligence.sweetenerStack ? (
                <Text style={styles.intelBody}>{model.intelligence.sweetenerStack}</Text>
              ) : null}
              {model.intelligence.hiddenSugarNote ? (
                <Text style={styles.intelBody}>{model.intelligence.hiddenSugarNote}</Text>
              ) : null}
              {model.intelligence.sodiumSources.length > 0 ? (
                <Text style={styles.intelBody}>
                  Sodium: {model.intelligence.sodiumSources.join(', ')}
                </Text>
              ) : null}
            </View>
          )}
        </View>
      ) : null}
    </ScanResultCard>
  )
}

const styles = StyleSheet.create({
  body: {
    paddingTop: 0,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    marginBottom: 12,
  },
  headerText: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.textFaint,
  },
  chevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f4f6f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verdictLine: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.processed.text,
    marginBottom: 8,
  },
  categoryLine: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: theme.textMuted,
    marginBottom: 10,
  },
  chipScroll: {
    marginHorizontal: -4,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#f4f6f8',
    minWidth: 72,
  },
  chipLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.textFaint,
    marginBottom: 2,
  },
  chipValue: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.textPrimary,
    letterSpacing: -0.2,
  },
  expandedBlock: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15, 23, 42, 0.05)',
    gap: 12,
  },
  macroList: { gap: 14 },
  macroRow: { gap: 6 },
  macroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  macroLabel: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  macroValue: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  barTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: '#eef2f6',
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 999 },
  macroCallout: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  intelBlock: {
    gap: 6,
    paddingTop: 4,
  },
  intelBody: {
    fontSize: 13,
    lineHeight: 18,
    color: theme.textMuted,
    fontWeight: '500',
  },
})
