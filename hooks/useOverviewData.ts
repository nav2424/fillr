import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useScanHistoryStore } from '../store/scanHistoryStore'
import {
  fetchOverviewScanRows,
  localScansToOverviewRows,
} from '../lib/overviewScanRemote'
import type { OverviewScanRow } from '../lib/overviewAnalytics'

function overviewRowDedupeKey(row: OverviewScanRow): string {
  const productKey =
    row.result.product.id?.trim() ||
    row.result.product.barcode?.trim() ||
    row.result.product.name.trim().toLowerCase()
  const minuteBucket = Math.floor(row.createdAt.getTime() / 60_000)
  return `${productKey}:${minuteBucket}`
}

function mergeOverviewRows(remote: OverviewScanRow[], local: OverviewScanRow[]): OverviewScanRow[] {
  const merged = [...remote]
  const seen = new Set(remote.map(overviewRowDedupeKey))
  for (const row of local) {
    const key = overviewRowDedupeKey(row)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(row)
  }
  return merged.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

/**
 * Use Supabase `scan_history` when available, but keep local-only scans visible
 * for pre-login, offline, or failed-sync captures.
 */
export function useOverviewData(): { rows: OverviewScanRow[]; loading: boolean } {
  const userId = useAuthStore((s) => s.userId)
  const localScans = useScanHistoryStore((s) => s.scans)
  const [remoteRows, setRemoteRows] = useState<OverviewScanRow[] | null>(null)

  useEffect(() => {
    if (!userId) {
      setRemoteRows(null)
      return
    }
    let cancelled = false
    setRemoteRows(null)
    void fetchOverviewScanRows(userId).then((rows) => {
      if (!cancelled) setRemoteRows(rows)
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  const rows = useMemo(() => {
    const local = localScansToOverviewRows(localScans)
    if (!userId) return local
    if (remoteRows === null) return local
    return mergeOverviewRows(remoteRows, local)
  }, [userId, remoteRows, localScans])

  const loading = Boolean(userId) && remoteRows === null

  return { rows, loading }
}
