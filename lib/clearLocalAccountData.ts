/**
 * Shared local wipe used by sign-out, account delete, and stale-session reconcile.
 * Keeps call sites from forgetting AsyncStorage keys that personalize scans.
 */

import { clearDisclaimerKeysOnSignOut } from './disclaimerStorage'
import { clearPendingSignupAfterOnboarding } from './pendingSignup'
import { useScanHistoryStore } from '../store/scanHistoryStore'
import { useUserStore } from '../store/userStore'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { clearUserProfile } = require('../store/userProfileStore.js') as {
  clearUserProfile: () => Promise<void>
}

export type ClearLocalAccountDataOptions = {
  /** When false, leave local scan history (used by reconcile of stale auth). Default true. */
  clearScanHistory?: boolean
}

/**
 * Clears device-local account personalization. Does not touch Supabase auth/session.
 */
export async function clearLocalAccountData(
  options: ClearLocalAccountDataOptions = {}
): Promise<void> {
  const clearScanHistory = options.clearScanHistory !== false
  await clearDisclaimerKeysOnSignOut()
  await clearPendingSignupAfterOnboarding()
  await clearUserProfile()
  useUserStore.getState().resetForAccountDeletion()
  if (clearScanHistory) {
    useScanHistoryStore.getState().clearAll()
  }
}
