import { supabase } from './supabase'
import type { ScanResult } from '../types'
import type { OverviewScanRow } from './overviewAnalytics'
import { parseScanHistoryDate } from './parseScanHistoryDate'

function supabaseClientConfigured(): boolean {
  return Boolean(
    (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim() &&
      (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim()
  )
}

/**
 * Resolves `products.id` after a barcode upsert (which may still be in flight from `productService`).
 */
async function resolveProductIdByBarcodeWithRetry(barcode: string): Promise<string | null> {
  if (!supabaseClientConfigured()) return null
  const bc = barcode.trim()
  if (!bc || bc.startsWith('ocr_')) return null
  const waitsMs = [0, 40, 100, 180, 260]
  for (const ms of waitsMs) {
    if (ms > 0) await new Promise((r) => setTimeout(r, ms))
    const { data, error } = await supabase.from('products').select('id').eq('barcode', bc).maybeSingle()
    if (!error && data?.id) return data.id
  }
  return null
}

function parseResultJson(raw: unknown): ScanResult | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<ScanResult>
  if (!Array.isArray(r.ingredientBreakdown)) return null
  return r as ScanResult
}

export async function fetchOverviewScanRows(userId: string): Promise<OverviewScanRow[]> {
  const { data, error } = await supabase
    .from('scan_history')
    .select('created_at, result_json')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error || !Array.isArray(data)) return []

  const out: OverviewScanRow[] = []
  for (const row of data) {
    const createdAt = new Date(String((row as { created_at?: string }).created_at ?? ''))
    if (Number.isNaN(createdAt.getTime())) continue
    const result = parseResultJson((row as { result_json?: unknown }).result_json)
    if (!result) continue
    out.push({ createdAt, result })
  }
  return out
}

/** Best-effort sync after a scan (ignored if offline / unauthenticated). */
export async function persistScanHistoryRemote(scan: {
  barcode: string
  result?: ScanResult | null
}): Promise<void> {
  if (!scan.result) return
  const { data: sessionData } = await supabase.auth.getSession()
  const uid = sessionData?.session?.user?.id
  if (!uid) return

  const shouldLinkProduct =
    !scan.barcode.startsWith('ocr_') && scan.result?.product?.source === 'openfoodfacts'

  const productId = shouldLinkProduct
    ? await resolveProductIdByBarcodeWithRetry(scan.barcode)
    : null

  const { data, error } = await supabase
    .from('scan_history')
    .insert({
      user_id: uid,
      barcode: scan.barcode,
      product_id: productId,
      result_json: scan.result as unknown as Record<string, unknown>,
    })
    .select('id')
    .maybeSingle()

  if (error || !data?.id) return

  const breakdown = scan.result.ingredientBreakdown ?? []
  if (breakdown.length === 0) return

  const rows = breakdown.map((i) => ({
    scan_id: data.id,
    ingredient_name: i.name,
    from_cache: i.fromCache === true,
  }))

  void (async () => {
    try {
      const { error: logError } = await supabase.from('scan_ingredient_results').insert(rows)
      if (logError) console.error('[Fillr] scan_ingredient_results insert failed', logError)
    } catch (e) {
      console.error('[Fillr] scan_ingredient_results insert failed', e)
    }
  })()
}

export function localScansToOverviewRows(
  scans: Array<{ date: string; result?: ScanResult | null }>
): OverviewScanRow[] {
  return scans
    .filter((s): s is typeof s & { result: ScanResult } => Boolean(s.result))
    .map((s) => {
      const createdAt = parseScanHistoryDate(s.date) ?? new Date(NaN)
      return { createdAt, result: s.result }
    })
    .filter((r) => !Number.isNaN(r.createdAt.getTime()))
}
