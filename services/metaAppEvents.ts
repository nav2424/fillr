import { Platform } from 'react-native'
import { hasMetaAppEventsConfig } from './metaAppEventsConfig'

type MetaEventParams = Record<string, string | number>

const isIOS = Platform.OS === 'ios'

function logMetaAppEventsError(message: string, error: unknown): void {
  if (__DEV__) console.log(message, error)
}

export function isMetaAppEventsConfigured(): boolean {
  return isIOS && hasMetaAppEventsConfig()
}

/**
 * Initializes Meta App Events SDK for iOS app lifecycle attribution.
 */
export async function initializeMetaAppEvents(): Promise<boolean> {
  if (!isMetaAppEventsConfigured()) return false

  try {
    const { requestTrackingPermissionsAsync } = await import('expo-tracking-transparency')
    const { Settings } = await import('react-native-fbsdk-next')

    const { status } = await requestTrackingPermissionsAsync()
    Settings.initializeSDK()
    await Settings.setAdvertiserTrackingEnabled(status === 'granted')
    return true
  } catch (error) {
    logMetaAppEventsError('Meta App Events not initialized.', error)
    return false
  }
}

/**
 * Logs a purchase conversion event to Meta App Events.
 */
export async function logMetaPurchase(amount: number, currency = 'USD'): Promise<void> {
  if (!isMetaAppEventsConfigured()) return
  try {
    const { AppEventsLogger } = await import('react-native-fbsdk-next')
    AppEventsLogger.logPurchase(amount, currency)
  } catch (error) {
    logMetaAppEventsError('Meta purchase event was not logged.', error)
  }
}

/**
 * Logs completed registration conversion.
 */
export async function logMetaCompletedRegistration(): Promise<void> {
  if (!isMetaAppEventsConfigured()) return
  try {
    const { AppEventsLogger } = await import('react-native-fbsdk-next')
    AppEventsLogger.logEvent('fb_mobile_complete_registration')
  } catch (error) {
    logMetaAppEventsError('Meta registration event was not logged.', error)
  }
}

/**
 * Logs custom conversion events with optional parameters.
 */
export async function logMetaCustomEvent(name: string, parameters?: MetaEventParams): Promise<void> {
  if (!isMetaAppEventsConfigured()) return
  try {
    const { AppEventsLogger } = await import('react-native-fbsdk-next')
    if (parameters) {
      AppEventsLogger.logEvent(name, parameters)
      return
    }
    AppEventsLogger.logEvent(name)
  } catch (error) {
    logMetaAppEventsError(`Meta event "${name}" was not logged.`, error)
  }
}
