import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui'
import { updatePremiumStatus } from '../store/scanStore'
import { trackScanResultMetric } from '../lib/scanResultMetrics'

export async function showPaywall(): Promise<boolean> {
  void trackScanResultMetric({ name: 'paywall_shown' })
  try {
    const result = await RevenueCatUI.presentPaywall()
    switch (result) {
      case PAYWALL_RESULT.PURCHASED:
        void trackScanResultMetric({ name: 'paywall_purchased' })
        await updatePremiumStatus(true)
        return true
      case PAYWALL_RESULT.RESTORED:
        void trackScanResultMetric({ name: 'paywall_restored' })
        await updatePremiumStatus(true)
        return true
      case PAYWALL_RESULT.CANCELLED:
        void trackScanResultMetric({ name: 'paywall_cancelled' })
        return false
      default:
        void trackScanResultMetric({ name: 'paywall_failed' })
        return false
    }
  } catch (e) {
    void trackScanResultMetric({ name: 'paywall_failed' })
    if (__DEV__) console.log('Paywall error:', e)
    return false
  }
}

