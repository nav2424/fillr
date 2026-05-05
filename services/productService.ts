/**
 * Product & Scan Service
 * Uses Open Food Facts when available, falls back to mock data
 * All results are personalized to the user's profile (allergies, sensitivities, preferences, goal)
 */

import { scanBarcodeForAllergens, type AllergenScanResult } from '../lib/AllergenCheckService'
import { mapDetectionToFillrResult, parseIngredients } from '../lib/fillrAdapter'
import { personalizeScanResult } from '../lib/personalizationEngine'
import { detectAllergensEvidenceBased, buildUserAllergenConfig } from '../lib/allergenEngine'
import { getCeliacSeverity, runCeliacCheck } from '../lib/allergenEngine/matcher'
import {
  analyzeIngredientsWithOpenAI,
  mergeAiAnalysisWithScan,
  repairScanIngredientBreakdownGaps,
} from './openaiIngredientAnalysis'
import { mockProductByBarcode, isDemoScanBarcode } from './mockProducts'
import { getDietProfileSnapshotSync, getUserProfileForScan } from '../lib/getUserProfileForScan'
import { finalizeScanForPresentation } from '../lib/attachFillrFit'
import { applyDemoScanProfileTailoring } from '../lib/demoScanPersonalize'
import { DEFAULT_OCR_PRODUCT_NAME } from '../lib/historyDisplayLabel'
import type { DietaryProfile, ScanResult } from '../types'
import {
  shouldTranslateFrenchOnlyIngredientLabel,
  translateIngredientLabelToEnglish,
} from './ocrLabelTranslation'
import {
  extractEnglishIngredientHaystackForSafetyFromBlob,
  extractEnglishIngredients,
} from '../lib/ingredientTextParsing'
import type { IngredientTextParseSource } from '../lib/ingredientParseSource'
import type { OFFProductLike } from '../lib/allergenEngine/offNormalizer'
import { supabase } from '../lib/supabase'
import { yieldToMainThread } from '../lib/yieldToMainThread'
import { enqueueNonCriticalWrite } from '../lib/nonCriticalWriteQueue'
import { trackScanResultMetric } from '../lib/scanResultMetrics'

