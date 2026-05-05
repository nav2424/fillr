import { useCallback, useMemo } from 'react'
import { View, StyleSheet, ActivityIndicator, Share } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { router } from 'expo-router'
import { useFonts } from 'expo-font'
import {
  DMSans_300Light,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans'
import { DMSerifDisplay_400Regular, DMSerifDisplay_400Regular_Italic } from '@expo-google-fonts/dm-serif-display'
import { HomeScreen } from '../../components/HomeScreen'
import { buildHomeScreenData, type HomeWatchlistCard } from '../../lib/buildHomeScreenData'
import { getFillrAppShareContent } from '../../lib/appStoreLinks'
import { shareReferralLink } from '../../lib/referrals'
import { useAuthStore } from '../../store/authStore'
import { useScanHistoryStore } from '../../store/scanHistoryStore'
import { useUserStore } from '../../store/userStore'
import { repairUserStoreSensitivitiesPreferencesFromDisk } from '../../lib/getUserProfileForScan'

export default function HomeTab() {
  const fullName = useAuthStore((s) => s.fullName)
  const scans = useScanHistoryStore((s) => s.scans)
  const allergies = useUserStore((s) => s.allergies)
  const sensitivities = useUserStore((s) => s.sensitivities)
  const preferences = useUserStore((s) => s.preferences)
  const goal = useUserStore((s) => s.goal)
  const celiacStrictGluten = useUserStore((s) => s.celiacStrictGluten)
  const referralCode = useUserStore((s) => s.referralCode)

  useFocusEffect(
    useCallback(() => {
      void repairUserStoreSensitivitiesPreferencesFromDisk()
    }, [])
  )

  const [fontsLoaded] = useFonts({
    DMSans_300Light,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMSerifDisplay_400Regular,
    DMSerifDisplay_400Regular_Italic,
  })

  const data = useMemo(
    () =>
      buildHomeScreenData(fullName, scans, {
        allergies,
        sensitivities,
        preferences,
        goalKey: goal ?? '',
        celiacStrictGluten,
      }),
    [fullName, scans, allergies, sensitivities, preferences, goal, celiacStrictGluten]
  )

  const onShareFillr = useCallback(async () => {
    try {
      if (referralCode?.trim()) {
        await shareReferralLink(referralCode.trim())
        return
      }
      const { message, url } = getFillrAppShareContent()
      await Share.share(url ? { message, url } : { message })
    } catch {
      /* user dismissed share sheet */
    }
  }, [referralCode])

  const onWatchlistCardPress = useCallback((_card: HomeWatchlistCard) => {
    router.push('/(tabs)/profile')
  }, [])

  if (!fontsLoaded) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    )
  }

  return (
    <HomeScreen
      {...data}
      fonts={{
        sansLight: 'DMSans_300Light',
        sans: 'DMSans_400Regular',
        sansMedium: 'DMSans_500Medium',
        sansSemiBold: 'DMSans_600SemiBold',
        sansBold: 'DMSans_700Bold',
        serif: 'DMSerifDisplay_400Regular',
        serifItalic: 'DMSerifDisplay_400Regular_Italic',
      }}
      onScanBarcode={() => router.push('/(tabs)/scan')}
      onAlertPress={(alertId) => {
        const sid = alertId.replace(/^(allergen-|unsafe-)/, '')
        const hit = scans.find((s) => s.id === sid)
        if (hit) router.push({ pathname: '/product/[id]', params: { id: hit.productId } })
      }}
      onRecentSeeAll={() => router.push('/(tabs)/history')}
      onRecentCardPress={(scanId) => {
        const hit = scans.find((s) => s.id === scanId)
        if (hit) router.push({ pathname: '/product/[id]', params: { id: hit.productId } })
      }}
      onShareFillr={onShareFillr}
      onManageWatchlist={() => router.push('/(tabs)/profile')}
      onWatchlistCardPress={onWatchlistCardPress}
    />
  )
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
