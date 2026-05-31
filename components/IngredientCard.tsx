import { useEffect, useMemo, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native'
import type { CeliacSignal, IngredientExplanation, IngredientRating } from '../types'
import { resolveIngredientDisplayRating } from '../lib/resolveIngredientDisplayRating'
import { buildIngredientCardViewModel } from '../lib/buildIngredientCardViewModel'
import { ingredientExplanationFailsQualityGate } from '../lib/ingredientCopyQuality'
import { theme } from '../constants/theme'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

export { resolveIngredientDisplayRating }

const RATING_UI: Record<
  IngredientRating,
  {
    badgeLabel: string
    badgeText: string
    badgeBg: string
    accent: string
  }
> = {
  clean: {
    badgeLabel: 'NATURAL',
    badgeText: theme.natural.text,
    badgeBg: theme.natural.bg,
    accent: theme.natural.accent,
  },
  okay: {
    badgeLabel: 'PROCESSED',
    badgeText: theme.processed.text,
    badgeBg: theme.processed.bg,
    accent: theme.processed.accent,
  },
  concerning: {
    badgeLabel: 'ADDITIVE',
    badgeText: theme.additive.text,
    badgeBg: theme.additive.bg,
    accent: theme.additive.accent,
  },
  avoid: {
    badgeLabel: 'FLAGGED',
    badgeText: theme.flagged.text,
    badgeBg: theme.flagged.bg,
    accent: theme.flagged.accent,
  },
}

function capitalizeFirstOnly(s: string): string {
  const t = s.trim()
  if (!t) return ''
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
}

export interface IngredientCardProps {
  ingredient: IngredientExplanation
  expanded?: boolean
  onToggleExpanded?: () => void
  allergyMatch?: boolean
  sensitivityMatch?: boolean
  celiacMatch?: CeliacSignal | null
  compactPreview?: boolean
  reasonChipLabel?: string | null
}

export function IngredientCard({
  ingredient,
  expanded: expandedProp,
  onToggleExpanded,
  allergyMatch = false,
  sensitivityMatch = false,
  celiacMatch = null,
  compactPreview = false,
  reasonChipLabel = null,
}: IngredientCardProps) {
  const expanded = Boolean(expandedProp)
  const rotate = useRef(new Animated.Value(expanded ? 1 : 0)).current

  const rating = resolveIngredientDisplayRating(ingredient, allergyMatch, sensitivityMatch)
  const ui = RATING_UI[rating]
  const decodeUnavailable =
    ingredient.ingredientDecodeStatus === 'unavailable' ||
    (!ingredient.aiDecodePending && ingredientExplanationFailsQualityGate(ingredient))

  const vm = useMemo(
    () =>
      buildIngredientCardViewModel(ingredient, {
        displayRating: rating,
        allergyMatch,
        sensitivityMatch,
        celiacMatch: Boolean(celiacMatch),
      }),
    [ingredient, rating, allergyMatch, sensitivityMatch, celiacMatch]
  )

  useEffect(() => {
    Animated.timing(rotate, {
      toValue: expanded ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start()
  }, [expanded, rotate])

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  })

  /** Traceability lines exist for every row; only show when something is actually flagged or called out. */
  const showFlagReasoning =
    vm.evidence.length > 0 &&
    (rating === 'avoid' ||
      rating === 'concerning' ||
      allergyMatch ||
      sensitivityMatch ||
      Boolean(celiacMatch) ||
      Boolean(reasonChipLabel))

  const toggle = () => {
    if (Platform.OS === 'android') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    }
    onToggleExpanded?.()
  }

  const showCollapsedSubtitle = Boolean(decodeUnavailable || vm.shortLabel)

  return (
    <Pressable
      onPress={toggle}
      disabled={compactPreview}
      style={({ pressed }) => [pressed && !compactPreview && { opacity: 0.96 }]}
    >
      <View style={[styles.outer, expanded ? styles.outerOpen : styles.outerCollapsed]}>
        <View style={styles.body}>
          <View style={styles.headerRow}>
            <View style={styles.titleCol}>
              <Text style={styles.name} numberOfLines={4}>
                {capitalizeFirstOnly(vm.title)}
              </Text>
              {showCollapsedSubtitle ? (
                <Text style={styles.collapsedSubtitle} numberOfLines={8}>
                  {decodeUnavailable ? 'Details unavailable' : vm.shortLabel}
                </Text>
              ) : null}
              {reasonChipLabel ? (
                <View style={styles.reasonChip}>
                  <Text style={styles.reasonChipText}>{reasonChipLabel}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.headerRight}>
              <View style={[styles.badge, { backgroundColor: ui.badgeBg }]}>
                <Text style={[styles.badgeText, { color: ui.badgeText }]}>{ui.badgeLabel}</Text>
              </View>
              {!compactPreview ? (
                <Animated.Text style={[styles.chevron, { transform: [{ rotate: spin }] }]}>
                  ▼
                </Animated.Text>
              ) : null}
            </View>
          </View>
          {expanded && !compactPreview ? (
            ingredient.aiDecodePending ? (
              <Text style={styles.decodePlaceholder}>Still loading this line…</Text>
            ) : decodeUnavailable ? (
              <View style={styles.unavailableBlock}>
                <Text style={styles.unavailableTitle}>Ingredient details unavailable</Text>
                <Text style={styles.unavailableBody}>
                  Fillr could not load a reliable explanation for this line. Use the printed label as the source of truth.
                </Text>
              </View>
            ) : (
              <View style={styles.expandedBlock}>
                {vm.bullets.length > 0 ? (
                  <View style={styles.bulletList}>
                    {vm.bullets.map((line, i) => (
                      <View key={`b-${i}`} style={styles.bulletRow}>
                        <Text style={styles.bulletGlyph} accessibilityElementsHidden>
                          {'\u2022'}
                        </Text>
                        <Text style={styles.bulletText}>{line}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {vm.systemJudgment && rating === 'avoid' ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Why Fillr flagged this</Text>
                    <Text style={styles.sectionBody}>{vm.systemJudgment}</Text>
                  </View>
                ) : null}

                {vm.impactForYou ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Impact for you</Text>
                    <Text style={styles.sectionBody}>{vm.impactForYou}</Text>
                  </View>
                ) : null}

                {vm.fallbackBody ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>About this ingredient</Text>
                    <Text style={styles.fallbackBody}>{vm.fallbackBody}</Text>
                  </View>
                ) : null}

                {showFlagReasoning ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Why this was flagged</Text>
                    {vm.evidence.map((item) => (
                      <Text key={`${item.label}-${item.value}`} style={styles.evidenceLine}>
                        <Text style={styles.evidenceLabel}>{item.label}: </Text>
                        {item.value}
                      </Text>
                    ))}
                  </View>
                ) : null}

                {vm.footnote ? (
                  <Text style={styles.footnote} numberOfLines={6}>
                    {vm.footnote}
                  </Text>
                ) : null}
              </View>
            )
          ) : null}
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  outer: {
    backgroundColor: theme.cardBg,
    borderRadius: theme.cardRadius,
    marginBottom: 8,
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  outerCollapsed: {
    borderColor: theme.cardBorder,
  },
  outerOpen: {
    borderColor: theme.cardBorderOpen,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 8,
    elevation: 3,
  },
  body: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  titleCol: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 13.5,
    fontWeight: '600',
    color: theme.textPrimary,
    letterSpacing: -0.1,
  },
  collapsedSubtitle: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: '500',
    color: theme.textMuted,
    letterSpacing: -0.05,
    lineHeight: 17,
  },
  reasonChip: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: '#fff2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  reasonChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.flagged.text,
    letterSpacing: 0.2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingTop: 1,
  },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 100,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  chevron: {
    color: theme.textDisabled,
    fontSize: 10,
  },
  expandedBlock: {
    marginTop: 12,
    paddingTop: 2,
    gap: 0,
  },
  bulletList: {
    marginBottom: 12,
    gap: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletGlyph: {
    fontSize: 13,
    color: theme.textMuted,
    lineHeight: 19,
    marginTop: 0,
    width: 14,
    textAlign: 'center',
  },
  bulletText: {
    flex: 1,
    fontSize: 12.5,
    color: theme.textSecondary,
    lineHeight: 19,
  },
  section: {
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.85,
    textTransform: 'uppercase',
    color: theme.textFaint,
    marginBottom: 5,
  },
  sectionBody: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.textSecondary,
    lineHeight: 20,
  },
  fallbackBody: {
    fontSize: 12.5,
    color: theme.textMuted,
    lineHeight: 20,
  },
  evidenceLine: {
    color: theme.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  evidenceLabel: {
    fontWeight: '700',
    color: theme.textPrimary,
  },
  footnote: {
    fontSize: 11.5,
    color: theme.textFaint,
    lineHeight: 17,
    marginTop: -4,
  },
  decodePlaceholder: {
    marginTop: 10,
    fontSize: 13,
    color: theme.textFaint,
    lineHeight: 18,
  },
  unavailableBlock: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f8fafc',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 4,
  },
  unavailableTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: theme.textPrimary,
  },
  unavailableBody: {
    fontSize: 12,
    lineHeight: 17,
    color: theme.textMuted,
  },
})