function supabaseClientConfigured(): boolean {
  return Boolean(
    (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim() &&
      (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim()
  )
}

/**
 * After OFF product data is fetched and parsed, upsert into `public.products`.
 * Non-blocking for scan UX — callers should `void … .catch(() => {})`.
 */
async function upsertProductToDatabase(offProduct: OFFProductLike, barcode: string): Promise<void> {
  if (!supabaseClientConfigured()) return
  const bc = barcode.trim()
  if (!bc) return
  try {
    const nameRaw =
      (typeof offProduct.product_name === 'string' && offProduct.product_name.trim()) ||
      (typeof offProduct.product_name_en === 'string' && offProduct.product_name_en.trim()) ||
      null
    const name = nameRaw || 'Unknown product'

    const brandsRaw = offProduct.brands
    const brand =
      typeof brandsRaw === 'string' && brandsRaw.trim() ? brandsRaw.split(',')[0].trim() : null

    const ingredientText =
      (typeof offProduct.ingredients_text_en === 'string' && offProduct.ingredients_text_en.trim()) ||
      (typeof offProduct.ingredients_text === 'string' && offProduct.ingredients_text.trim()) ||
      null

    const imageUrl =
      (typeof offProduct.image_front_url === 'string' && offProduct.image_front_url) ||
      (typeof offProduct.image_url === 'string' && offProduct.image_url) ||
      null

    const nut = offProduct.nutriments
    const nutritionJson = nut && typeof nut === 'object' ? (nut as Record<string, unknown>) : null

    const { error } = await supabase.from('products').upsert(
      {
        barcode: bc,
        name,
        brand,
        image_url: imageUrl,
        ingredient_text: ingredientText,
        nutrition_json: nutritionJson,
        source: 'openfoodfacts',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'barcode' }
    )

    if (error) console.warn('[Fillr] Failed to upsert product to database:', error.message)
  } catch (err) {
    console.warn('[Fillr] Failed to upsert product to database:', err)
  }
}

/**
 * Backfill missing barcode ingredient data from user-provided label capture (OCR/manual).
 * This lets future barcode scans reuse the learned ingredient text.
 */
export async function backfillBarcodeIngredientData(params: {
  barcode: string
  ingredientText: string
  productDisplayName?: string
  source: 'photo_ocr' | 'manual_entry'
}): Promise<boolean> {
  if (!supabaseClientConfigured()) return false
  const barcode = String(params.barcode ?? '').trim()
  const ingredientText = String(params.ingredientText ?? '').trim()
  if (!barcode || ingredientText.length < 20) return false
  try {
    const queued = await enqueueNonCriticalWrite(`product_backfill_${barcode}`, async () => {
      const { data: existing } = await supabase
        .from('products')
        .select('name, brand, image_url, nutrition_json, source')
        .eq('barcode', barcode)
        .maybeSingle()

      const nextName =
        (typeof existing?.name === 'string' && existing.name.trim()) ||
        (params.productDisplayName?.trim() || '') ||
        'User submitted label'
      const nextSource =
        existing?.source && String(existing.source).trim()
          ? String(existing.source).includes('openfoodfacts')
            ? 'openfoodfacts_backfilled'
            : String(existing.source)
          : params.source

      const { error } = await supabase.from('products').upsert(
        {
          barcode,
          name: nextName,
          brand: existing?.brand ?? null,
          image_url: existing?.image_url ?? null,
          ingredient_text: ingredientText,
          nutrition_json: existing?.nutrition_json ?? null,
          source: nextSource,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'barcode' }
      )

      if (error) {
        console.warn('[Fillr] Failed to backfill barcode ingredient data:', error.message)
        return false
      }
      return true
    })
    void trackScanResultMetric({
      name: 'queue_write_health',
      barcode,
      payload: {
        lane: 'product_backfill',
        queued_ahead: queued.queuedAhead,
        attempts: queued.attempts,
        success: queued.value === true,
      },
    })
    return queued.value
  } catch (err) {
    console.warn('[Fillr] Failed to backfill barcode ingredient data:', err)
    void trackScanResultMetric({
      name: 'queue_write_health',
      barcode,
      payload: {
        lane: 'product_backfill',
        success: false,
        failure: 'exception',
      },
    })
    return false
  }
}

function isFillrDemoBarcode(raw: string): boolean {
  return isDemoScanBarcode(raw)
}

type CachedBarcodeProduct = {
  barcode: string
  name: string
  brand: string | null
  ingredient_text: string | null
  nutrition_json: Record<string, unknown> | null
  source: string | null
  updated_at: string | null
}

async function getCachedProductByBarcode(barcode: string): Promise<CachedBarcodeProduct | null> {
  if (!supabaseClientConfigured()) return null
  const bc = String(barcode ?? '').trim()
  if (!bc) return null
  try {
    const { data, error } = await supabase
      .from('products')
      .select('barcode, name, brand, ingredient_text, nutrition_json, source, updated_at')
      .eq('barcode', bc)
      .maybeSingle()
    if (error || !data) return null
    return data as CachedBarcodeProduct
  } catch {
    return null
  }
}

async function buildScanFromCachedBarcodeProduct(
  params: ScanProductParams,
  barcode: string,
  cachedInput?: CachedBarcodeProduct | null
): Promise<ScanProductFastResult | null> {
  const cached = cachedInput ?? (await getCachedProductByBarcode(barcode))
  const ingredientText = String(cached?.ingredient_text ?? '').trim()
  if (!cached || ingredientText.length < 20 || parseIngredients(ingredientText, 'barcode').length < 3) {
    return null
  }

  const userConfig = buildUserAllergenConfig(params.allergies)
  const output = detectAllergensEvidenceBased(
    {
      product_name: cached.name,
      ingredients_text: ingredientText,
      ingredients_text_safety: ingredientText,
      contains_text: '',
      may_contain_text: '',
      allergens_tags: [],
      traces_tags: [],
      ingredients: undefined,
      ingredients_tags: undefined,
    },
    userConfig
  )

  const dietaryProfile = await getUserProfileForScan()
  const celiacStrict = Boolean(params.celiacStrictGluten ?? dietaryProfile.celiacStrictGluten)
  if (celiacStrict) {
    const ingredients = ingredientText
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean)
    const celiacMatches = runCeliacCheck(ingredients, ingredientText)
    output.celiac = {
      celiacModeEnabled: true,
      matchedGlutenSignals: celiacMatches.map((m) => ({
        ingredient: m.ingredient,
        signalType: m.signalType,
        severity: m.severity,
        reason: m.reason,
      })),
      celiacSeverity: getCeliacSeverity(celiacMatches),
    }
  }

  const baseResult = mapDetectionToFillrResult(
    barcode,
    cached.name || 'Known product',
    output,
    params,
    {
      brand: cached.brand ?? undefined,
      nutritionJson: cached.nutrition_json ?? undefined,
    }
  )
  const userProfile = {
    allergies: params.allergies,
    sensitivities: params.sensitivities,
    preferences: params.preferences,
    goal: params.goal,
    celiacStrictGluten: celiacStrict,
  }
  let result = personalizeScanResult(baseResult, userProfile)
  let finalResult = finalizeScanForPresentation(result, dietaryProfile)
  if (!isFillrDemoBarcode(barcode) && finalResult.ingredientBreakdown.length > 0) {
    finalResult = markScanFastPendingDecode(finalResult)
  }
  return { ok: true, result: finalResult, dietaryProfile }
}

function scoreIngredientSource(
  ingredientText: string,
  sourceLabel: string,
  updatedAt?: string | null
): number {
  const text = String(ingredientText ?? '').trim()
  if (!text) return 0
  const parsedCount = parseIngredients(text, 'barcode').length
  let score = 0
  score += Math.min(text.length, 5000) / 25
  score += Math.min(parsedCount * 16, 220)
  if (/\bingredients?\s*:/i.test(text)) score += 40
  if (/openfoodfacts/i.test(sourceLabel)) score += 20
  if (/backfilled|photo_ocr|manual_entry/i.test(sourceLabel)) score += 35
  if (updatedAt && !Number.isNaN(Date.parse(updatedAt))) {
    const ageDays = (Date.now() - Date.parse(updatedAt)) / (1000 * 60 * 60 * 24)
    if (ageDays <= 30) score += 20
    else if (ageDays <= 180) score += 10
  }
  return Math.round(score)
}

/** OpenAI ingredient enrichment can be slow on poor networks; fallback copy fills in if this fires. */
const AI_ENRICH_TIMEOUT_MS = 130_000

function clearPendingDecodeState(result: ScanResult): ScanResult {
  if (!result.ingredientBreakdown.some((ing) => ing.aiDecodePending)) return result
  return {
    ...result,
    ingredientBreakdown: result.ingredientBreakdown.map((ing) => ({
      ...ing,
      aiDecodePending: false,
    })),
  }
}

async function analyzeIngredientsWithTimeout(
  text: string,
  dietaryProfile: DietaryProfile,
  options: Parameters<typeof analyzeIngredientsWithOpenAI>[2]
) {
  const timeout = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), AI_ENRICH_TIMEOUT_MS)
  })
  return Promise.race([analyzeIngredientsWithOpenAI(text, dietaryProfile, options), timeout])
}

