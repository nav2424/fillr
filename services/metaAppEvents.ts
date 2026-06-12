import { Platform } from 'react-native'

type MetaEventParams = Record<string, string | number>

const isIOS = Platform.OS === 'ios'
const facebookAppId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID?.trim() ?? ''
const facebookClientToken = process.env.EXPO_PUBLIC_FACEBOOK_CLIENT_TOKEN?.trim() ?? ''

let initializationAttempt: Promise<boolean> | null = null

export function isMetaAppEventsConfigured(): boolean {
  return Boolean(facebookAppId && facebookClientToken)
}

async function ensureMetaAppEventsInitialized(): Promise<boolean> {
  if (!isIOS || !isMetaAppEventsConfigured()) return false
  if (initializationAttempt) return initializationAttempt

  initializationAttempt = (async () => {
    try {
      const { requestTrackingPermissionsAsync } = await import('expo-tracking-transparency')
      const { Settings } = await import('react-native-fbsdk-next')

      const { status } = await requestTrackingPermissionsAsync()
      Settings.initializeSDK()
      await Settings.setAdvertiserTrackingEnabled(status === 'granted')
      return true
    } catch (err) {
      initializationAttempt = null
      if (__DEV__) console.warn('[Fillr] Meta App Events initialization failed:', err)
      return false
    }
  })()

  return initializationAttempt
}

/**
 * Initializes Meta App Events SDK for iOS app lifecycle attribution.
 */
export async function initializeMetaAppEvents(): Promise<void> {
  await ensureMetaAppEventsInitialized()
}

/**
 * Logs a purchase conversion event to Meta App Events.
 */
export async function logMetaPurchase(amount: number, currency = 'USD'): Promise<void> {
  if (!(await ensureMetaAppEventsInitialized())) return
  const { AppEventsLogger } = await import('react-native-fbsdk-next')
  AppEventsLogger.logPurchase(amount, currency)
}

/**
 * Logs completed registration conversion.
 */
export async function logMetaCompletedRegistration(): Promise<void> {
  if (!(await ensureMetaAppEventsInitialized())) return
  const { AppEventsLogger } = await import('react-native-fbsdk-next')
  AppEventsLogger.logEvent('fb_mobile_complete_registration')
}

/**
 * Logs custom conversion events with optional parameters.
 */
export async function logMetaCustomEvent(name: string, parameters?: MetaEventParams): Promise<void> {
  if (!(await ensureMetaAppEventsInitialized())) return
  const { AppEventsLogger } = await import('react-native-fbsdk-next')
  if (parameters) {
    AppEventsLogger.logEvent(name, parameters)
    return
  }
  AppEventsLogger.logEvent(name)
}
