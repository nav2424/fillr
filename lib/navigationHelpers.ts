import { router } from 'expo-router'

/** When true, next focus of the Scan tab may auto-open the vision scanner once. */
let visionAutoOpenPending = true

/** Allow one vision auto-open the next time the Scan tab is focused (e.g. after leaving a result). */
export function markVisionAutoOpenPending() {
  visionAutoOpenPending = true
}

/** Consume the pending flag — returns true only once until marked again. */
export function consumeVisionAutoOpenPending(): boolean {
  if (!visionAutoOpenPending) return false
  visionAutoOpenPending = false
  return true
}

/** Avoid dev "GO_BACK was not handled" when the stack was cleared via replace. */
export function goBackOrReplace(fallback: '/(tabs)/scan' | '/(tabs)' = '/(tabs)') {
  if (router.canGoBack()) {
    router.back()
    return
  }
  router.replace(fallback)
}

/** Open the scanner again after viewing a result (product FAB, error retry, etc.). */
export function openRescan() {
  markVisionAutoOpenPending()
  router.replace('/(tabs)/scan')
}

/** Leave a scan result and land on Home — clears the vision/confirm stack. */
export function exitFromScanResult() {
  markVisionAutoOpenPending()
  router.replace('/(tabs)')
}

/** Leave vision flow mid-scan and land on Home. */
export function exitVisionFlowToHome() {
  markVisionAutoOpenPending()
  router.replace('/(tabs)')
}
