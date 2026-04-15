import { storage } from './storage'

export const DISCLAIMER_ACK_KEY = 'disclaimer_acknowledged'
export const FIRST_SCAN_DISCLAIMER_KEY = 'first_scan_disclaimer_shown'

export async function isDisclaimerAcknowledged(): Promise<boolean> {
  const v = await storage.getItem(DISCLAIMER_ACK_KEY)
  return v === 'true'
}

export async function setDisclaimerAcknowledged(): Promise<void> {
  await storage.setItem(DISCLAIMER_ACK_KEY, 'true')
}

export async function isFirstScanDisclaimerShown(): Promise<boolean> {
  const v = await storage.getItem(FIRST_SCAN_DISCLAIMER_KEY)
  return v === 'true'
}

export async function setFirstScanDisclaimerShown(): Promise<void> {
  await storage.setItem(FIRST_SCAN_DISCLAIMER_KEY, 'true')
}

/** Call on sign-out so the next account must acknowledge again on this device. */
export async function clearDisclaimerKeysOnSignOut(): Promise<void> {
  await storage.removeItem(DISCLAIMER_ACK_KEY)
  await storage.removeItem(FIRST_SCAN_DISCLAIMER_KEY)
}
