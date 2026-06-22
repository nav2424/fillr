import { Platform } from 'react-native'
import { hasMetaAppEventsConfig } from './metaAppEventsConfig'

type MetaEventParams = Record<string, string | number>

const isIOS = Platform.OS === 'ios'

/**
 * Initializes Meta App Events SDK for iOS app lifecycle attribution.
 */
export async function initializeMetaAppEvents(): Promise<void> {
  if (!isIOS || !hasMetaAppEventsConfig()) return

  try {
    const { requestTrackingPermissionsAsync } = await import('expo-tracking-transparency')
    const { Settings } = await import('react-native-fbsdk-next')

    const { status } = await requestTrackingPermissionsAsync()
    Settings.initializeSDK()
    await Settings.setAdvertiserTrackingEnabled(status === 'granted')
  } catch (error) {
    console.warn('[Fillr] Meta App Events initialization skipped:', error)
  }
}

/**
 * Logs a purchase conversion event to Meta App Events.
 */
export async function logMetaPurchase(amount: number, currency = 'USD'): Promise<void> {
  if (!isIOS || !hasMetaAppEventsConfig()) return
  try {
    const { AppEventsLogger } = await import('react-native-fbsdk-next')
    AppEventsLogger.logPurchase(amount, currency)
  } catch (error) {
    console.warn('[Fillr] Meta purchase event skipped:', error)
  }
}

/**
 * Logs completed registration conversion.
 */
export async function logMetaCompletedRegistration(): Promise<void> {
  if (!isIOS || !hasMetaAppEventsConfig()) return
  try {
    const { AppEventsLogger } = await import('react-native-fbsdk-next')
    AppEventsLogger.logEvent('fb_mobile_complete_registration')
  } catch (error) {
    console.warn('[Fillr] Meta completed-registration event skipped:', error)
  }
}

/**
 * Logs custom conversion events with optional parameters.
 */
export async function logMetaCustomEvent(name: string, parameters?: MetaEventParams): Promise<void> {
  if (!isIOS || !hasMetaAppEventsConfig()) return
  try {
    const { AppEventsLogger } = await import('react-native-fbsdk-next')
    if (parameters) {
      AppEventsLogger.logEvent(name, parameters)
      return
    }
    AppEventsLogger.logEvent(name)
  } catch (error) {
    console.warn(`[Fillr] Meta custom event "${name}" skipped:`, error)
  }
}
