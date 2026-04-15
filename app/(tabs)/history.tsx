import { useMemo } from 'react'
import { View, Text, StyleSheet, SectionList, Pressable } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { GradientBackground } from '../../components'
import { router } from 'expo-router'
import { EmptyState } from '../../components'
import { colors, spacing, typography, radius } from '../../constants/theme'
import { useScanHistoryStore } from '../../store/scanHistoryStore'
import type { ScanRecord } from '../../store/scanHistoryStore'
import { formatHistoryListTitle } from '../../lib/historyDisplayLabel'
import { resolveSafetyStatusWithCeliac } from '../../lib/personalizationEngine'
import { useUserStore } from '../../store/userStore'
import type { SafetyStatus } from '../../types'

const STATUS_COLOR: Record<SafetyStatus, string> = {
  SAFE: colors.safe,
  CAUTION: colors.caution,
  UNSAFE: colors.danger,
  UNKNOWN: colors.unknown,
}

const STATUS_MUTED: Record<SafetyStatus, string> = {
  SAFE: colors.safeMuted,
  CAUTION: colors.cautionMuted,
  UNSAFE: colors.dangerMuted,
  UNKNOWN: colors.unknownMuted,
}

const STATUS_LABEL: Record<SafetyStatus, string> = {
  SAFE: 'Safe',
  CAUTION: 'Caution',
  UNSAFE: 'Not safe',
  UNKNOWN: 'Unknown',
}

type HistorySection = {
  title: string
  data: ScanRecord[]
  showTimeForRows: boolean
  sectionIndex: number
}

function startOfDayMs(d: Date): number {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

function formatSectionTitle(dayMs: number): string {
  const today = startOfDayMs(new Date())
  const yest = new Date(today)
  yest.setDate(yest.getDate() - 1)
  if (dayMs === today) return 'Today'
  if (dayMs === yest.getTime()) return 'Yesterday'
  return new Date(dayMs).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatRowTime(raw: string): string {
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function formatRowDate(raw: string): string {
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function buildSections(scans: ScanRecord[]): HistorySection[] {
  const byDay = new Map<number, ScanRecord[]>()
  const invalid: ScanRecord[] = []

  for (const s of scans) {
    const d = new Date(s.date)
    if (Number.isNaN(d.getTime())) {
      invalid.push(s)
      continue
    }
    const k = startOfDayMs(d)
    if (!byDay.has(k)) byDay.set(k, [])
    byDay.get(k)!.push(s)
  }

  const days = [...byDay.keys()].sort((a, b) => b - a)
  let idx = 0
  const sections: HistorySection[] = days.map((k) => ({
    title: formatSectionTitle(k),
    data: byDay.get(k)!,
    showTimeForRows: true,
    sectionIndex: idx++,
  }))

  if (invalid.length > 0) {
    sections.push({
      title: 'Unknown date',
      data: invalid,
      showTimeForRows: false,
      sectionIndex: idx,
    })
  }

  return sections
}

function Row({ item, detail }: { item: ScanRecord; detail: string }) {
  const celiacStrictGluten = useUserStore((s) => s.celiacStrictGluten)
  const status = resolveSafetyStatusWithCeliac(item.safetyStatus, { celiacStrictGluten }, item.result?.celiac)
  const color = STATUS_COLOR[status] ?? STATUS_COLOR.UNKNOWN
  const pillBg = STATUS_MUTED[status] ?? STATUS_MUTED.UNKNOWN

  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: '/product/[id]', params: { id: item.productId } })
      }
      style={({ pressed }) => [styles.rowOuter, pressed && styles.rowPressed]}
    >
      <View style={styles.rowCard}>
        <View style={[styles.statusStripe, { backgroundColor: color }]} />
        <View style={styles.rowIconWrap}>
          <Ionicons
            name={item.source === 'ocr' ? 'camera' : 'barcode-outline'}
            size={18}
            color={colors.textMuted}
          />
        </View>
        <View style={styles.rowMain}>
          <View style={styles.rowBody}>
            <Text style={styles.productName} numberOfLines={2}>
              {formatHistoryListTitle(item.productName, item.date, item.source)}
            </Text>
            <Text style={styles.date}>{detail}</Text>
          </View>
          <View style={styles.rowMeta}>
            <View style={[styles.statusPill, { backgroundColor: pillBg }]}>
              <Text style={[styles.statusPillText, { color }]}>{STATUS_LABEL[status]}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </View>
        </View>
      </View>
    </Pressable>
  )
}

function SectionHeader({ title, isFirst }: { title: string; isFirst: boolean }) {
  return (
    <View style={[styles.sectionHeader, isFirst && styles.sectionHeaderFirst]}>
      <Text style={styles.sectionLabel}>{title}</Text>
    </View>
  )
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets()
  const scans = useScanHistoryStore((state) => state.scans)
  const bottomPad = insets.bottom + spacing.xxxl * 2.5
  const sections = useMemo(() => buildSections(scans), [scans])

  if (scans.length === 0) {
    return (
      <GradientBackground variant="home">
        <SafeAreaView style={styles.screen} edges={['bottom']}>
          <EmptyState
            icon="barcode-outline"
            title="No scans yet"
            subtitle="Scan a barcode and we’ll match it to your allergies."
            actionLabel="Scan now"
            onAction={() => router.push('/(tabs)/scan')}
          />
        </SafeAreaView>
      </GradientBackground>
    )
  }

  return (
    <GradientBackground variant="home">
      <SafeAreaView style={styles.screen} edges={['bottom']}>
        <SectionList<ScanRecord, HistorySection>
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) => (
            <SectionHeader title={section.title} isFirst={section.sectionIndex === 0} />
          )}
          renderItem={({ item, section }) => (
            <Row
              item={item}
              detail={section.showTimeForRows ? formatRowTime(item.date) : formatRowDate(item.date)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.rowSpacer} />}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
        />
      </SafeAreaView>
    </GradientBackground>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
  sectionHeader: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    paddingHorizontal: 2,
  },
  sectionHeaderFirst: {
    paddingTop: spacing.sm,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    opacity: 0.9,
  },
  rowSpacer: {
    height: spacing.md,
  },
  rowOuter: {
    borderRadius: radius.lg,
  },
  rowPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.992 }],
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statusStripe: {
    width: 4,
  },
  rowIconWrap: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: spacing.sm,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md + 2,
    paddingRight: spacing.md,
    paddingLeft: spacing.sm,
    gap: spacing.sm,
    minHeight: 76,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  productName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 5,
    lineHeight: 23,
    letterSpacing: -0.2,
  },
  date: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '500',
    opacity: 0.92,
  },
})
