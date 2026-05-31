import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import type { IngredientDataQuality } from '../lib/buildIngredientDataQuality'

type Props = {
  quality: IngredientDataQuality
  barcode?: string
  productId?: string
}

const TONE = {
  high: {
    bg: '#f0fdf9',
    border: '#99f6e4',
    icon: 'checkmark-circle-outline' as const,
    iconColor: '#0f766e',
    titleColor: '#115e59',
    bodyColor: '#134e4a',
  },
  medium: {
    bg: '#fffbeb',
    border: '#fcd34d',
    icon: 'information-circle-outline' as const,
    iconColor: '#b45309',
    titleColor: '#92400e',
    bodyColor: '#78350f',
  },
  low: {
    bg: '#f8fafc',
    border: '#cbd5e1',
    icon: 'alert-circle-outline' as const,
    iconColor: '#475569',
    titleColor: '#334155',
    bodyColor: '#475569',
  },
}

export function ScanDataQualityBanner({ quality, barcode, productId }: Props) {
  const tone = TONE[quality.level]
  const showActions = quality.suggestLabelCapture && Boolean(barcode?.trim())

  return (
    <View
      style={[styles.shell, { backgroundColor: tone.bg, borderColor: tone.border }]}
      accessibilityRole="summary"
    >
      <View style={styles.topRow}>
        <Ionicons name={tone.icon} size={20} color={tone.iconColor} />
        <View style={styles.textCol}>
          <Text style={[styles.title, { color: tone.titleColor }]}>{quality.title}</Text>
          <Text style={[styles.body, { color: tone.bodyColor }]}>{quality.message}</Text>
        </View>
        <View style={styles.scoreOrb}>
          <Text style={styles.scoreNum}>{quality.score}</Text>
          <Text style={styles.scoreLbl}>data</Text>
        </View>
      </View>
      {showActions ? (
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
            onPress={() =>
              router.push({
                pathname: '/ocr-scanner',
                params: { barcode: barcode!.trim(), productId: productId ?? '' },
              })
            }
            accessibilityRole="button"
            accessibilityLabel="Scan label photo"
          >
            <Ionicons name="camera-outline" size={16} color="#0f766e" />
            <Text style={styles.actionBtnText}>Scan label</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionBtnSecondary, pressed && styles.actionBtnPressed]}
            onPress={() =>
              router.push({
                pathname: '/manual-ingredients',
                params: { barcode: barcode!.trim(), productId: productId ?? '' },
              })
            }
            accessibilityRole="button"
            accessibilityLabel="Paste ingredients manually"
          >
            <Text style={styles.actionBtnSecondaryText}>Paste ingredients</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  textCol: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
  },
  scoreOrb: {
    alignItems: 'center',
    minWidth: 40,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  scoreNum: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  scoreLbl: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#99f6e4',
  },
  actionBtnSecondary: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  actionBtnPressed: {
    opacity: 0.88,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f766e',
  },
  actionBtnSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
})
