import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui'
import { updatePremiumStatus } from '../store/scanStore'

export async function showPaywall(): Promise<boolean> {
  try {
    const result = await RevenueCatUI.presentPaywall()
    switch (result) {
      case PAYWALL_RESULT.PURCHASED:
      case PAYWALL_RESULT.RESTORED:
        await updatePremiumStatus(true)
        return true
      case PAYWALL_RESULT.CANCELLED:
      default:
        return false
    }
  } catch (e) {
    if (__DEV__) console.log('Paywall error:', e)
    return false
  }
}

