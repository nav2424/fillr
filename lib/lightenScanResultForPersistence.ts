import type { ScanResult } from '../types'

/**
 * Drops fields that are recomputed on read (`attachFillrFitToScanResult`) so persisted JSON is
 * smaller — lowers iOS main-thread time and peak memory during `JSON.stringify` of scan history.
 */
export function lightenScanResultForPersistence(r: ScanResult): ScanResult {
  if (r.scoringFrozenAt && r.fillrFit && r.scoringProfileHash) return r
  const { scoringData: _sd, fillrFit: _ff, processedRating: _pr, ...rest } = r
  return rest
}
