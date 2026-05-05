# Fillr Release Runbook

This runbook is the final pre-release checklist for shipping to TestFlight / App Store and Play Console.

## 1) Local quality gates

Run these from repo root:

```bash
npx tsc --noEmit
npm test
npx expo-doctor --verbose
```

Expected:
- TypeScript: zero errors
- Tests: all pass
- Expo doctor: `18/18 checks passed`

## 2) Environment and secrets

Required app env vars:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_REVENUECAT_IOS_KEY`

Optional app env vars:
- `EXPO_PUBLIC_TERMS_URL`
- `EXPO_PUBLIC_PRIVACY_URL`
- `EXPO_PUBLIC_OPENAI_INGREDIENT_MODEL`
- `EXPO_PUBLIC_OPENAI_MODEL`

Required Supabase Edge Function secret:
- `OPENAI_API_KEY` (for `supabase/functions/ingredient-analysis`)

Set/update edge secret:

```bash
supabase secrets set OPENAI_API_KEY=sk-...
```

## 3) Supabase SQL rollout order

Apply SQL in this order to avoid dependency issues:

1. `supabase/schema.sql`
2. `supabase/sql/add_lifetime_pro.sql`
3. `supabase/sql/ingredient_knowledge.sql`
4. `supabase/sql/scan_result_events.sql`
5. `supabase/sql/scan_ingredient_results.sql`
6. `supabase/sql/top_wrong_ingredients.sql`
7. `supabase/sql/scan_pipeline_health.sql`
8. `supabase/sql/global_worst_offenders.sql`
9. `supabase/sql/grandfather_lifetime_pro_by_email.sql` (only when granting specific accounts)

Post-apply checks:

```bash
supabase db lint --linked
```

## 4) EAS build and submit

Production builds:

```bash
npm run build:ios
npm run build:android
```

Submit:

```bash
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

## 5) Release-day smoke checks

After install on release candidate build:
- Sign up / login / logout
- Scan barcode with full OFF data
- Scan barcode with poor data, then OCR fallback
- Verify product page renders ingredient evidence and uncertainty actions
- Submit correctness feedback (`Correct`, `Wrong`, `Not sure`)
- Confirm paywall purchase + restore flow
- Verify referral flow and code copy/share

## 6) Monitoring in first 24h

Watch these Supabase analytics surfaces:
- `scan_source_decision_last_30d`
- `scan_queue_write_health_last_30d`
- `scan_result_wrong_ingredients_last_7d`
- `scan_result_verification_recommended_last_30d`
- `get_scan_pipeline_health_snapshot(7)`

Alert thresholds to investigate:
- Queue write success rate < 99%
- Sudden jump in `wrong_ingredient` counts on a single ingredient
- Drop in scan success or spike in OCR low-confidence failures

## 7) Rollback plan

If release causes severe regression:

1. Pause store rollout (App Store phased release / Play staged rollout).
2. Re-submit previous known-good build.
3. Disable risky server-side behaviors first:
   - Stop/manual pause SQL jobs refreshing optional materialized views.
   - Disable new feature flags remotely (if available).
4. Keep telemetry writes enabled for root-cause analysis.
5. Publish hotfix with focused patch and re-run sections 1-5 of this runbook.

