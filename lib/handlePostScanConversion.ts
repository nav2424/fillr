import type { ScanResult } from '../types'
import { buildPaywallContextFromScan } from './buildPaywallContext'
import { getScanAllowance } from './scanAllowance'
import { trackScanResultMetric } from './scanResultMetrics'
import {
  cancelOneScanLeftNotification,
  scheduleOneScanLeftNotification,
} from './scanLimitNotifications'
import { useConversionStore } from '../store/conversionStore'
import { useUserStore } from '../store/userStore'

/** Run after a successful free-tier scan increment (barcode, OCR, manual). */
export async function handlePostScanConversion(result: ScanResult): Promise<void> {
  const s = useUserStore.getState()
  if (s.isPro) return

  const { remaining, used, allowance } = getScanAllowance({
    isPro: false,
    totalScansUsed: s.totalScansUsed ?? 0,
    bonusScansEarned: s.bonusScansEarned ?? 0,
  })

  const productId = result.product.id

  if (remaining === 1) {
    useConversionStore.getState().setShowOneScanLeftBanner(true)
    void trackScanResultMetric({
      name: 'one_scan_left_warning_shown',
      productId,
      payload: { remaining, used, allowance },
    })
    await scheduleOneScanLeftNotification(s.notifyScanLimitReminders)
    return
  }

  if (remaining === 0) {
    await cancelOneScanLeftNotification()
    useConversionStore.getState().setShowOneScanLeftBanner(false)
    const context = buildPaywallContextFromScan(result, 'last_scan')
    useConversionStore.getState().setPendingLastScanPaywall({ productId, context })
    void trackScanResultMetric({
      name: 'last_free_scan_used',
      productId,
      payload: {
        used,
        allowance,
        flagged: context.flaggedIngredientCount,
        product_name: context.productName,
      },
    })
  }
}
