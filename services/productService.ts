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

function isFillrDemoBarcode(raw: string): boolean {
  return isDemoScanBarcode(raw)
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

  const [dietaryProfile, offResult] = await Promise.all([
    getUserProfileForScan(),
    scanBarcodeForAllergens({
      barcode,
      allergies,
      celiacStrictGluten: celiacForOff,
      langPreference: 'en',
    }).catch((): AllergenScanResult => ({
      ok: false,
      barcode: barcode.trim(),
      error: 'Could not reach Open Food Facts. Check your connection and try again.',
    })),
  ])

  const celiacStrictGluten = Boolean(params.celiacStrictGluten ?? dietaryProfile.celiacStrictGluten)
  const userProfile = { allergies, sensitivities, preferences, goal, celiacStrictGluten }

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
        return {
          ok: false,
          error: 'Limited ingredient data for reliable analysis.',
          reason: 'insufficient_data',
          productName: baseResult.product.name,
        }
      }
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

  return {
    ok: false,
    error: 'Product not found. Try scanning a different barcode.',
    reason: 'not_found',
  }
}

/** Phase 2 — merge AI ingredient copy; keeps allergy `productVerdict` when the fast path had matches. */
export async function enrichScanResultWithAI(
  base: ScanResult,
  dietaryProfile: DietaryProfile
): Promise<ScanResult> {
  const text = base.product.ingredientText?.trim()
  if (!text) return base
  try {
    const ai = await analyzeIngredientsWithOpenAI(text, dietaryProfile, {
      nutritionJson: base.product.nutritionJson,
      skipIngredientRepair: true,
    })
    if (!ai) return base
    let merged = mergeAiAnalysisWithScan(ai, base)
    if (base.matchedAllergens.length > 0 && (base.productVerdict ?? '').trim()) {
      merged = { ...merged, productVerdict: base.productVerdict }
    }
    return finalizeScanForPresentation(merged, dietaryProfile)
  } catch {
    return base
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
      const ai = await analyzeIngredientsWithOpenAI(pasted, dietaryProfile, {
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

/**
 * Build a full scan from pasted or OCR-derived ingredient text (no Open Food Facts product).
 */
export async function createScanResultFromIngredientText(
  params: Omit<ScanProductParams, 'barcode'> & {
    ingredientsList: string
    productDisplayName?: string
    scanSource: 'ocr' | 'manual'
  }
): Promise<ScanResult> {
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

  try {
    if (pasted) {
      const ai = await analyzeIngredientsWithOpenAI(pasted, dietaryProfile, {
        fromOcr: params.scanSource === 'ocr',
        skipIngredientRepair: params.scanSource === 'ocr' ? false : true,
        ingredientParseSource: parseSource,
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
}
