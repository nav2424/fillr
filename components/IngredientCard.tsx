import { useEffect, useRef } from 'react'
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
import { isIngredientCopyBoilerplate } from '../lib/fillrAdapter'
import { resolveIngredientDisplayRating } from '../lib/resolveIngredientDisplayRating'
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

function firstSentence(s: string): string {
  const t = s.trim()
  if (!t) return ''
  const cut = t.split(/(?<=[.!?])\s+/)[0] ?? t
  return cut.trim()
}

function buildTranslationLine(ingredient: IngredientExplanation): string {
  const whatItIs = firstSentence(ingredient.whatItIs || '')
  const whatItDoes = firstSentence(
    (ingredient.whatItDoes ?? ingredient.whyItsUsed ?? '').trim() || ingredient.whatItIs || ''
  )
  const decode = (ingredient.labelDecoder || '').trim()
  if (decode && decode.includes('—') && !isIngredientCopyBoilerplate(decode)) return decode
  if (whatItIs && whatItDoes && whatItIs !== whatItDoes) {
    return `${whatItIs} — ${whatItDoes}`
  }
  if (whatItIs) return whatItIs
  return (
    ingredient.headline?.trim() ||
    ingredient.quickSummary?.trim() ||
    (ingredient.explanation || '').trim().split('.').slice(0, 2).join('. ') ||
    ''
  )
}

function buildExpandedDescription(ingredient: IngredientExplanation): string {
  const parts: string[] = []
  const main = buildTranslationLine(ingredient).trim()
  if (main) parts.push(main)
  const body = (ingredient.bodyEffect || '').trim()
  if (body) parts.push(body)
  const note = (ingredient.personalizedNote || '').trim()
  if (note) parts.push(note)
  const amb = ingredient.sourceAmbiguity?.message?.trim()
  if (amb) parts.push(amb)
  const out = parts.join('\n\n').trim()
  return out || 'No extra detail for this ingredient yet.'
}

export interface IngredientCardProps {
  ingredient: IngredientExplanation
  expanded?: boolean
  onToggleExpanded?: () => void
  allergyMatch?: boolean
  sensitivityMatch?: boolean
  celiacMatch?: CeliacSignal | null
  compactPreview?: boolean
}

export function IngredientCard({
  ingredient,
  expanded: expandedProp,
  onToggleExpanded,
  allergyMatch = false,
  sensitivityMatch = false,
  celiacMatch = null,
  compactPreview = false,
}: IngredientCardProps) {
  const expanded = Boolean(expandedProp)
  const rotate = useRef(new Animated.Value(expanded ? 1 : 0)).current

  const rating = resolveIngredientDisplayRating(ingredient, allergyMatch, sensitivityMatch)
  const ui = RATING_UI[rating]

  const accentColor =
    celiacMatch?.severity === 'AVOID'
      ? theme.flagged.accent
      : celiacMatch?.severity === 'CAUTION'
        ? theme.additive.accent
        : ui.accent

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

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    onToggleExpanded?.()
  }

  return (
    <Pressable
      onPress={toggle}
      disabled={compactPreview}
      style={({ pressed }) => [pressed && !compactPreview && { opacity: 0.96 }]}
    >
      <View style={[styles.outer, expanded ? styles.outerOpen : styles.outerCollapsed]}>
        <View style={[styles.accent, { backgroundColor: accentColor }]} />
        <View style={styles.body}>
          <View style={styles.headerRow}>
            <Text style={styles.name} numberOfLines={4}>
              {capitalizeFirstOnly(ingredient.name)}
            </Text>
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
              <Text style={styles.decodePlaceholder}>Decoding...</Text>
            ) : (
              <Text style={styles.description}>{buildExpandedDescription(ingredient)}</Text>
            )
          ) : null}
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  outer: {
    flexDirection: 'row',
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
  accent: {
    width: 4,
    alignSelf: 'stretch',
  },
  body: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: theme.textPrimary,
    letterSpacing: -0.1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
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
  description: {
    marginTop: 8,
    fontSize: 12,
    color: theme.textMuted,
    lineHeight: 19,
  },
  decodePlaceholder: {
    marginTop: 8,
    minHeight: 76,
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
    lineHeight: 19,
  },
})