/** Strip AI prose for instant navigation; cards show “Decoding…” until enrichment. */
function markScanFastPendingDecode(result: ScanResult): ScanResult {
  if (!result.ingredientBreakdown.length) {
    return { ...result, productAnalysis: undefined, ingredientDecodeMeta: undefined }
  }
  return {
    ...result,
    productAnalysis: undefined,
    ingredientDecodeMeta: undefined,
    ingredientBreakdown: result.ingredientBreakdown.map((ing) => ({
      ...ing,
      aiDecodePending: true,
      headline: '',
      labelDecoder: '',
      whatItIs: '',
      whatItDoes: '',
      whyItsUsed: '',
      whatToKnow: '',
      bodyEffect: '',
      funFact: '',
      explanation: '',
      quickSummary: '',
      bullets: undefined,
      ratingReason: '',
      commonName: undefined,
      personalizedNote: undefined,
      personalMessage: undefined,
      personalFlag: undefined,
    })),
  }
}

export interface ScanProductParams {
  barcode: string
  allergies: string[]
  sensitivities: string[]
  preferences: string[]
  goal: string
  celiacStrictGluten?: boolean
}

export type ScanProductFastResult =
  | { ok: true; result: ScanResult; dietaryProfile: DietaryProfile }
  | { ok: false; error: string; reason?: 'not_found' | 'insufficient_data'; productName?: string }

