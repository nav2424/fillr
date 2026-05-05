import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { useAuthStore } from '../store/authStore'
import {
  fetchProfileReliable,
  resolveDisplayFullName,
  setOnboardingCompletedOnServer,
  signOutSupabase,
} from './authService'
import { clearPendingSignupAfterOnboarding } from './pendingSignup'
import { logInToRevenueCat, logOutOfRevenueCat } from '../services/revenuecatService'
import { useUserStore } from '../store/userStore'

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * Session can lag one tick right after `signInWithPassword`; don’t sign the user out on that frame.
 */
async function getSessionWithRetry(whenAuthenticated: boolean): Promise<Session | null> {
  let session = (await supabase.auth.getSession()).data.session
  if (!whenAuthenticated || session?.user?.id) {
    return session
  }
  for (let i = 0; i < 10; i++) {
    await sleep(45 + i * 45)
    session = (await supabase.auth.getSession()).data.session
    if (session?.user?.id) break
  }
  return session
}

/**
 * Align persisted auth with Supabase: drop stale "logged in" state with no session,
 * and restore zustand when a session exists but persist was cleared.
 */
export async function reconcilePersistedAuthWithSupabase(): Promise<void> {
  const state = useAuthStore.getState()
  const session = await getSessionWithRetry(state.isAuthenticated)
  const supaUid = session?.user?.id ?? null

  if (state.isAuthenticated) {
    if (!supaUid || !state.userId || state.userId !== supaUid) {
      await logOutOfRevenueCat()
      await signOutSupabase()
      await clearPendingSignupAfterOnboarding()
      useUserStore.getState().resetForAccountDeletion()
      state.signOut()
    }
    return
  }

  const user = session?.user
  if (supaUid && user) {
    const profile = await fetchProfileReliable(supaUid)
    const email = user.email ?? profile?.email ?? ''
    const fullName = resolveDisplayFullName(profile, user)
    state.setAuth({ id: supaUid, email, fullName })
    const emailVerified = Boolean(user.email_confirmed_at)
    const onboardingDone =
      profile?.onboarding_completed === true ||
      (emailVerified && profile != null && Boolean(profile.id))
    if (onboardingDone && profile && profile.onboarding_completed !== true) {
      void setOnboardingCompletedOnServer(supaUid)
    }
    state.setOnboardingFromServer(onboardingDone)
    void logInToRevenueCat(supaUid)
  }
}
