import { detectAllergensEvidenceBased, buildUserAllergenConfig } from './allergenEngine'
import { normalizeOFFProduct, type OFFProductLike } from './allergenEngine/offNormalizer'
import type { DetectionOutput } from './allergenEngine'
import { getCeliacSeverity, runCeliacCheck } from './allergenEngine/matcher'
import { fetchOpenFoodFactsProduct } from './openFoodFactsFetch'
import { buildProductName } from './buildProductName'

function pickNutrimentsForProduct(raw: unknown): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const n = raw as Record<string, unknown>
  const keys = [
    'energy-kcal_100g',
    'energy-kcal_serving',
    'energy_100g',
    'fat_100g',
    'saturated-fat_100g',
    'carbohydrates_100g',
    'sugars_100g',
    'fiber_100g',
    'proteins_100g',
    'protein_100g',
    'salt_100g',
    'salt_serving',
    'sodium_100g',
    'sodium_serving',
    'omega-3-fat_100g',
    'omega-6-fat_100g',
    'trans-fat_100g',
    'cholesterol_100g',
  ] as const
  const out: Record<string, unknown> = {}
  for (const k of keys) {
    const v = n[k]
    if (v !== undefined && v !== null && v !== '') out[k] = v
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** Lightweight OFF allergen payload for cache-backed scans (ingredient text may come from DB). */
export type OffAllergenSupplement = {
  allergensTags?: string[]
  tracesTags?: string[]
  containsText?: string
  mayContainText?: string
  crossContactWarnings?: string[]
  ingredientsTextSafety?: string
}

export type AllergenScanResult =
  | {
      ok: true
      barcode: string
      productName: string
      output: DetectionOutput
      /** Subset of Open Food Facts `nutriments` for prompts / UI. */
      nutritionJson?: Record<string, unknown>
      brand?: string
      crossContactWarnings?: string[]
      allergensTags?: string[]
      tracesTags?: string[]
      /** Raw OFF product document (for Supabase `products` cache upserts). */
      offProduct: OFFProductLike
    }
  | {
      ok: false
      barcode: string
      error: string
    }

export async function scanBarcodeForAllergens(params: {
  barcode: string
  allergies: string[]
  celiacStrictGluten?: boolean
  langPreference?: 'en' | 'fr' | 'auto'
}): Promise<AllergenScanResult> {
  const barcode = params.barcode.trim()
  if (!barcode) return { ok: false, barcode, error: 'Missing barcode' }

  let data: { status?: number; product?: OFFProductLike } | null
  try {
    data = await fetchOpenFoodFactsProduct(barcode)
  } catch {
    return { ok: false, barcode, error: 'Could not reach Open Food Facts. Check your connection and try again.' }
  }
  if (!data) return { ok: false, barcode, error: 'Open Food Facts did not respond. Try again in a moment.' }

  const product = data.product
  if (data.status !== 1 || !product) {
    return { ok: false, barcode, error: 'Product not found in Open Food Facts' }
  }

  const norm = normalizeOFFProduct(product, params.langPreference ?? 'en')
  const productName: string =
    norm?.product_name?.trim() ||
    buildProductName({
      brands: typeof product.brands === 'string' ? product.brands : undefined,
      product_name_en: product.product_name_en,
      product_name: product.product_name,
      product_name_fr: product.product_name_fr,
    })

  const userConfig = buildUserAllergenConfig(params.allergies)
  const output = detectAllergensEvidenceBased(
    {
      product_name: productName,
      ingredients_text: norm?.ingredients_text || '',
      ingredients_text_safety: norm?.ingredients_text_safety || '',
      contains_text: norm?.contains_text || '',
      may_contain_text: norm?.may_contain_text || '',
      allergens_tags: norm?.allergens_tags || [],
      traces_tags: norm?.traces_tags || [],
      ingredients: norm?.ingredients,
      ingredients_tags: norm?.ingredients_tags,
    },
    userConfig
  )

  if (params.celiacStrictGluten) {
    const safety = String(norm?.ingredients_text_safety || norm?.ingredients_text || '')
    const ingredients = safety
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean)
    const fullProductText = [
      safety,
      norm?.contains_text || '',
      norm?.may_contain_text || '',
    ]
      .join(' ')
      .trim()
    const celiacMatches = runCeliacCheck(ingredients, fullProductText)
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

  const nutritionJson = pickNutrimentsForProduct(product?.nutriments)
  const brandsTags = product?.brands_tags
  const firstBrandTag =
    Array.isArray(brandsTags) && brandsTags.length > 0 ? String(brandsTags[0]) : ''
  const brandRaw = (norm?.brands || product?.brands || firstBrandTag || '').toString().trim()
  const brand = brandRaw ? brandRaw.split(',')[0].trim() : undefined

  return {
    ok: true,
    barcode,
    productName,
    output,
    nutritionJson,
    brand,
    crossContactWarnings: norm?.cross_contact_warnings,
    allergensTags: norm?.allergens_tags,
    tracesTags: norm?.traces_tags,
    offProduct: product as OFFProductLike,
  }
}

export function offAllergenSupplementFromNorm(
  norm: ReturnType<typeof normalizeOFFProduct>
): OffAllergenSupplement | null {
  if (!norm) return null
  const supplement: OffAllergenSupplement = {
    allergensTags: norm.allergens_tags,
    tracesTags: norm.traces_tags,
    containsText: norm.contains_text,
    mayContainText: norm.may_contain_text,
    crossContactWarnings: norm.cross_contact_warnings,
    ingredientsTextSafety: norm.ingredients_text_safety,
  }
  const hasData =
    (supplement.allergensTags?.length ?? 0) > 0 ||
    (supplement.tracesTags?.length ?? 0) > 0 ||
    Boolean(supplement.containsText?.trim()) ||
    Boolean(supplement.mayContainText?.trim()) ||
    (supplement.crossContactWarnings?.length ?? 0) > 0 ||
    Boolean(supplement.ingredientsTextSafety?.trim())
  return hasData ? supplement : null
}

export async function fetchOffAllergenSupplement(
  barcode: string
): Promise<OffAllergenSupplement | null> {
  const bc = barcode.trim()
  if (!bc) return null
  try {
    const data = await fetchOpenFoodFactsProduct(bc)
    if (data?.status !== 1 || !data.product) return null
    const norm = normalizeOFFProduct(data.product, 'en')
    return offAllergenSupplementFromNorm(norm)
  } catch {
    return null
  }
}
