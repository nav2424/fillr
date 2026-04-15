import { useLayoutEffect, useMemo } from 'react'
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Stack, router, useNavigation } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { GradientBackground, EmptyState, StackBackButton } from '../components'
import { colors, spacing, typography, radius } from '../constants/theme'
import { useScanHistoryStore } from '../store/scanHistoryStore'
import type { ScanRecord } from '../store/scanHistoryStore'
import { formatProductTitle } from '../lib/formatProductTitle'
import type { SafetyStatus } from '../types'

const LIGHT_GREEN = colors.backgroundLightGreen

const savedStackScreenOptions = {
  title: 'Saved',
  headerShown: true,
  headerStyle: { backgroundColor: LIGHT_GREEN },
  headerShadowVisible: false,
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '700' as const, color: colors.text },
  headerBackVisible: false,
  headerLeft: () => <StackBackButton />,
}

const STATUS: Record<
  SafetyStatus,
  { color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  SAFE: { color: colors.safe, bg: colors.safeMuted, icon: 'checkmark-circle' },
  CAUTION: { color: colors.caution, bg: colors.cautionMuted, icon: 'alert-circle' },
  UNSAFE: { color: colors.danger, bg: colors.dangerMuted, icon: 'close-circle' },
  UNKNOWN: { color: colors.unknown, bg: colors.unknownMuted, icon: 'help-circle' },
}

function formatSavedDate(raw: string): string {
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function SavedRow({ item }: { item: ScanRecord }) {
  const st = STATUS[item.safetyStatus] ?? STATUS.UNKNOWN

  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: '/product/[id]', params: { id: item.productId } })
      }
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.heartWell}>
        <Ionicons name="heart" size={20} color={colors.accent} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.productName} numberOfLines={2}>
          {formatProductTitle(item.productName)}
        </Text>
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
          <Text style={styles.metaText}>{formatSavedDate(item.date)}</Text>
        </View>
      </View>
      <View style={[styles.badge, { backgroundColor: st.bg }]}>
        <Ionicons name={st.icon} size={13} color={st.color} />
        <Text style={[styles.badgeLabel, { color: st.color }]}>{item.safetyStatus}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  )
}

export default function SavedScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { scans, savedProductIds } = useScanHistoryStore()
  const savedScans = useMemo(
    () => scans.filter((s) => savedProductIds.includes(s.productId)),
    [scans, savedProductIds]
  )
  const bottomPad = insets.bottom + spacing.xl

  useLayoutEffect(() => {
    navigation.setOptions(savedStackScreenOptions)
  }, [navigation])

  if (savedScans.length === 0) {
    return (
      <>
        <Stack.Screen options={savedStackScreenOptions} />
        <GradientBackground variant="home">
          <SafeAreaView style={styles.screen} edges={['bottom']}>
            <EmptyState
              icon="heart-outline"
              title="No saved products"
              subtitle="Tap Save on a product to keep it here for quick access."
              actionLabel="Scan a product"
              onAction={() => router.push('/(tabs)/scan')}
            />
          </SafeAreaView>
        </GradientBackground>
      </>
    )
  }

  return (
    <>
      <Stack.Screen options={savedStackScreenOptions} />
      <GradientBackground variant="home">
        <SafeAreaView style={styles.screen} edges={['bottom']}>
          <FlatList
            data={savedScans}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={
              <View style={styles.listIntro}>
                <Text style={styles.introEyebrow}>Saved for later</Text>
                <Text style={styles.introLine}>
                  {savedScans.length} product{savedScans.length === 1 ? '' : 's'} · tap to open
                </Text>
              </View>
            }
            contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.gap} />}
            renderItem={({ item }) => <SavedRow item={item} />}
          />
        </SafeAreaView>
      </GradientBackground>
    </>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  list: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
  },
  listIntro: {
    marginBottom: spacing.lg,
  },
  introEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  introLine: {
    ...typography.bodySmall,
    fontWeight: '500',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  gap: {
    height: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
    gap: spacing.md,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  heartWell: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 22,
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 7,
    borderRadius: 12,
  },
  badgeLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
})