/**
 * Phase 1 — OFF + allergens + deterministic ratings + score; no OpenAI. Navigate on this, then call `enrichScanResultWithAI`.
 */
export async function scanProductFast(params: ScanProductParams): Promise<ScanProductFastResult> {
  const { barcode, allergies, sensitivities, preferences, goal } = params

  const syncSnap = getDietProfileSnapshotSync()
  const celiacForOff = Boolean(params.celiacStrictGluten ?? syncSnap.celiacStrictGluten)

  const offResult = await scanBarcodeForAllergens({
    barcode,
    allergies,
    celiacStrictGluten: celiacForOff,
    langPreference: 'en',
  }).catch((): AllergenScanResult => ({
    ok: false,
    barcode: barcode.trim(),
    error: 'Could not reach Open Food Facts. Check your connection and try again.',
  }))

  try {
    if (offResult.ok) {
      const baseResult = mapDetectionToFillrResult(
        offResult.barcode,
        offResult.productName,
        offResult.output,
        params,
        {
          brand: offResult.brand,
          nutritionJson: offResult.nutritionJson,
          crossContactWarnings: offResult.crossContactWarnings,
          allergensTags: offResult.allergensTags,
          tracesTags: offResult.tracesTags,
        }
      )
      const ingredientText = baseResult.product.ingredientText || ''
      const hasAdequateIngredientData =
        ingredientText.trim().length > 20 && parseIngredients(ingredientText, 'barcode').length >= 3
      if (!hasAdequateIngredientData) {
        const fused = await buildScanFromCachedBarcodeProduct(params, offResult.barcode)
        void trackScanResultMetric({
          name: 'source_decision',
          barcode: offResult.barcode,
          payload: {
            chosen_source: fused?.ok ? 'cached_backfill' : 'off_insufficient_no_fallback',
            off_has_adequate_data: false,
          },
        })
        if (fused?.ok) return fused
        return {
          ok: false,
          error: 'Limited ingredient data for reliable analysis.',
          reason: 'insufficient_data',
          productName: baseResult.product.name,
        }
      }

      // Fire-and-forget — never block the scan path on Supabase
      void upsertProductToDatabase(offResult.offProduct, offResult.barcode).catch(() => {})

      const cached = await getCachedProductByBarcode(offResult.barcode)
      if (cached?.ingredient_text) {
        const offScore = scoreIngredientSource(
          ingredientText,
          'openfoodfacts',
          (offResult.offProduct as { last_modified_t?: number })?.last_modified_t
            ? new Date((offResult.offProduct as { last_modified_t: number }).last_modified_t * 1000).toISOString()
            : null
        )
        const cachedScore = scoreIngredientSource(
          cached.ingredient_text,
          cached.source ?? 'unknown',
          cached.updated_at
        )
        if (cachedScore >= offScore + 18) {
          void trackScanResultMetric({
            name: 'source_decision',
            barcode: offResult.barcode,
            payload: {
              chosen_source: 'cached_backfill',
              off_score: offScore,
              cached_score: cachedScore,
              score_margin: cachedScore - offScore,
              cached_source: cached.source ?? 'unknown',
            },
          })
          const fusedPreferred = await buildScanFromCachedBarcodeProduct(params, offResult.barcode, cached)
          if (fusedPreferred?.ok) return fusedPreferred
        }
        if (cachedScore < offScore + 18) {
          void trackScanResultMetric({
            name: 'source_decision',
            barcode: offResult.barcode,
            payload: {
              chosen_source: 'openfoodfacts',
              off_score: offScore,
              cached_score: cachedScore,
              score_margin: offScore - cachedScore,
              cached_source: cached.source ?? 'unknown',
            },
          })
        }
      }

      const dietaryProfile = await getUserProfileForScan()
      const celiacStrictGluten = Boolean(params.celiacStrictGluten ?? dietaryProfile.celiacStrictGluten)
      const userProfile = { allergies, sensitivities, preferences, goal, celiacStrictGluten }

      let result = personalizeScanResult(baseResult, userProfile)
      let finalResult = finalizeScanForPresentation(result, dietaryProfile)
      if (
        !isFillrDemoBarcode(barcode) &&
        finalResult.product.ingredientText.trim() &&
        finalResult.ingredientBreakdown.length > 0
      ) {
        finalResult = markScanFastPendingDecode(finalResult)
      }
      return { ok: true, result: finalResult, dietaryProfile }
    }
  } catch {
    /* mock path */
  }

  const baseMock = mockProductByBarcode(barcode)
  if (baseMock) {
    const dietaryProfile = await getUserProfileForScan()
    const celiacStrictGluten = Boolean(params.celiacStrictGluten ?? dietaryProfile.celiacStrictGluten)
    const userProfile = { allergies, sensitivities, preferences, goal, celiacStrictGluten }

    let result = personalizeScanResult(baseMock, userProfile)
    if (isFillrDemoBarcode(barcode)) {
      result = applyDemoScanProfileTailoring(result, userProfile)
    }
    let finalResult = finalizeScanForPresentation(result, dietaryProfile)
    if (
      !isFillrDemoBarcode(barcode) &&
      finalResult.product.ingredientText.trim() &&
      finalResult.ingredientBreakdown.length > 0
    ) {
      finalResult = markScanFastPendingDecode(finalResult)
    }
    return { ok: true, result: finalResult, dietaryProfile }
  }

  const fused = await buildScanFromCachedBarcodeProduct(params, barcode)
  void trackScanResultMetric({
    name: 'source_decision',
    barcode,
    payload: {
      chosen_source: fused?.ok ? 'cached_backfill' : 'none_not_found',
      off_lookup_ok: offResult.ok,
    },
  })
  if (fused?.ok) return fused

  return {
    ok: false,
    error: offResult.ok ? 'Product not found. Try scanning a different barcode.' : offResult.error,
    reason: 'not_found',
  }
}

