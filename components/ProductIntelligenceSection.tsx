import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { ProductAnalysis } from '../types'
import { theme } from '../constants/theme'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

type Props = {
  analysis: ProductAnalysis
  productVerdict?: string
  personalizedInsight?: string | null
  /** When true (default), long-form intel starts collapsed behind one preview line. */
  defaultExpanded?: boolean
  /** Hide duplicate profile line when the profile card already covers it. */
  hidePersonalizedInsight?: boolean
}

function hasIntelContent(analysis: ProductAnalysis): boolean {
  return Boolean(
    analysis.viralHook?.trim() ||
      analysis.bottomLine?.trim() ||
      (analysis.regulatoryFlags?.length ?? 0) > 0 ||
      (analysis.labelVsReality?.length ?? 0) > 0 ||
      (analysis.redFlags?.length ?? 0) > 0 ||
      (analysis.hiddenIngredients?.length ?? 0) > 0 ||
      (analysis.sugarSources?.length ?? 0) > 1 ||
      analysis.ingredientOrderInsight?.trim() ||
      analysis.whatTheyDontTellYou?.trim()
  )
}

function listText(items: string[] | undefined, limit = 3): string {
  const cleaned = (items ?? []).map((s) => s.trim()).filter(Boolean)
  if (!cleaned.length) return ''
  return cleaned.slice(0, limit).join(', ')
}

function formulaType(analysis: ProductAnalysis): string {
  const rc = analysis.ratingCounts
  const sugarCount = analysis.sugarSources?.length ?? 0
  const hiddenCount = analysis.hiddenIngredients?.length ?? 0
  const regulatoryCount = analysis.regulatoryFlags?.length ?? 0
  const concerning = (rc?.concerning ?? 0) + (rc?.avoid ?? 0)
  if (regulatoryCount > 0) return 'Regulatory-risk formula'
  if (sugarCount >= 3) return 'Stacked sweetener system'
  if (sugarCount > 0 && hiddenCount > 0) return 'Sweetened processed formula'
  if (concerning >= 3) return 'Additive-heavy formula'
  if (hiddenCount > 0) return 'Processed convenience formula'
  if ((rc?.clean ?? 0) > 0 && concerning === 0) return 'Mostly simple formula'
  return 'Packaged-food formula'
}

function mainTradeoff(analysis: ProductAnalysis): string {
  const hidden = listText(analysis.hiddenIngredients?.map((h) => h.name), 2)
  const sugars = listText(analysis.sugarSources, 2)
  if (hidden && sugars) return `Recognizable base plus ${sugars} and ${hidden}.`
  if (hidden) return `Convenience and consistency come from ${hidden}.`
  if (sugars) return `Sweetness is built from ${sugars}.`
  if (analysis.bottomLine?.trim()) return analysis.bottomLine.trim().split(/(?<=[.!?])\s+/)[0]
  return 'Judge it by the ingredient order and repeat-use fit.'
}

function watchOuts(analysis: ProductAnalysis): string {
  const regulatory = listText(analysis.regulatoryFlags?.map((r) => r.ingredient), 2)
  if (regulatory) return regulatory
  const sugars = listText(analysis.sugarSources, 3)
  const hidden = listText(analysis.hiddenIngredients?.map((h) => h.name), 2)
  if (sugars || hidden) return [sugars, hidden].filter(Boolean).join(', ')
  const redFlag = analysis.redFlags?.[0]?.trim()
  if (redFlag) return redFlag.split(/(?<=[.!?])\s+/)[0]
  return 'No major formula watch-outs found.'
}

function bestUse(analysis: ProductAnalysis): string {
  const rc = analysis.ratingCounts
  const avoid = rc?.avoid ?? 0
  const concerning = rc?.concerning ?? 0
  if (avoid > 0) return 'Skip unless it clearly fits your needs.'
  if (concerning >= 3 || (analysis.sugarSources?.length ?? 0) >= 3) return 'Occasional choice, not a daily staple.'
  if (concerning > 0) return 'Useful sometimes; compare cleaner options.'
  return 'Good fit when it matches your profile.'
}

type LabelRealityRow = NonNullable<ProductAnalysis['labelVsReality']>[number]

function firstSentence(text: string | undefined): string {
  const clean = text?.trim()
  if (!clean) return ''
  return clean.split(/(?<=[.!?])\s+/)[0]?.trim() ?? clean
}

function isWeakLabelReality(row: LabelRealityRow): boolean {
  const claim = row.claim.trim().toLowerCase()
  const reality = row.reality.trim().toLowerCase()
  if (!claim || !reality) return true
  if (reality.length < 42) return true
  return [
    'often involves synthetic processing',
    'processed ingredient',
    'can include synthetic components',
    'what the list shows',
    'natural label',
    'highly processed despite',
  ].some((phrase) => reality.includes(phrase))
}

