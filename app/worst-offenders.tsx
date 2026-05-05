import { useCallback, useLayoutEffect, useState } from 'react'
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, router, useNavigation } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { useFonts } from 'expo-font'
import {
  DMSans_300Light,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans'
import { DMSerifDisplay_400Regular, DMSerifDisplay_400Regular_Italic } from '@expo-google-fonts/dm-serif-display'
import { GradientBackground, EmptyState, StackBackButton } from '../components'
import { WorstOffenderRow } from '../components/WorstOffenderRow'
import { colors, spacing, homeWordmarkLayout } from '../constants/theme'
import { formatWeekRangeChip } from '../lib/buildHomeScreenData'
import {
  fetchGlobalWorstOffendersForHome,
  type GlobalWorstOffendersPack,
} from '../lib/fetchGlobalWorstOffendersForHome'
import { useScanHistoryStore } from '../store/scanHistoryStore'

const LIGHT_GREEN = colors.backgroundLightGreen

const stackScreenOptions = {
  title: 'Worst offenders',
  headerShown: true,
  headerStyle: { backgroundColor: LIGHT_GREEN },
  headerShadowVisible: false,
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '700' as const, color: colors.text },
  headerBackVisible: false,
  headerLeft: () => <StackBackButton />,
}

const INK = '#0a2810'

export default function WorstOffendersScreen() {
  const navigation = useNavigation()
  const scans = useScanHistoryStore((s) => s.scans)
  const [pack, setPack] = useState<GlobalWorstOffendersPack | null>(null)
  const [loading, setLoading] = useState(true)

  const [fontsLoaded] = useFonts({
    DMSans_300Light,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMSerifDisplay_400Regular,
    DMSerifDisplay_400Regular_Italic,
  })

  useLayoutEffect(() => {
    navigation.setOptions(stackScreenOptions)
  }, [navigation])

  useFocusEffect(
    useCallback(() => {
      let alive = true
      setLoading(true)
      void (async () => {
        const next = await fetchGlobalWorstOffendersForHome(scans, { limit: 50 })
        if (alive) {
          setPack(next)
          setLoading(false)
        }
      })()
      return () => {
        alive = false
      }
    }, [scans])
  )

  const fonts = {
    sansSemiBold: 'DMSans_600SemiBold',
    sans: 'DMSans_400Regular',
    serif: 'DMSerifDisplay_400Regular',
  }

  const weekRange = formatWeekRangeChip()
  const headline =
    pack?.source === 'personal_fallback' ? 'Most often in your scans' : 'Most flagged across Fillr'
  const rows = pack?.rows ?? []

  if (!fontsLoaded) {
    return (
      <>
        <Stack.Screen options={stackScreenOptions} />
        <View style={styles.boot}>
          <ActivityIndicator size="large" color="#16a34a" />
        </View>
      </>
    )
  }

  if (loading || !pack) {
    return (
      <>
        <Stack.Screen options={stackScreenOptions} />
        <GradientBackground variant="home">
          <SafeAreaView style={styles.screen} edges={['bottom']}>
            <View style={styles.boot}>
              <ActivityIndicator size="large" color="#16a34a" />
            </View>
          </SafeAreaView>
        </GradientBackground>
      </>
    )
  }

  if (rows.length === 0) {
    return (
      <>
        <Stack.Screen options={stackScreenOptions} />
        <GradientBackground variant="home">
          <SafeAreaView style={styles.screen} edges={['bottom']}>
            <EmptyState
              icon="leaf-outline"
              title="Nothing on the watchlist"
              subtitle="No concerning or avoid ingredients showed up for this week yet. Scan a product to build your list."
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
      <Stack.Screen options={stackScreenOptions} />
      <GradientBackground variant="home">
        <SafeAreaView style={styles.screen} edges={['bottom']}>
          <FlatList
            data={rows}
            keyExtractor={(item) => `${item.rank}-${item.ingredientName}`}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListHeaderComponent={
              <View style={styles.listHeader}>
                <Text style={[styles.eyebrow, { fontFamily: fonts.sansSemiBold }]}>{'THIS WEEK\'S WATCHLIST'}</Text>
                <View style={styles.titleRow}>
                  <Text style={[styles.title, { fontFamily: fonts.serif }]}>{headline}</Text>
                  <View style={styles.weekChip}>
                    <Text style={[styles.weekChipText, { fontFamily: 'DMSans_500Medium' }]}>{weekRange}</Text>
                  </View>
                </View>
              </View>
            }
            renderItem={({ item }) => <WorstOffenderRow row={item} fonts={fonts} />}
          />
        </SafeAreaView>
      </GradientBackground>
    </>
  )
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: LIGHT_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screen: { flex: 1 },
  listContent: {
    paddingHorizontal: homeWordmarkLayout.horizontalPad,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl * 2,
  },
  listHeader: {
    marginBottom: spacing.lg,
  },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 2,
    color: 'rgba(10,40,18,0.38)',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 20,
    color: INK,
    flex: 1,
    minWidth: 120,
    lineHeight: 26,
  },
  weekChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(10,40,18,0.06)',
  },
  weekChipText: { fontSize: 11, color: 'rgba(10,40,18,0.55)' },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(10,40,18,0.1)',
    marginVertical: 0,
  },
})
