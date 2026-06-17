import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useScanHistoryStore } from '../store/scanHistoryStore'
import {
  fetchOverviewScanRows,
  localScansToOverviewRows,
} from '../lib/overviewScanRemote'
import { mergeOverviewRows } from '../lib/mergeOverviewRows'
import type { OverviewScanRow } from '../lib/overviewAnalytics'

/**
 * Use Supabase `scan_history` when available, while keeping local scans that
 * have not reached remote history yet.
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
    return mergeOverviewRows(local, remoteRows)
  }, [userId, remoteRows, localScans])

  const loading = Boolean(userId) && remoteRows === null

  return { rows, loading }
}
