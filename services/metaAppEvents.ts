import { Platform } from 'react-native'
import { isMetaAppEventsConfigured } from './metaAppEventsConfig'

type MetaEventParams = Record<string, string | number>

const isIOS = Platform.OS === 'ios'

function canUseMetaAppEvents(): boolean {
  return isIOS && isMetaAppEventsConfigured()
}

/**
 * Initializes Meta App Events SDK for iOS app lifecycle attribution.
 */
export async function initializeMetaAppEvents(): Promise<void> {
  if (!canUseMetaAppEvents()) {
    if (__DEV__ && isIOS) console.log('Meta App Events not initialized: missing Facebook app config')
    return
  }

  try {
    const { requestTrackingPermissionsAsync } = await import('expo-tracking-transparency')
    const { Settings } = await import('react-native-fbsdk-next')

    const { status } = await requestTrackingPermissionsAsync()
    Settings.initializeSDK()
    await Settings.setAdvertiserTrackingEnabled(status === 'granted')
  } catch (e) {
    if (__DEV__) console.log('Meta App Events not initialized:', e)
  }
}

/**
 * Logs a purchase conversion event to Meta App Events.
 */
export async function logMetaPurchase(amount: number, currency = 'USD'): Promise<void> {
  if (!canUseMetaAppEvents()) return
  try {
    const { AppEventsLogger } = await import('react-native-fbsdk-next')
    AppEventsLogger.logPurchase(amount, currency)
  } catch (e) {
    if (__DEV__) console.log('Meta purchase event not logged:', e)
  }
}

/**
 * Logs completed registration conversion.
 */
export async function logMetaCompletedRegistration(): Promise<void> {
  if (!canUseMetaAppEvents()) return
  try {
    const { AppEventsLogger } = await import('react-native-fbsdk-next')
    AppEventsLogger.logEvent('fb_mobile_complete_registration')
  } catch (e) {
    if (__DEV__) console.log('Meta completed registration event not logged:', e)
  }
}

/**
 * Logs custom conversion events with optional parameters.
 */
export async function logMetaCustomEvent(name: string, parameters?: MetaEventParams): Promise<void> {
  if (!canUseMetaAppEvents()) return
  try {
    const { AppEventsLogger } = await import('react-native-fbsdk-next')
    if (parameters) {
      AppEventsLogger.logEvent(name, parameters)
      return
    }
    AppEventsLogger.logEvent(name)
  } catch (e) {
    if (__DEV__) console.log('Meta custom event not logged:', e)
  }
}