function concreteLabelRealityRows(analysis: ProductAnalysis): LabelRealityRow[] {
  const rawRows = (analysis.labelVsReality ?? [])
    .filter((row) => !isWeakLabelReality(row))
    .map((row) => ({
      claim: row.claim.trim(),
      reality: firstSentence(row.reality),
      ...(row.example?.trim() ? { example: row.example.trim() } : {}),
    }))

  const derivedRows: LabelRealityRow[] = []
  const hidden = analysis.hiddenIngredients ?? []
  const naturalFlavor = hidden.find((h) => /natural\s+flavou?r/i.test(h.name))
  const hiddenSource = naturalFlavor ?? hidden[0]

  if (hiddenSource) {
    derivedRows.push({
      claim: hiddenSource.name,
      reality: `${hiddenSource.name} is listed as one ingredient, but the exact sub-ingredients are not disclosed on the package.`,
      example: firstSentence(hiddenSource.whatItReallyIs) || 'Ask the brand when a sensitivity or allergy depends on the exact source.',
    })
  }

  const sugars = (analysis.sugarSources ?? []).map((s) => s.trim()).filter(Boolean)
  if (sugars.length >= 2) {
    const visibleSugars = sugars.slice(0, 4).join(', ')
    derivedRows.push({
      claim: 'Sweetener stack',
      reality: `Sweetness comes from multiple sources: ${visibleSugars}. That can make the total sweetener load less obvious at a glance.`,
      example: sugars.length > 4 ? `${sugars.length} sweetener sources were detected.` : undefined,
    })
  }

  if (analysis.ingredientOrderInsight?.trim()) {
    derivedRows.push({
      claim: 'Ingredient order',
      reality: firstSentence(analysis.ingredientOrderInsight),
    })
  }

  const byClaim = new Set<string>()
  return [...rawRows, ...derivedRows].filter((row) => {
    const key = row.claim.trim().toLowerCase()
    if (!key || byClaim.has(key)) return false
    byClaim.add(key)
    return true
  }).slice(0, 2)
}

