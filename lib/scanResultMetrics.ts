import { storage } from './storage'
import { supabase } from './supabase'
import { enqueueNonCriticalWrite } from './nonCriticalWriteQueue'

const LOCAL_METRICS_KEY = 'fillr:scan_result_metrics:v1'
const LOCAL_MAX = 200

export type ScanResultMetricName =
  | 'onboarding_completed'
  | 'scan_started'
  | 'scan_cache_hit'
  | 'scan_succeeded'
  | 'scan_failed'
  | 'scan_result_rendered'
  | 'scan_copy_quality'
  | 'paywall_shown'
  | 'paywall_purchased'
  | 'paywall_restored'
  | 'paywall_cancelled'
  | 'paywall_failed'
  | 'last_free_scan_used'
  | 'one_scan_left_warning_shown'
  | 'scan_limit_reached'
  | 'upgrade_cta_tapped'
  | 'referral_cta_at_limit'
  | 'restore_purchases_tapped'
  | 'restore_purchases_succeeded'
  | 'restore_purchases_no_entitlement'
  | 'restore_purchases_failed'
  | 'scan_result_opened'
  | 'ingredient_expanded'
  | 'scan_result_decision'
  | 'scan_result_feedback'
  | 'scan_result_summary'
  | 'scan_result_rescan_click'
  | 'scan_result_swap_click'
  | 'possible_match_viewed'
  | 'possible_match_action_clicked'
  | 'scan_result_correctness_feedback'
  | 'barcode_backfilled_from_ocr'
  | 'source_decision'
  | 'queue_write_health'

export type ScanResultMetricEvent = {
  name: ScanResultMetricName
  productId?: string
  barcode?: string
  payload?: Record<string, unknown>
  ts: string
}

async function appendLocalMetric(ev: ScanResultMetricEvent): Promise<void> {
  try {
    const raw = await storage.getItem(LOCAL_METRICS_KEY)
    const arr = raw ? (JSON.parse(raw) as ScanResultMetricEvent[]) : []
    const next = [...arr, ev].slice(-LOCAL_MAX)
    await storage.setItem(LOCAL_METRICS_KEY, JSON.stringify(next))
  } catch {
    // best-effort only
  }
}

async function persistRemoteMetric(ev: ScanResultMetricEvent): Promise<void> {
  try {
    await enqueueNonCriticalWrite('scan_result_metrics', async () => {
      const { data } = await supabase.auth.getSession()
      const uid = data?.session?.user?.id
      if (!uid) return
      await supabase.from('scan_result_events').insert({
        user_id: uid,
        product_id: ev.productId ?? '',
        barcode: ev.barcode ?? '',
        event_name: ev.name,
        payload_json: ev.payload ?? {},
        created_at: ev.ts,
      })
    })
  } catch {
    // optional remote sink
  }
}

export async function trackScanResultMetric(input: {
  name: ScanResultMetricName
  productId?: string
  barcode?: string
  payload?: Record<string, unknown>
}): Promise<void> {
  const ev: ScanResultMetricEvent = {
    name: input.name,
    productId: input.productId,
    barcode: input.barcode,
    payload: input.payload,
    ts: new Date().toISOString(),
  }
  await appendLocalMetric(ev)
  void persistRemoteMetric(ev)
}
