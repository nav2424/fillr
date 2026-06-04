import { Platform } from 'react-native'

type MetaEventParams = Record<string, string | number>

const isIOS = Platform.OS === 'ios'

/**
 * Initializes Meta App Events SDK for iOS app lifecycle attribution.
 */
export async function initializeMetaAppEvents(): Promise<void> {
  if (!isIOS) return

  const { requestTrackingPermissionsAsync } = await import('expo-tracking-transparency')
  const { Settings } = await import('react-native-fbsdk-next')

  const { status } = await requestTrackingPermissionsAsync()
  Settings.initializeSDK()
  await Settings.setAdvertiserTrackingEnabled(status === 'granted')
}

/**
 * Manual purchase logging. Do not call while `FacebookAutoLogAppEventsEnabled` is true —
 * Meta auto-logs App Store purchases/subscriptions/trials and duplicates will skew attribution.
 * Use only if auto-log is turned off and RevenueCat confirms the transaction.
 */
export async function logMetaPurchase(amount: number, currency = 'USD'): Promise<void> {
  if (!isIOS) return
  const { AppEventsLogger } = await import('react-native-fbsdk-next')
  AppEventsLogger.logPurchase(amount, currency)
}

/**
 * Signup / account creation — not auto-captured by Meta; call once after successful registration.
 */
export async function logMetaCompletedRegistration(): Promise<void> {
  if (!isIOS) return
  const { AppEventsLogger } = await import('react-native-fbsdk-next')
  AppEventsLogger.logEvent('fb_mobile_complete_registration')
}

/**
 * Logs custom conversion events with optional parameters.
 */
export async function logMetaCustomEvent(name: string, parameters?: MetaEventParams): Promise<void> {
  if (!isIOS) return
  const { AppEventsLogger } = await import('react-native-fbsdk-next')
  if (parameters) {
    AppEventsLogger.logEvent(name, parameters)
    return
  }
  AppEventsLogger.logEvent(name)
}