export function ProductIntelligenceSection({
  analysis,
  productVerdict,
  personalizedInsight,
  defaultExpanded = false,
  hidePersonalizedInsight = false,
}: Props) {
  const [regOpen, setRegOpen] = useState(false)
  const [labelOpen, setLabelOpen] = useState(false)
  const [expanded, setExpanded] = useState(defaultExpanded)

  const insightLine = hidePersonalizedInsight ? null : personalizedInsight?.trim() || null

  if (!hasIntelContent(analysis)) {
    if (!productVerdict?.trim() && !insightLine) return null
    return (
      <View style={styles.shell}>
        {productVerdict?.trim() ? <Text style={styles.verdictOnly}>{productVerdict.trim()}</Text> : null}
        {insightLine ? (
          <View style={styles.personalInsight}>
            <Ionicons name="person-circle-outline" size={18} color="#0f766e" />
            <Text style={styles.personalInsightText}>{insightLine}</Text>
          </View>
        ) : null}
      </View>
    )
  }

  const previewLine =
    analysis.viralHook?.trim() ||
    productVerdict?.trim() ||
    analysis.bottomLine?.trim() ||
    firstSentence(mainTradeoff(analysis))

  if (!expanded) {
    return (
      <Pressable
        style={styles.collapsedShell}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
          setExpanded(true)
        }}
        accessibilityRole="button"
        accessibilityLabel="Expand product details"
        accessibilityState={{ expanded: false }}
      >
        <Text style={styles.collapsedPreview} numberOfLines={2}>
          {firstSentence(previewLine)}
        </Text>
        <View style={styles.collapsedFooter}>
          <Text style={styles.collapsedAction}>Product details</Text>
          <Ionicons name="chevron-down" size={18} color={theme.textFaint} />
        </View>
      </Pressable>
    )
  }

  const regulatory = analysis.regulatoryFlags ?? []
  const labelVs = concreteLabelRealityRows(analysis)
  const redFlags = analysis.redFlags ?? []
  const briefRows = [
    { label: 'Formula type', value: formulaType(analysis), icon: 'analytics-outline' as const },
    { label: 'Main tradeoff', value: mainTradeoff(analysis), icon: 'git-compare-outline' as const },
    { label: 'Watch-outs', value: watchOuts(analysis), icon: 'alert-circle-outline' as const },
  ]

  return (
    <View style={styles.shell} accessibilityRole="summary" accessibilityLabel="Product intelligence">
      <Pressable
        style={styles.collapseHeader}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
          setExpanded(false)
        }}
        accessibilityRole="button"
        accessibilityLabel="Collapse product details"
        accessibilityState={{ expanded: true }}
      >
        <Text style={styles.kicker}>PRODUCT DETAILS</Text>
        <Ionicons name="chevron-up" size={20} color={theme.textFaint} />
      </Pressable>

      {analysis.viralHook?.trim() ? (
        <Text style={styles.hook}>{firstSentence(analysis.viralHook)}</Text>
      ) : productVerdict?.trim() ? (
        <Text style={styles.hook}>{firstSentence(productVerdict)}</Text>
      ) : null}

      {analysis.bottomLine?.trim() ? (
        <Text style={styles.bottomLine}>{firstSentence(analysis.bottomLine)}</Text>
      ) : null}

      {insightLine ? (
        <View style={styles.personalInsight}>
          <Ionicons name="person-circle-outline" size={18} color="#0f766e" />
          <Text style={styles.personalInsightText}>{insightLine}</Text>
        </View>
      ) : null}

      <View style={styles.briefGrid}>
        {briefRows.map((row) => (
          <View key={row.label} style={styles.briefRow}>
            <Ionicons name={row.icon} size={17} color={theme.textFaint} />
            <View style={styles.briefTextCol}>
              <Text style={styles.briefLabel}>{row.label}</Text>
              <Text style={styles.briefValue}>{row.value}</Text>
            </View>
          </View>
        ))}
      </View>

      {redFlags.length > 0 ? (
        <View style={styles.redBlock}>
          <Text style={styles.blockTitle}>Red flags</Text>
          {redFlags.slice(0, 2).map((line, i) => (
            <View key={`rf-${i}`} style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.bulletBody}>{line}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {regulatory.length > 0 ? (
        <View style={styles.block}>
          <Pressable
            style={styles.blockHeader}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
              setRegOpen((v) => !v)
            }}
            accessibilityRole="button"
            accessibilityState={{ expanded: regOpen }}
          >
            <Ionicons name="globe-outline" size={18} color="#7c2d12" />
            <Text style={styles.blockTitle}>Regulatory & legal context</Text>
            <Ionicons name={regOpen ? 'chevron-up' : 'chevron-down'} size={20} color={theme.textFaint} />
          </Pressable>
          {regOpen &&
            regulatory.slice(0, 2).map((row, i) => (
              <View key={`reg-${row.ingredient}-${i}`} style={styles.regRow}>
                <Text style={styles.regIngredient}>{row.ingredient}</Text>
                <Text style={styles.regIssue}>{row.issue}</Text>
                {row.regions?.trim() ? (
                  <Text style={styles.regRegions}>{row.regions.trim()}</Text>
                ) : null}
              </View>
            ))}
        </View>
      ) : null}

      {labelVs.length > 0 ? (
        <View style={styles.block}>
          <Pressable
            style={styles.blockHeader}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
              setLabelOpen((v) => !v)
            }}
            accessibilityRole="button"
            accessibilityState={{ expanded: labelOpen }}
          >
            <Ionicons name="pricetag-outline" size={18} color="#1e3a8a" />
            <Text style={styles.blockTitle}>Label vs reality</Text>
            <Ionicons name={labelOpen ? 'chevron-up' : 'chevron-down'} size={20} color={theme.textFaint} />
          </Pressable>
          {labelOpen &&
            labelVs.map((row, i) => (
              <View key={`lvr-${i}`} style={styles.lvrRow}>
                <Text style={styles.lvrClaim}>{row.claim}</Text>
                <Text style={styles.lvrRealityLabel}>What it means</Text>
                <Text style={styles.lvrReality}>{row.reality}</Text>
                {row.example?.trim() ? (
                  <Text style={styles.lvrExample}>{row.example.trim()}</Text>
                ) : null}
                {i < labelVs.length - 1 ? <View style={styles.lvrDivider} /> : null}
              </View>
            ))}
        </View>
      ) : null}

      <Text style={styles.bestUseLine}>{bestUse(analysis)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
    gap: 10,
  },
  collapsedShell: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  collapsedPreview: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  collapsedFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  collapsedAction: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textFaint,
    letterSpacing: 0.3,
  },
  collapseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: theme.textFaint,
  },
  hook: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 23,
    color: theme.textPrimary,
  },
  bottomLine: {
    fontSize: 13.5,
    lineHeight: 19,
    color: theme.textMuted,
  },
  personalInsight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  personalInsightText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: '#115e59',
  },
  briefGrid: {
    gap: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
  },
  briefRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  briefTextCol: {
    flex: 1,
    gap: 2,
  },
  briefLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: theme.textFaint,
    textTransform: 'uppercase',
  },
  briefValue: {
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  verdictOnly: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  block: {
    gap: 8,
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  blockTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: theme.textPrimary,
  },
  redBlock: {
    paddingVertical: 8,
    paddingHorizontal: 0,
    gap: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  bullet: {
    fontSize: 14,
    color: '#be123c',
    lineHeight: 20,
  },
  bulletBody: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#881337',
  },
  regRow: {
    paddingVertical: 8,
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
  },
  regIngredient: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7c2d12',
  },
  regIssue: {
    fontSize: 13,
    lineHeight: 18,
    color: '#431407',
  },
  regRegions: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9a3412',
  },
  lvrRow: {
    gap: 4,
    paddingVertical: 6,
  },
  lvrClaim: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e3a8a',
  },
  lvrRealityLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: theme.textFaint,
    marginTop: 2,
  },
  lvrReality: {
    fontSize: 13,
    lineHeight: 18,
    color: theme.textPrimary,
  },
  lvrExample: {
    fontSize: 12,
    lineHeight: 17,
    color: theme.textMuted,
    fontStyle: 'italic',
  },
  lvrDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e2e8f0',
    marginTop: 8,
  },
  bestUseLine: {
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '700',
    color: '#166534',
  },
})
