import { Alert } from 'react-native'
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui'
import type { PaywallContext } from '../lib/buildPaywallContext'
import { updatePremiumStatus } from '../store/scanStore'
import { trackScanResultMetric } from '../lib/scanResultMetrics'
import { useConversionStore } from '../store/conversionStore'

export type ShowPaywallOptions = {
  context?: PaywallContext
  /** When true, skip the pre-paywall alert (e.g. in-app card already showed context). */
  skipContextAlert?: boolean
  /** Analytics source for upgrade taps. */
  metricSource?: string
}

export async function showPaywall(options?: ShowPaywallOptions): Promise<boolean> {
  const context = options?.context
  void trackScanResultMetric({
    name: 'paywall_shown',
    payload: {
      source: options?.metricSource ?? context?.trigger ?? 'unknown',
      product_name: context?.productName,
      flagged: context?.flaggedIngredientCount,
      profile_labels: context?.profileLabels,
    },
  })

  if (context && !options?.skipContextAlert) {
    await new Promise<void>((resolve) => {
      Alert.alert(context.headline, context.body, [
        { text: 'Not now', style: 'cancel', onPress: () => resolve() },
        { text: 'Continue', onPress: () => resolve() },
      ])
    })
  }

  try {
    const result = await RevenueCatUI.presentPaywall()
    switch (result) {
      case PAYWALL_RESULT.PURCHASED:
        void trackScanResultMetric({ name: 'paywall_purchased', payload: { source: options?.metricSource } })
        await updatePremiumStatus(true)
        useConversionStore.getState().clearConversionPrompts()
        return true
      case PAYWALL_RESULT.RESTORED:
        void trackScanResultMetric({ name: 'paywall_restored', payload: { source: options?.metricSource } })
        await updatePremiumStatus(true)
        useConversionStore.getState().clearConversionPrompts()
        return true
      case PAYWALL_RESULT.CANCELLED:
        void trackScanResultMetric({ name: 'paywall_cancelled', payload: { source: options?.metricSource } })
        return false
      default:
        void trackScanResultMetric({ name: 'paywall_failed', payload: { source: options?.metricSource } })
        return false
    }
  } catch (e) {
    void trackScanResultMetric({ name: 'paywall_failed', payload: { source: options?.metricSource } })
    if (__DEV__) console.log('Paywall error:', e)
    return false
  }
}

export async function trackUpgradeCtaTapped(source: string, context?: PaywallContext): Promise<void> {
  void trackScanResultMetric({
    name: 'upgrade_cta_tapped',
    payload: {
      source,
      trigger: context?.trigger,
      product_name: context?.productName,
    },
  })
}
