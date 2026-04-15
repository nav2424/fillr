import { storage } from './storage'

const KEY = 'fillr-post-onboarding-signup'

/** Set after finishing onboarding questions, before the account screen. */
export async function setPendingSignupAfterOnboarding(): Promise<void> {
  await storage.setItem(KEY, 'true')
}

export async function clearPendingSignupAfterOnboarding(): Promise<void> {
  await storage.removeItem(KEY)
}

export async function isPendingSignupAfterOnboarding(): Promise<boolean> {
  return (await storage.getItem(KEY)) === 'true'
}
