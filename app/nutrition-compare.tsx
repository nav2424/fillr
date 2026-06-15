import { useMemo, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useScanHistoryStore } from '../store/scanHistoryStore'
import { useUserStore } from '../store/userStore'
import { buildNutritionViewModel } from '../lib/buildNutritionViewModel'
import { extractNutritionFacts } from '../lib/extractNutritionFacts'
import { theme, spacing, radius } from '../constants/theme'
import { toTitleCase } from '../lib/formatProductTitle'
import { goBackOrReplace } from '../lib/navigationHelpers'

function MacroCompareRow({
  label,
  left,
  right,
  unit,
}: {
  label: string
  left?: number
  right?: number
  unit: string
}) {
  const fmt = (v?: number) => (v != null && v > 0 ? `${v}${unit}` : '—')
  const leftWins =
    left != null && right != null && left > 0 && right > 0 && label === 'Protein'
      ? left > right
      : left != null && right != null && left > 0 && right > 0 && label !== 'Protein'
        ? left < right
        : false
  const rightWins =
    left != null && right != null && left > 0 && right > 0 && label === 'Protein'
      ? right > left
      : left != null && right != null && left > 0 && right > 0 && label !== 'Protein'
        ? right < left
        : false

  return (
    <View style={styles.compareRow}>
      <Text style={[styles.compareValue, leftWins && styles.compareWin]}>{fmt(left)}</Text>
      <Text style={styles.compareLabel}>{label}</Text>
      <Text style={[styles.compareValue, rightWins && styles.compareWin]}>{fmt(right)}</Text>
    </View>
  )
}

