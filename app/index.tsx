import { Redirect } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useAuthStore } from '../store/authStore'
import { colors } from '../constants/theme'
import { buildDietaryProfileFromZustand } from '../lib/onboardingProfile'
import { isDisclaimerAcknowledged, setDisclaimerAcknowledged } from '../lib/disclaimerStorage'
import { hasServerDisclaimerAcknowledgment } from '../lib/userAcknowledgments'
import { reconcilePersistedAuthWithSupabase } from '../lib/reconcileAuthSession'
import {
  finalizeReferralBonusIfEligible,
  getReferralFinalizationPending,
} from '../lib/authService'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getUserProfileOrNull, saveUserProfile } = require('../store/userProfileStore.js') as {
  getUserProfileOrNull: () => Promise<{
    allergies: string[]
    sensitivities: string[]
    avoiding: string[]
    preferences: string[]
  } | null>
  saveUserProfile: (p: {
    allergies: string[]
    sensitivities: string[]
    avoiding: string[]
    preferences: string[]
    goal?: string
  }) => Promise<void>
}

/**
 * App entry: auth + onboarding routing, plus one-time migration when
 * `hasCompletedOnboarding` is true but the AsyncStorage profile key was never written (legacy).
 */
export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hasCompletedOnboarding = useAuthStore((s) => s.hasCompletedOnboarding)
  const [bootstrapped, setBootstrapped] = useState(false)
  const [disclaimerChecked, setDisclaimerChecked] = useState(false)
  const [hasDisclaimerAck, setHasDisclaimerAck] = useState(false)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      await new Promise<void>((resolve) => {
        if (useAuthStore.persist.hasHydrated()) {
          resolve()
          return
        }
        const unsub = useAuthStore.persist.onFinishHydration(() => {
          unsub()
          resolve()
        })
      })
      if (cancelled) return

      try {
        await reconcilePersistedAuthWithSupabase()
      } catch {
        // If reconciliation fails, keep persisted auth; routing still works offline-ish.
      }
      if (cancelled) return

      try {
        const authNow = useAuthStore.getState()
        if (authNow.userId) {
          const pending = await getReferralFinalizationPending()
          if (pending) {
            void finalizeReferralBonusIfEligible(authNow.userId).catch(() => {})
          }
        }
      } catch {
        // Non-fatal; pending retry can happen on next scan/app open.
      }

      try {
        const profile = await getUserProfileOrNull()
        const auth = useAuthStore.getState()
        // Returning users who finished onboarding before profile storage existed: backfill from Zustand.
        if (auth.isAuthenticated && auth.hasCompletedOnboarding && profile === null) {
          const migrated = buildDietaryProfileFromZustand()
          await saveUserProfile(migrated)
        }
      } catch {
        // Non-fatal; scans can still use Zustand fallback.
      }

      try {
        let ack = await isDisclaimerAcknowledged()
        const authNow = useAuthStore.getState()
        if (
          !ack &&
          !cancelled &&
          authNow.isAuthenticated &&
          authNow.userId
        ) {
          const serverAck = await hasServerDisclaimerAcknowledgment(authNow.userId)
          if (serverAck) {
            await setDisclaimerAcknowledged()
            ack = true
          }
        }
        if (!cancelled) {
          setHasDisclaimerAck(ack)
          setDisclaimerChecked(true)
        }
      } catch {
        if (!cancelled) {
          setHasDisclaimerAck(false)
          setDisclaimerChecked(true)
        }
      }
      if (!cancelled) setBootstrapped(true)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  if (!bootstrapped || !disclaimerChecked) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    )
  }

  if (!isAuthenticated) {
    return <Redirect href="/welcome" />
  }

  if (!hasCompletedOnboarding) {
    return <Redirect href="/onboarding" />
  }

  // Resume disclaimer if the app closed before the user tapped continue (right after email verify).
  if (!hasDisclaimerAck) {
    return <Redirect href="/onboarding/disclaimer" />
  }

  return <Redirect href="/(tabs)" />
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundLightGreen,
  },
})
