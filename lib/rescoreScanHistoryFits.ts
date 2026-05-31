import { attachFillrFitToScanResult } from './attachFillrFit'
import { getUserProfileForScan } from './getUserProfileForScan'
import { useScanHistoryStore } from '../store/scanHistoryStore'

const RESCORE_STEP_MS = 50

/**
 * Recompute Fillr Fit for every saved scan using the latest profile (background-friendly).
 */
export async function rescoreAllSavedScanFits(): Promise<void> {
  const dietary = await getUserProfileForScan()
  const { scans, updateScanResultByProductId } = useScanHistoryStore.getState()

  for (const rec of scans) {
    if (!rec.result) continue
    if (rec.result.scoringFrozenAt) continue
    await new Promise((r) => setTimeout(r, RESCORE_STEP_MS))
    const next = attachFillrFitToScanResult(rec.result, dietary)
    updateScanResultByProductId(rec.productId, next)
  }
}
