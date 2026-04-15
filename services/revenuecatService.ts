import { Alert } from 'react-native'
import Purchases, { CustomerInfo, LOG_LEVEL } from 'react-native-purchases'
import { updatePremiumStatus } from '../store/scanStore'

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

export async function initializeRevenueCat(): Promise<boolean> {
  const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
  if (!apiKey) {
    revenueCatConfigured = false
    if (__DEV__) console.log('Missing EXPO_PUBLIC_REVENUECAT_IOS_KEY')
    return false
  }
  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG)
  }
  Purchases.configure({ apiKey })
  revenueCatConfigured = true
  try {
    await syncPremiumStatusFromRevenueCat()
  } catch (e) {
    if (__DEV__) console.log('RevenueCat init error:', e)
  }
  return revenueCatConfigured
}

export async function restorePurchases(): Promise<boolean> {
  if (!revenueCatConfigured) {
    Alert.alert('Unavailable', 'Subscription restore is not available in this build.')
    return false
  }
  try {
    const info = await Purchases.restorePurchases()
    const isPremium = isPremiumFromInfo(info)
    await updatePremiumStatus(isPremium)
    if (isPremium) {
      Alert.alert('Restored!', 'Your Fillr Premium subscription has been restored.')
    } else {
      Alert.alert('Nothing to restore', 'No active subscription found for this Apple ID.')
    }
    return isPremium
  } catch (e) {
    if (__DEV__) console.log('Restore error:', e)
    Alert.alert('Error', 'Could not restore purchases. Try again.')
    return false
  }
}

