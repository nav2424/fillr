import { useState } from 'react'
import { View, Text, StyleSheet, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { FormulaConcernCategory } from '../lib/buildFormulaConcerns'
import { sanitizeConcernLabel } from '../lib/buildFormulaConcerns'
import { ScanResultCard } from './ScanResultCard'
import { theme } from '../constants/theme'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

type Props = {
  concerns: FormulaConcernCategory[]
  headline?: string | null
}

function iconFor(id: string): keyof typeof Ionicons.glyphMap {
  switch (id) {
    case 'seed_oils':
      return 'water-outline'
    case 'preservatives':
      return 'flask-outline'
    case 'emulsifiers':
      return 'git-merge-outline'
    case 'artificial_sweeteners':
    case 'industrial_sweeteners':
      return 'cube-outline'
    case 'artificial_colors':
      return 'color-palette-outline'
    case 'hydrogenated_oils':
      return 'warning-outline'
    default:
      return 'alert-circle-outline'
  }
}

function severityColor(severity: FormulaConcernCategory['severity']): string {
  if (severity === 'high') return theme.flagged.text
  if (severity === 'medium') return theme.processed.text
  return theme.textMuted
}

function ConcernRow({ item }: { item: FormulaConcernCategory }) {
  const color = severityColor(item.severity)
  return (
    <View style={styles.row}>
      <View style={[styles.iconWrap, { backgroundColor: `${color}14` }]}>
        <Ionicons name={iconFor(item.id)} size={16} color={color} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{item.title}</Text>
        {item.ingredients.length > 0 ? (
          <View style={styles.ingredientChipRow}>
            {item.ingredients.map((name) => {
              const label = sanitizeConcernLabel(name)
              if (!label) return null
              return (
                <View key={`${item.id}-${label}`} style={styles.ingredientChip}>
                  <Text style={styles.ingredientChipText}>{label}</Text>
                </View>
              )
            })}
          </View>
        ) : null}
        <Text style={styles.rowDetail}>{item.detail}</Text>
      </View>
    </View>
  )
}

export function FormulaConcernsSection({ concerns, headline }: Props) {
  const [expanded, setExpanded] = useState(false)
  if (!concerns.length) return null

  const visible = expanded ? concerns : concerns.slice(0, 2)
  const hiddenCount = concerns.length - visible.length

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setExpanded((v) => !v)
  }

  return (
    <ScanResultCard flush bodyStyle={styles.body}>
      <View style={styles.header}>
        <Text style={styles.title}>Formula watch-outs</Text>
        {headline ? <Text style={styles.headline}>{headline}</Text> : null}
      </View>

      <View style={styles.list}>
        {visible.map((item) => (
          <ConcernRow key={item.id} item={item} />
        ))}
      </View>

      {concerns.length > 2 ? (
        <Pressable
          onPress={toggle}
          style={({ pressed }) => [styles.moreBtn, pressed && { opacity: 0.9 }]}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
        >
          <Text style={styles.moreBtnText}>
            {expanded ? 'Show less' : `Show ${hiddenCount} more watch-out${hiddenCount === 1 ? '' : 's'}`}
          </Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={theme.textFaint} />
        </Pressable>
      ) : null}
    </ScanResultCard>
  )
}

const styles = StyleSheet.create({
  body: {
    paddingTop: 16,
    paddingBottom: 14,
  },
  header: {
    marginBottom: 12,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    letterSpacing: -0.3,
  },
  headline: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.processed.text,
    lineHeight: 18,
  },
  list: {
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.textPrimary,
    letterSpacing: -0.15,
  },
  ingredientChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  ingredientChip: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: '100%',
  },
  ingredientChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
    lineHeight: 18,
  },
  rowDetail: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.textMuted,
    lineHeight: 17,
  },
  moreBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  moreBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textFaint,
  },
})
