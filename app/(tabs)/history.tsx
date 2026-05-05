import { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  Pressable,
  Platform,
  TextInput,
  ScrollView,
  Keyboard,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import { useFonts } from 'expo-font'
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans'
import { router } from 'expo-router'
import { EmptyState } from '../../components'
import { colors, homeWordmarkLayout, spacing } from '../../constants/theme'
import { useScanHistoryStore } from '../../store/scanHistoryStore'
import type { ScanRecord } from '../../store/scanHistoryStore'
import { formatHistoryListTitle } from '../../lib/historyDisplayLabel'
import { parseScanHistoryDate, scanHistoryRecordHasReliableTime } from '../../lib/parseScanHistoryDate'
import { resolveSafetyStatusWithCeliac } from '../../lib/personalizationEngine'
import { useUserStore } from '../../store/userStore'
import type { SafetyStatus } from '../../types'

const BG = '#ffffff'
const INK = '#0f172a'
const GREEN = colors.accent
const GREEN_DEEP = '#15803d'
const MUTED = '#64748b'
const MUTED_SOFT = '#475569'
const LINE = 'rgba(15, 23, 42, 0.08)'
const CARD_FILL = '#fafafa'

type HistoryFonts = {
  sans: string
  sansMedium: string
  sansSemiBold: string
  sansBold: string
}

const HISTORY_FONTS: HistoryFonts = {
  sans: 'DMSans_400Regular',
  sansMedium: 'DMSans_500Medium',
  sansSemiBold: 'DMSans_600SemiBold',
  sansBold: 'DMSans_700Bold',
}

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

type StatusFilter = 'all' | SafetyStatus

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

function formatRowTime(raw: string): string | null {
  if (!scanHistoryRecordHasReliableTime(raw)) return null
  const d = parseScanHistoryDate(raw)
  if (!d) return null
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function formatRowDate(raw: string): string {
  const d = parseScanHistoryDate(raw)
  if (!d) return raw
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function scanMatchesSearch(scan: ScanRecord, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase()
  if (!q) return true
  const name = (scan.productName ?? '').toLowerCase()
  const title = formatHistoryListTitle(scan.productName, scan.date, scan.source).toLowerCase()
  const barcode = (scan.barcode ?? '').toLowerCase().replace(/\s/g, '')
  const qCompact = q.replace(/\s/g, '')
  const qDigits = q.replace(/\D/g, '')
  const bcDigits = barcode.replace(/\D/g, '')
  if (name.includes(q)) return true
  if (title.includes(q)) return true
  if (barcode.includes(qCompact)) return true
  if (qDigits.length >= 3 && bcDigits.includes(qDigits)) return true
  return false
}

function filterScans(
  scans: ScanRecord[],
  query: string,
  statusFilter: StatusFilter,
  savedOnly: boolean,
  savedIds: string[],
  celiacStrictGluten: boolean
): ScanRecord[] {
  return scans.filter((scan) => {
    if (!scanMatchesSearch(scan, query)) return false
    if (savedOnly && !savedIds.includes(scan.productId)) return false
    if (statusFilter !== 'all') {
      const resolved = resolveSafetyStatusWithCeliac(
        scan.safetyStatus,
        { celiacStrictGluten },
        scan.result?.celiac
      )
      if (resolved !== statusFilter) return false
    }
    return true
  })
}

function buildSections(scans: ScanRecord[]): HistorySection[] {
  const byDay = new Map<number, ScanRecord[]>()
  const invalid: ScanRecord[] = []

  for (const s of scans) {
    const d = parseScanHistoryDate(s.date)
    if (!d) {
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

function FilterChip({
  label,
  selected,
  onPress,
  fonts,
}: {
  label: string
  selected: boolean
  onPress: () => void
  fonts: HistoryFonts
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && { opacity: 0.88 }]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipText, { fontFamily: fonts.sansSemiBold }, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  )
}

function Row({ item, detail, fonts }: { item: ScanRecord; detail: string | null; fonts: HistoryFonts }) {
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
        <View
          style={[
            styles.statusStripe,
            { backgroundColor: color, borderTopLeftRadius: 18, borderBottomLeftRadius: 18 },
          ]}
        />
        <View style={styles.rowIconWrap}>
          <Ionicons
            name={item.source === 'ocr' ? 'camera' : 'barcode-outline'}
            size={18}
            color={MUTED}
          />
        </View>
        <View style={styles.rowMain}>
          <View style={styles.rowBody}>
            <Text style={[styles.productName, { fontFamily: fonts.sansSemiBold }]} numberOfLines={2}>
              {formatHistoryListTitle(item.productName, item.date, item.source)}
            </Text>
            {detail ? (
              <Text style={[styles.date, { fontFamily: fonts.sans }]}>{detail}</Text>
            ) : null}
          </View>
          <View style={styles.rowMeta}>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: pillBg, borderColor: `${color}40` },
              ]}
            >
              <Text style={[styles.statusPillText, { color, fontFamily: fonts.sansBold }]}>{STATUS_LABEL[status]}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={MUTED} />
          </View>
        </View>
      </View>
    </Pressable>
  )
}

function SectionHeader({ title, isFirst, fonts }: { title: string; isFirst: boolean; fonts: HistoryFonts }) {
  return (
    <View style={[styles.sectionHeader, isFirst && styles.sectionHeaderFirst]}>
      <Text style={[styles.sectionLabel, { fontFamily: fonts.sansSemiBold }]}>{title}</Text>
    </View>
  )
}

function ListEmptyFiltered({ onClear, fonts }: { onClear: () => void; fonts: HistoryFonts }) {
  return (
    <View style={styles.filteredEmpty}>
      <View style={styles.filteredEmptyIcon}>
        <Ionicons name="search-outline" size={28} color={MUTED} />
      </View>
      <Text style={[styles.filteredEmptyTitle, { fontFamily: fonts.sansBold }]}>No matching scans</Text>
      <Text style={[styles.filteredEmptySub, { fontFamily: fonts.sans }]}>Try another search or loosen your filters.</Text>
      <Pressable onPress={onClear} style={({ pressed }) => [styles.clearFiltersBtn, pressed && { opacity: 0.9 }]}>
        <Text style={[styles.clearFiltersBtnText, { fontFamily: fonts.sansSemiBold }]}>Clear search & filters</Text>
      </Pressable>
    </View>
  )
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets()
  const tabBarHeight = useBottomTabBarHeight()
  const scans = useScanHistoryStore((state) => state.scans)
  const savedProductIds = useScanHistoryStore((state) => state.savedProductIds)
  const celiacStrictGluten = useUserStore((s) => s.celiacStrictGluten)

  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  })

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [savedOnly, setSavedOnly] = useState(false)

  const bottomPad = tabBarHeight + insets.bottom + 24
  const padLeft = Math.max(homeWordmarkLayout.horizontalPad, insets.left)
  const padRight = Math.max(homeWordmarkLayout.horizontalPad, insets.right)

  const filteredScans = useMemo(
    () => filterScans(scans, query, statusFilter, savedOnly, savedProductIds, celiacStrictGluten),
    [scans, query, statusFilter, savedOnly, savedProductIds, celiacStrictGluten]
  )

  const sections = useMemo(() => buildSections(filteredScans), [filteredScans])

  const hasActiveFilters = query.trim().length > 0 || statusFilter !== 'all' || savedOnly

  const clearFilters = useCallback(() => {
    setQuery('')
    setStatusFilter('all')
    setSavedOnly(false)
    Keyboard.dismiss()
  }, [])

  const listHeader = useMemo(
    () => (
      <View style={styles.listHeader}>
        <View style={styles.searchShell}>
          <Ionicons name="search" size={18} color={MUTED} style={styles.searchIcon} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search product"
            placeholderTextColor={MUTED}
            style={[styles.searchInput, { fontFamily: HISTORY_FONTS.sans }]}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="never"
            accessibilityLabel="Search scan history"
          />
          {query.length > 0 ? (
            <Pressable
              onPress={() => setQuery('')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={20} color={MUTED} />
            </Pressable>
          ) : null}
        </View>

        {hasActiveFilters ? (
          <Pressable onPress={clearFilters} style={styles.resetRow} hitSlop={6}>
            <Text style={[styles.resetText, { fontFamily: HISTORY_FONTS.sansSemiBold }]}>Clear all</Text>
            <Ionicons name="refresh-outline" size={16} color={GREEN} />
          </Pressable>
        ) : null}

        <Text style={[styles.filterGroupLabel, { fontFamily: HISTORY_FONTS.sansSemiBold }]}>Filters</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          keyboardShouldPersistTaps="handled"
        >
          <FilterChip
            label="All"
            selected={statusFilter === 'all'}
            onPress={() => setStatusFilter('all')}
            fonts={HISTORY_FONTS}
          />
          {(['SAFE', 'CAUTION', 'UNSAFE', 'UNKNOWN'] as const).map((key) => (
            <FilterChip
              key={key}
              label={STATUS_LABEL[key]}
              selected={statusFilter === key}
              onPress={() => setStatusFilter((prev) => (prev === key ? 'all' : key))}
              fonts={HISTORY_FONTS}
            />
          ))}
          <FilterChip label="Saved only" selected={savedOnly} onPress={() => setSavedOnly((s) => !s)} fonts={HISTORY_FONTS} />
        </ScrollView>
      </View>
    ),
    [query, statusFilter, savedOnly, hasActiveFilters, clearFilters]
  )

  if (!fontsLoaded) {
    return (
      <View style={[styles.screen, styles.boot]}>
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    )
  }

  if (scans.length === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: BG }]}>
        <SafeAreaView style={styles.screenInner} edges={['bottom']}>
          <View style={[styles.emptyWrap, { paddingLeft: padLeft, paddingRight: padRight }]}>
            <EmptyState
              icon="barcode-outline"
              title="No scans yet"
              subtitle="Scan a barcode and we’ll match it to your allergies."
              actionLabel="Scan now"
              onAction={() => router.push('/(tabs)/scan')}
            />
          </View>
        </SafeAreaView>
      </View>
    )
  }

  return (
    <View style={[styles.screen, { backgroundColor: BG }]}>
      <SafeAreaView style={styles.screenInner} edges={['bottom']}>
        <SectionList<ScanRecord, HistorySection>
          sections={sections}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={listHeader}
          renderSectionHeader={({ section }) => (
            <SectionHeader title={section.title} isFirst={section.sectionIndex === 0} fonts={HISTORY_FONTS} />
          )}
          renderItem={({ item, section }) => (
            <Row
              item={item}
              detail={
                section.showTimeForRows
                  ? formatRowTime(item.date) ?? null
                  : formatRowDate(item.date)
              }
              fonts={HISTORY_FONTS}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.rowSpacer} />}
          ListEmptyComponent={
            filteredScans.length === 0 && scans.length > 0 ? (
              <ListEmptyFiltered onClear={clearFilters} fonts={HISTORY_FONTS} />
            ) : null
          }
          contentContainerStyle={[
            styles.list,
            {
              paddingBottom: bottomPad,
              paddingLeft: padLeft,
              paddingRight: padRight,
            },
            sections.length === 0 && styles.listEmptyGrow,
          ]}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={Keyboard.dismiss}
        />
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  screenInner: {
    flex: 1,
  },
  boot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  list: {
    paddingTop: spacing.sm,
  },
  listEmptyGrow: {
    flexGrow: 1,
  },
  listHeader: {
    paddingBottom: spacing.md,
  },
  searchShell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: CARD_FILL,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    marginBottom: spacing.sm,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: INK,
    paddingVertical: Platform.OS === 'android' ? 4 : 0,
  },
  resetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    marginBottom: spacing.sm,
  },
  resetText: {
    fontSize: 13,
    color: GREEN_DEEP,
  },
  filterGroupLabel: {
    fontSize: 17,
    color: INK,
    letterSpacing: -0.3,
    marginBottom: 8,
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 10,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: BG,
  },
  chipSelected: {
    borderColor: 'rgba(34, 197, 94, 0.35)',
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
  },
  chipText: {
    fontSize: 13,
    color: MUTED,
  },
  chipTextSelected: {
    color: INK,
  },
  filteredEmpty: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 16,
  },
  filteredEmptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: CARD_FILL,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  filteredEmptyTitle: {
    fontSize: 17,
    color: INK,
    marginBottom: 6,
  },
  filteredEmptySub: {
    fontSize: 14,
    color: MUTED,
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 20,
  },
  clearFiltersBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.22)',
  },
  clearFiltersBtnText: {
    fontSize: 14,
    color: GREEN_DEEP,
  },
  sectionHeader: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    paddingHorizontal: 2,
  },
  sectionHeaderFirst: {
    paddingTop: spacing.xs,
  },
  sectionLabel: {
    fontSize: 12,
    color: MUTED,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  rowSpacer: {
    height: 10,
  },
  rowOuter: {
    borderRadius: 18,
  },
  rowPressed: {
    opacity: 0.92,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 18,
    overflow: 'hidden',
    minHeight: 76,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: CARD_FILL,
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
    }),
  },
  statusStripe: {
    width: 4,
    zIndex: 1,
  },
  rowIconWrap: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: spacing.sm,
    zIndex: 3,
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
    zIndex: 3,
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
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statusPillText: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
  productName: {
    fontSize: 15,
    color: INK,
    marginBottom: 5,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  date: {
    fontSize: 13,
    color: MUTED,
  },
})
