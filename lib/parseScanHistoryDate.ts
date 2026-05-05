/**
 * Parse `ScanRecord.date` for grouping and display.
 *
 * New scans should store `new Date().toISOString()` (full instant, unambiguous).
 * Legacy rows used `toLocaleDateString()` only; parsing that with `new Date(str)` is
 * implementation-dependent and often shifts to the previous calendar day in local TZ.
 */
/** True when `raw` is a full instant (e.g. `toISOString()`). Legacy rows were date-only. */
export function scanHistoryRecordHasReliableTime(raw: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T/.test((raw ?? '').trim())
}

export function parseScanHistoryDate(raw: string): Date | null {
  const s = (raw ?? '').trim()
  if (!s) return null

  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d
  }

  const isoDateOnly = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoDateOnly) {
    const y = Number(isoDateOnly[1])
    const m = Number(isoDateOnly[2]) - 1
    const day = Number(isoDateOnly[3])
    return new Date(y, m, day, 12, 0, 0, 0)
  }

  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slash) {
    const a = Number(slash[1])
    const b = Number(slash[2])
    const y = Number(slash[3])
    let month: number
    let dayNum: number
    if (a > 12) {
      dayNum = a
      month = b - 1
    } else if (b > 12) {
      month = a - 1
      dayNum = b
    } else {
      month = a - 1
      dayNum = b
    }
    return new Date(y, month, dayNum, 12, 0, 0, 0)
  }

  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}
