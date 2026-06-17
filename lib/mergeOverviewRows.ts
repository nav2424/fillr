import type { OverviewScanRow } from './overviewAnalytics'

const DUPLICATE_WINDOW_MS = 60_000

function rowProductKey(row: OverviewScanRow): string {
  const product = row.result.product
  return [
    product.id?.trim().toLowerCase() ?? '',
    product.barcode?.trim().toLowerCase() ?? '',
    product.name?.trim().toLowerCase() ?? '',
  ].join('|')
}

function sameLikelyScan(a: OverviewScanRow, b: OverviewScanRow): boolean {
  const keyA = rowProductKey(a)
  const keyB = rowProductKey(b)
  if (!keyA || keyA !== keyB) return false
  return Math.abs(a.createdAt.getTime() - b.createdAt.getTime()) <= DUPLICATE_WINDOW_MS
}

/**
 * Remote rows are authoritative once they arrive, but local rows may contain scans
 * that have not synced yet. Merge both sources instead of hiding fresh local scans.
 */
export function mergeOverviewRows(
  localRows: OverviewScanRow[],
  remoteRows: OverviewScanRow[] | null
): OverviewScanRow[] {
  if (remoteRows === null) {
    return [...localRows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }
  if (remoteRows.length === 0) {
    return [...localRows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  const merged = [...remoteRows]
  for (const local of localRows) {
    if (merged.some((remote) => sameLikelyScan(local, remote))) continue
    merged.push(local)
  }
  return merged.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}