export type EnrichScanAiOptions = {
  /** Pass for photo OCR / manual label text so the model uses the OCR system prefix. */
  fromOcr?: boolean
  ingredientParseSource?: IngredientTextParseSource
  /**
   * Emergency safety mode for low-end / unstable runtimes: skip heavy presentation finalize
   * and return merged AI copy directly.
   */
  skipFinalizePresentation?: boolean
}

/** Phase 2 — merge AI ingredient copy; keeps allergy `productVerdict` when the fast path had matches. */
export async function enrichScanResultWithAI(
  base: ScanResult,
  dietaryProfile: DietaryProfile,
  aiOptions?: EnrichScanAiOptions
): Promise<ScanResult> {
  const devDecodeLog = (stage: string, extra?: Record<string, unknown>) => {
    if (!__DEV__) return
    console.log('[Fillr][decode]', stage, {
      productId: base.product.id,
      source: base.scanSource ?? 'unknown',
      ...(extra ?? {}),
    })
  }
  const baseWithoutPending = clearPendingDecodeState(base)
  const text = base.product.ingredientText?.trim()
  if (!text) {
    devDecodeLog('decode_fallback_reason', { reason: 'missing_ingredient_text' })
    return baseWithoutPending
  }
  try {
    devDecodeLog('decode_enrich_started', {
      ingredientTextChars: text.length,
      fromOcr: Boolean(aiOptions?.fromOcr),
      ingredientParseSource: aiOptions?.ingredientParseSource ?? null,
    })
    const ai = await analyzeIngredientsWithTimeout(text, dietaryProfile, {
      nutritionJson: base.product.nutritionJson,
      skipIngredientRepair: true,
      requestTimeoutMs: 20_000,
      ...(aiOptions?.fromOcr ? { fromOcr: true as const } : {}),
      ...(aiOptions?.ingredientParseSource
        ? { ingredientParseSource: aiOptions.ingredientParseSource }
        : {}),
    })
    if (!ai) {
      console.warn('[Fillr] AI enrichment returned no analysis; using local presentation fallback')
      devDecodeLog('decode_fallback_reason', { reason: 'analyze_timeout_or_null' })
      if (aiOptions?.skipFinalizePresentation) {
        return baseWithoutPending
      }
      await yieldToMainThread()
      return finalizeScanForPresentation(baseWithoutPending, dietaryProfile)
    }
    devDecodeLog('decode_http_ok', {
      ingredientRows: ai.ingredients?.length ?? 0,
    })
    let merged = mergeAiAnalysisWithScan(ai, baseWithoutPending)
    devDecodeLog('decode_merged', {
      ingredientRows: merged.ingredientBreakdown.length,
    })
    // OCR: skip second-pass line repairs — they duplicate validate/repair work and can add minutes of
    // sequential HTTP when the user backgrounds the app (network failures + poor UX).
    if (!aiOptions?.fromOcr) {
      merged = await repairScanIngredientBreakdownGaps(merged, text, dietaryProfile)
    }
    merged = clearPendingDecodeState(merged)
    if (base.matchedAllergens.length > 0 && (base.productVerdict ?? '').trim()) {
      merged = { ...merged, productVerdict: base.productVerdict }
    }
    devDecodeLog('decode_merged_to_store', {
      ingredientRows: merged.ingredientBreakdown.length,
    })
    if (aiOptions?.skipFinalizePresentation) {
      return merged
    }
    // `finalizeScanForPresentation` is CPU-heavy; never run it in the same turn as the HTTP
    // response handler or the UI stays frozen until it completes.
    await yieldToMainThread()
    if (aiOptions?.fromOcr) {
      await yieldToMainThread()
    }
    return finalizeScanForPresentation(merged, dietaryProfile)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[Fillr] AI enrichment crashed; using local presentation fallback: ${msg}`)
    devDecodeLog('decode_fallback_reason', { reason: 'enrich_crash', message: msg })
    if (aiOptions?.skipFinalizePresentation) {
      return baseWithoutPending
    }
    await yieldToMainThread()
    return finalizeScanForPresentation(baseWithoutPending, dietaryProfile)
  }
}

/** Full pipeline (fast + AI) — for callers that still need a single awaited result. */
export async function scanProduct(
  params: ScanProductParams
): Promise<{ ok: true; result: ScanResult } | { ok: false; error: string }> {
  const fast = await scanProductFast(params)
  if (!fast.ok) return fast
  const enriched = await enrichScanResultWithAI(fast.result, fast.dietaryProfile)
  return { ok: true, result: enriched }
}

/**
 * Re-run allergen detection + Fillr mapping using user-pasted ingredients (same barcode / product metadata).
 */
export async function rescanWithManualIngredients(
  params: ScanProductParams & { currentResult: ScanResult; pastedIngredients: string }
): Promise<ScanResult> {
  const {
    barcode,
    allergies,
    sensitivities,
    preferences,
    goal,
    celiacStrictGluten,
    currentResult,
    pastedIngredients,
  } = params
  const dietaryProfile = await getUserProfileForScan()
  const celiac = Boolean(celiacStrictGluten ?? dietaryProfile.celiacStrictGluten)
  const userProfile = { allergies, sensitivities, preferences, goal, celiacStrictGluten: celiac }
  const pasted = pastedIngredients.trim()
  const product = currentResult.product

  const ingredients_text_safety = extractEnglishIngredientHaystackForSafetyFromBlob(pasted, 'barcode')
  const ingredients_text = extractEnglishIngredients({ ingredients_text: pasted }, 'barcode')

  const userConfig = buildUserAllergenConfig(allergies)
  const output = detectAllergensEvidenceBased(
    {
      product_name: product.name,
      ingredients_text,
      ingredients_text_safety,
      contains_text: '',
      may_contain_text: '',
      allergens_tags: product.allergensTags ?? [],
      traces_tags: product.tracesTags ?? [],
      ingredients: undefined,
      ingredients_tags: undefined,
    },
    userConfig
  )

  if (celiac) {
    const safety = ingredients_text_safety.trim() || ingredients_text
    const ingredients = safety
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean)
    const celiacMatches = runCeliacCheck(ingredients, safety)
    output.celiac = {
      celiacModeEnabled: true,
      matchedGlutenSignals: celiacMatches.map((m) => ({
        ingredient: m.ingredient,
        signalType: m.signalType,
        severity: m.severity,
        reason: m.reason,
      })),
      celiacSeverity: getCeliacSeverity(celiacMatches),
    }
  }

  const baseResult = mapDetectionToFillrResult(
    barcode,
    product.name,
    output,
    {
      allergies,
      sensitivities,
      preferences,
      goal,
      celiacStrictGluten: celiac,
      ingredientParseSource: 'barcode',
    },
    {
      brand: product.brand,
      nutritionJson: product.nutritionJson,
      crossContactWarnings: currentResult.crossContactWarnings,
      allergensTags: product.allergensTags,
      tracesTags: product.tracesTags,
    }
  )

  let result = personalizeScanResult(baseResult, userProfile)
  try {
    if (pasted) {
      const ai = await analyzeIngredientsWithTimeout(pasted, dietaryProfile, {
        nutritionJson: result.product.nutritionJson,
      })
      if (ai) {
        result = mergeAiAnalysisWithScan(ai, result)
      }
    }
  } catch {
    // keep rule-based breakdown
  }
  return finalizeScanForPresentation(
    {
      ...result,
      product: {
        ...result.product,
        id: product.id,
        barcode: product.barcode,
      },
    },
    dietaryProfile
  )
}

const DEFAULT_OCR_DISPLAY_NAME = DEFAULT_OCR_PRODUCT_NAME

export type CreateScanFromIngredientTextPayload = {
  result: ScanResult
  dietaryProfile: DietaryProfile
}

/**
 * Build a full scan from pasted or OCR-derived ingredient text (no Open Food Facts product).
 * By default defers OpenAI to the caller (`enrichScanResultWithAI`) so navigation is instant.
 */
export async function createScanResultFromIngredientText(
  params: Omit<ScanProductParams, 'barcode'> & {
    ingredientsList: string
    productDisplayName?: string
    scanSource: 'ocr' | 'manual'
    /** When false, waits for OpenAI before returning (slow). Default true — navigate first, enrich after. */
    deferIngredientAnalysis?: boolean
  }
): Promise<CreateScanFromIngredientTextPayload> {
  const dietaryProfile = await getUserProfileForScan()
  const celiac = Boolean(params.celiacStrictGluten ?? dietaryProfile.celiacStrictGluten)
  const userProfile = {
    allergies: params.allergies,
    sensitivities: params.sensitivities,
    preferences: params.preferences,
    goal: params.goal,
    celiacStrictGluten: celiac,
  }

  const ts = Date.now()
  const barcode = `ocr_${ts}`
  const productDisplayName =
    params.productDisplayName?.trim() ||
    (params.scanSource === 'ocr' ? DEFAULT_OCR_DISPLAY_NAME : 'Manual entry')

  let pasted = params.ingredientsList.trim()
  let ocrTranslatedFromFrench = false
  const parseSource = params.scanSource === 'ocr' ? 'ocr' : 'barcode'

  if (params.scanSource === 'ocr' && shouldTranslateFrenchOnlyIngredientLabel(pasted)) {
    const tr = await translateIngredientLabelToEnglish(pasted)
    if (tr) {
      pasted = tr
      ocrTranslatedFromFrench = true
    }
  }

  const ingredients_text_safety = extractEnglishIngredientHaystackForSafetyFromBlob(pasted, parseSource)
  const ingredients_text = extractEnglishIngredients({ ingredients_text: pasted }, parseSource)

  const userConfig = buildUserAllergenConfig(params.allergies)
  const output = detectAllergensEvidenceBased(
    {
      product_name: productDisplayName,
      ingredients_text,
      ingredients_text_safety,
      contains_text: '',
      may_contain_text: '',
      allergens_tags: [],
      traces_tags: [],
      ingredients: undefined,
      ingredients_tags: undefined,
    },
    userConfig
  )

  if (celiac) {
    const safety = ingredients_text_safety.trim() || ingredients_text
    const ingredients = safety.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
    const celiacMatches = runCeliacCheck(ingredients, safety)
    output.celiac = {
      celiacModeEnabled: true,
      matchedGlutenSignals: celiacMatches.map((m) => ({
        ingredient: m.ingredient,
        signalType: m.signalType,
        severity: m.severity,
        reason: m.reason,
      })),
      celiacSeverity: getCeliacSeverity(celiacMatches),
    }
  }

  const baseResult = mapDetectionToFillrResult(
    barcode,
    productDisplayName,
    output,
    {
      allergies: params.allergies,
      sensitivities: params.sensitivities,
      preferences: params.preferences,
      goal: params.goal,
      celiacStrictGluten: celiac,
      ingredientParseSource: parseSource,
    },
    {}
  )

  const patchedBase: ScanResult = {
    ...baseResult,
    scanSource: params.scanSource,
    ...(ocrTranslatedFromFrench ? { ocrTranslatedFromFrench: true } : {}),
    product: {
      ...baseResult.product,
      source: params.scanSource === 'ocr' ? 'photo_ocr' : 'manual_entry',
    },
  }

  let result = personalizeScanResult(patchedBase, userProfile)

  const deferAi = params.deferIngredientAnalysis !== false

  if (!deferAi && pasted) {
    try {
      const ai = await analyzeIngredientsWithTimeout(pasted, dietaryProfile, {
        fromOcr: params.scanSource === 'ocr',
        skipIngredientRepair: params.scanSource === 'ocr' ? false : true,
        ingredientParseSource: parseSource,
      })
      if (ai) {
        result = mergeAiAnalysisWithScan(ai, result)
      }
    } catch {
      // keep rule-based breakdown
    }
  }
  const finalizedBase = finalizeScanForPresentation(
    {
      ...result,
      scanSource: params.scanSource,
      product: {
        ...result.product,
        id: `prod_${barcode}`,
        barcode,
        name: productDisplayName,
        source: params.scanSource === 'ocr' ? 'photo_ocr' : 'manual_entry',
      },
    },
    dietaryProfile
  )
  const finalized =
    deferAi &&
    pasted &&
    finalizedBase.product.ingredientText.trim() &&
    finalizedBase.ingredientBreakdown.length > 0
      ? markScanFastPendingDecode(finalizedBase)
      : finalizedBase

  return { result: finalized, dietaryProfile }
}
