import { Stack, router } from 'expo-router'
import { useEffect } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Linking from 'expo-linking'
import Purchases, { CustomerInfo } from 'react-native-purchases'
import { colors } from '../constants/theme'
import { getRefFromUrl } from '../lib/referrals'
import { initializeRevenueCat, isRevenueCatConfigured } from '../services/revenuecatService'
import { updatePremiumStatus } from '../store/scanStore'
import { supabase } from '../lib/supabase'
import { registerScanLimitNotificationResponseHandler } from '../lib/scanLimitNotifications'

const queryClient = new QueryClient()

/** Auth, onboarding, and profile-store migration run in `app/index.tsx` before redirects. */
export default function RootLayout() {
  useEffect(() => {
    /** Keep auth tokens fresh when returning from background (Supabase RN guidance). */
    void supabase.auth.startAutoRefresh()
    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        void supabase.auth.startAutoRefresh()
      } else {
        void supabase.auth.stopAutoRefresh()
      }
    }
    const appSub = AppState.addEventListener('change', onAppState)

    let attachedCustomerInfoListener = false
    const onCustomerInfoUpdated = async (info: CustomerInfo) => {
      const isPremium = info.entitlements.active.premium !== undefined
      await updatePremiumStatus(isPremium)
      if (__DEV__) console.log('Premium status updated:', isPremium)
    }
    void (async () => {
      await initializeRevenueCat()
      if (isRevenueCatConfigured()) {
        Purchases.addCustomerInfoUpdateListener(onCustomerInfoUpdated)
        attachedCustomerInfoListener = true
      }
    })()

    const sub = Linking.addEventListener('url', ({ url }) => {
      const ref = getRefFromUrl(url)
      if (!ref) return
      router.push({ pathname: '/onboarding', params: { ref } })
    })
    return () => {
      appSub.remove()
      void supabase.auth.stopAutoRefresh()
      sub.remove()
      if (attachedCustomerInfoListener && isRevenueCatConfigured()) {
        Purchases.removeCustomerInfoUpdateListener(onCustomerInfoUpdated)
      }
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.backgroundLightGreen },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="welcome" options={{ contentStyle: { backgroundColor: '#FFFFFF' } }} />
      </Stack>
    </QueryClientProvider>
  )
}
