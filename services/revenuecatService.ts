/**
 * RevenueCat purchases are not mirrored to Meta manually — iOS auto app events
 * (`FacebookAutoLogAppEventsEnabled`) logs App Store purchases/subscriptions/trials.
 */
import { Alert } from 'react-native'
import Purchases, { CustomerInfo, LOG_LEVEL } from 'react-native-purchases'
import { updatePremiumStatus } from '../store/scanStore'
import { trackScanResultMetric } from '../lib/scanResultMetrics'

const ENTITLEMENT_ID = 'premium'
let revenueCatConfigured = false

function isPremiumFromInfo(info: CustomerInfo): boolean {
  return info.entitlements.active[ENTITLEMENT_ID] !== undefined
}

function isUnconfiguredPurchasesError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return (
    error.message.includes('There is no singleton instance') ||
    error.message.includes('configure Purchases')
  )
}

export function isRevenueCatConfigured(): boolean {
  return revenueCatConfigured
}

export async function syncPremiumStatusFromRevenueCat(): Promise<void> {
  if (!revenueCatConfigured) return
  try {
    const info = await Purchases.getCustomerInfo()
    await updatePremiumStatus(isPremiumFromInfo(info))
  } catch (e) {
    if (isUnconfiguredPurchasesError(e)) {
      revenueCatConfigured = false
      return
    }
    throw e
  }
}

export async function logInToRevenueCat(appUserId: string): Promise<void> {
  const uid = String(appUserId ?? '').trim()
  if (!uid) return
  if (!revenueCatConfigured) return
  try {
    const { customerInfo } = await Purchases.logIn(uid)
    await updatePremiumStatus(isPremiumFromInfo(customerInfo))
  } catch (e) {
    if (isUnconfiguredPurchasesError(e)) {
      revenueCatConfigured = false
      return
    }
    if (__DEV__) console.log('RevenueCat logIn failed:', e)
  }
}

export async function logOutOfRevenueCat(): Promise<void> {
  if (!revenueCatConfigured) {
    await updatePremiumStatus(false)
    return
  }
  try {
    const info = await Purchases.logOut()
    await updatePremiumStatus(isPremiumFromInfo(info))
  } catch (e) {
    if (isUnconfiguredPurchasesError(e)) {
      revenueCatConfigured = false
      await updatePremiumStatus(false)
      return
    }
    if (__DEV__) console.log('RevenueCat logOut failed:', e)
    await updatePremiumStatus(false)
  }
}

export async function initializeRevenueCat(): Promise<boolean> {
  const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
  if (!apiKey) {
    revenueCatConfigured = false
    if (__DEV__) console.log('Missing EXPO_PUBLIC_REVENUECAT_IOS_KEY')
    return false
  }
  try {
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG)
    }
    Purchases.configure({ apiKey })
    revenueCatConfigured = true
    try {
      await syncPremiumStatusFromRevenueCat()
    } catch (e) {
      if (__DEV__) console.log('RevenueCat sync after configure:', e)
    }
    return revenueCatConfigured
  } catch (e) {
    revenueCatConfigured = false
    if (__DEV__) {
      console.log(
        'RevenueCat not initialized (Expo Go needs a Test Store key, or use a development build).',
        e,
      )
    }
    return false
  }
}

export async function restorePurchases(): Promise<boolean> {
  void trackScanResultMetric({ name: 'restore_purchases_tapped' })
  if (!revenueCatConfigured) {
    void trackScanResultMetric({
      name: 'restore_purchases_failed',
      payload: { reason: 'revenuecat_unconfigured' },
    })
    Alert.alert('Unavailable', 'Subscription restore is not available in this build.')
    return false
  }
  try {
    const info = await Purchases.restorePurchases()
    const isPremium = isPremiumFromInfo(info)
    await updatePremiumStatus(isPremium)
    if (isPremium) {
      void trackScanResultMetric({ name: 'restore_purchases_succeeded' })
      Alert.alert('Restored!', 'Your Fillr Premium subscription has been restored.')
    } else {
      void trackScanResultMetric({ name: 'restore_purchases_no_entitlement' })
      Alert.alert('Nothing to restore', 'No active subscription found for this Apple ID.')
    }
    return isPremium
  } catch (e) {
    void trackScanResultMetric({
      name: 'restore_purchases_failed',
      payload: { reason: 'exception' },
    })
    if (__DEV__) console.log('Restore error:', e)
    Alert.alert('Error', 'Could not restore purchases. Try again.')
    return false
  }
}