export default function NutritionCompareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const goal = useUserStore((s) => s.goal)
  const nutritionTargets = useUserStore((s) => s.nutritionTargets)
  const getResultByProductId = useScanHistoryStore((s) => s.getResultByProductId)
  const scans = useScanHistoryStore((s) => s.scans)

  const leftScan = id ? getResultByProductId(id)?.result ?? null : null
  const [rightProductId, setRightProductId] = useState<string | null>(null)

  const rightScan = rightProductId ? getResultByProductId(rightProductId)?.result ?? null : null

  const pickOptions = useMemo(
    () =>
      scans
        .filter((s) => s.productId !== id && s.result)
        .slice(0, 12),
    [scans, id]
  )

  const leftModel = useMemo(
    () =>
      leftScan
        ? buildNutritionViewModel({
            scan: leftScan,
            scoringData: leftScan.scoringData ?? null,
            goalKey: goal ?? '',
            nutritionTargets,
            productAnalysis: leftScan.productAnalysis,
          })
        : null,
    [leftScan, goal, nutritionTargets]
  )

  const rightModel = useMemo(
    () =>
      rightScan
        ? buildNutritionViewModel({
            scan: rightScan,
            scoringData: rightScan.scoringData ?? null,
            goalKey: goal ?? '',
            nutritionTargets,
            productAnalysis: rightScan.productAnalysis,
          })
        : null,
    [rightScan, goal, nutritionTargets]
  )

  const leftFacts = leftScan ? extractNutritionFacts(leftScan) : null
  const rightFacts = rightScan ? extractNutritionFacts(rightScan) : null

  if (!leftScan || !leftModel) {
    return (
      <SafeAreaView style={styles.root}>
        <Text style={styles.empty}>Product not found.</Text>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => goBackOrReplace()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Compare nutrition</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.productHeaders}>
          <View style={styles.productCol}>
            <Text style={styles.productName} numberOfLines={2}>
              {toTitleCase(leftScan.product.name)}
            </Text>
            <Text style={styles.lensScore}>
              Nutrition fit {leftModel.lensScores.nutritionFit || '—'}/100
            </Text>
          </View>
          <View style={styles.vs}>
            <Text style={styles.vsText}>vs</Text>
          </View>
          <View style={styles.productCol}>
            {rightScan ? (
              <>
                <Text style={styles.productName} numberOfLines={2}>
                  {toTitleCase(rightScan.product.name)}
                </Text>
                <Text style={styles.lensScore}>
                  Nutrition fit {rightModel?.lensScores.nutritionFit || '—'}/100
                </Text>
              </>
            ) : (
              <Text style={styles.pickHint}>Pick a product</Text>
            )}
          </View>
        </View>

        {!rightScan ? (
          <View style={styles.pickerBlock}>
            <Text style={styles.pickerTitle}>Compare with a recent scan</Text>
            {pickOptions.map((row) => (
              <Pressable
                key={row.id}
                style={styles.pickerRow}
                onPress={() => setRightProductId(row.productId)}
              >
                <Text style={styles.pickerName} numberOfLines={1}>
                  {toTitleCase(row.productName)}
                </Text>
                <Ionicons name="add-circle-outline" size={20} color={theme.green700} />
              </Pressable>
            ))}
          </View>
        ) : (
          <>
            <View style={styles.table}>
              <MacroCompareRow label="Calories" left={leftFacts?.calories} right={rightFacts?.calories} unit="" />
              <MacroCompareRow label="Protein" left={leftFacts?.proteinG} right={rightFacts?.proteinG} unit="g" />
              <MacroCompareRow label="Carbs" left={leftFacts?.carbsG} right={rightFacts?.carbsG} unit="g" />
              <MacroCompareRow label="Sugar" left={leftFacts?.sugarsG} right={rightFacts?.sugarsG} unit="g" />
              <MacroCompareRow label="Sodium" left={leftFacts?.sodiumMg} right={rightFacts?.sodiumMg} unit="mg" />
            </View>
            <View style={styles.intelGrid}>
              <View style={styles.intelCol}>
                <Text style={styles.intelTitle}>Sugar stack</Text>
                <Text style={styles.intelBody}>
                  {leftModel.intelligence.sweetenerStack ?? '—'}
                </Text>
              </View>
              <View style={styles.intelCol}>
                <Text style={styles.intelTitle}>Sugar stack</Text>
                <Text style={styles.intelBody}>
                  {rightModel?.intelligence.sweetenerStack ?? '—'}
                </Text>
              </View>
            </View>
            <Pressable style={styles.changeBtn} onPress={() => setRightProductId(null)}>
              <Text style={styles.changeBtnText}>Choose different product</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.screenBg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: theme.textPrimary },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  productHeaders: { flexDirection: 'row', gap: 8, marginBottom: spacing.lg },
  productCol: { flex: 1, gap: 4 },
  productName: { fontSize: 14, fontWeight: '800', color: theme.textPrimary },
  lensScore: { fontSize: 12, fontWeight: '600', color: theme.textMuted },
  vs: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  vsText: { fontSize: 12, fontWeight: '800', color: theme.textFaint },
  pickHint: { fontSize: 13, color: theme.textFaint, fontStyle: 'italic' },
  pickerBlock: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.cardBorder,
  },
  pickerTitle: { fontSize: 14, fontWeight: '800', color: theme.textPrimary, marginBottom: spacing.sm },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
    gap: 8,
  },
  pickerName: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  table: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.cardBorder,
  },
  compareRow: { flexDirection: 'row', alignItems: 'center' },
  compareValue: { flex: 1, fontSize: 15, fontWeight: '700', color: theme.textPrimary, textAlign: 'center' },
  compareWin: { color: theme.green700 },
  compareLabel: {
    width: 72,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    color: theme.textFaint,
    textTransform: 'uppercase',
  },
  intelGrid: { flexDirection: 'row', gap: 10, marginTop: spacing.lg },
  intelCol: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.cardBorder,
    gap: 6,
  },
  intelTitle: { fontSize: 10, fontWeight: '800', color: theme.textFaint, letterSpacing: 0.5 },
  intelBody: { fontSize: 12, lineHeight: 17, color: theme.textSecondary },
  changeBtn: { marginTop: spacing.lg, alignItems: 'center', padding: spacing.md },
  changeBtnText: { fontSize: 14, fontWeight: '700', color: theme.green700 },
  empty: { padding: spacing.lg, color: theme.textMuted },
})
