import { supabase } from './supabase'
import { getWeekBounds } from './overviewAnalytics'
import type { HomeWorstOffender } from './buildHomeScreenData'
import { buildWorstOffendersThisWeek } from './buildHomeScreenData'
import type { ScanRecord } from '../store/scanHistoryStore'

function supabaseConfigured(): boolean {
  return Boolean(
    (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim() &&
      (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim()
  )
}

type RpcRow = { ingredient_display?: string | null; scan_count?: number | string | null }

export type GlobalWorstOffendersPack = {
  rows: HomeWorstOffender[]
  /** `personal_fallback` when the community RPC is missing or failed (copy should not say “all Fillr”). */
  source: 'community' | 'personal_fallback'
}

const DEFAULT_WORST_OFFENDER_LIMIT = 4
const MAX_WORST_OFFENDER_LIMIT = 50

/**
 * Top concerning/avoid ingredients for the calendar week across **all** Fillr users (server aggregate).
 * Falls back to the current user’s own scans if Supabase is unavailable or the RPC errors.
 */
export async function fetchGlobalWorstOffendersForHome(
  personalScans: ScanRecord[],
  options: { ref?: Date; limit?: number } = {}
): Promise<GlobalWorstOffendersPack> {
  const ref = options.ref ?? new Date()
  const limit = Math.min(
    MAX_WORST_OFFENDER_LIMIT,
    Math.max(1, Math.floor(options.limit ?? DEFAULT_WORST_OFFENDER_LIMIT))
  )

  const fallback = (): GlobalWorstOffendersPack => ({
    rows: buildWorstOffendersThisWeek(personalScans, ref, limit),
    source: 'personal_fallback',
  })
  if (!supabaseConfigured()) return fallback()

  const { start, end } = getWeekBounds(ref)
  const { data, error } = await supabase.rpc('get_global_worst_offenders', {
    p_week_start: start.toISOString(),
    p_week_end: end.toISOString(),
    p_limit: limit,
  })

  if (error) {
    if (__DEV__) console.warn('[Fillr] get_global_worst_offenders:', error.message)
    return fallback()
  }
  if (!Array.isArray(data)) return fallback()

  const rows = data as RpcRow[]
  const mapped = rows
    .map((row) => ({
      ingredientName: (row.ingredient_display ?? '').trim(),
      scanCountThisWeek: Math.max(0, Math.floor(Number(row.scan_count ?? 0))),
    }))
    .filter((r) => r.ingredientName.length > 0 && r.scanCountThisWeek > 0)
    .slice(0, limit)
    .map((r, i) => ({ ...r, rank: i + 1 }))

  return { rows: mapped, source: 'community' }
}
