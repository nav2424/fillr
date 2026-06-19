import type { VisionNutritionFacts, VisionProductIdentification } from '../types'

export const VISION_CONFIDENCE_THRESHOLD = 0.65

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanNumber(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

function cleanStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(cleanString).filter(Boolean)
  }
  const single = cleanString(value)
  return single ? [single] : []
}

function nutritionNumber(o: JsonRecord, key: keyof VisionNutritionFacts): number | undefined {
  return cleanNumber(o[key])
}

function normalizeNutritionFacts(value: unknown): VisionNutritionFacts {
  const o = asRecord(value)
  if (!o) return {}

  const facts: VisionNutritionFacts = {}
  const servingSize = cleanString(o.serving_size)
  if (servingSize) facts.serving_size = servingSize

  const numericKeys: Array<keyof VisionNutritionFacts> = [
    'calories',
    'fat_g',
    'saturated_fat_g',
    'trans_fat_g',
    'carbohydrates_g',
    'fibre_g',
    'sugars_g',
    'protein_g',
    'sodium_mg',
  ]

  for (const key of numericKeys) {
    const n = nutritionNumber(o, key)
    if (n != null) facts[key] = n as never
  }

  return facts
}

function splitIngredientBlob(text: string): string[] {
  const cleaned = text.trim()
  if (!cleaned) return []

  const containingMatch = cleaned.match(/^(.+?)\s+(?:containing|contains)\s*:\s*(.+)$/i)
  const prefix = containingMatch?.[1]?.trim()
  const listText = containingMatch?.[2]?.trim() || cleaned
  const pieces = listText
    .split(/\s*(?:,|;|\band\/or\b|\band\b)\s*/i)
    .map((x) => x.replace(/[().]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  if (prefix && pieces.length > 0) {
    return [prefix, ...pieces]
  }

  if (pieces.length > 1) return pieces
  return [cleaned]
}

export function flattenVisionIngredients(ingredients: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of ingredients) {
    for (const piece of splitIngredientBlob(item)) {
      const key = piece.toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push(piece)
    }
  }
  return out
}

export function normalizeVisionProductIdentification(
  value: unknown
): VisionProductIdentification | null {
  const o = asRecord(value)
  if (!o) return null

  const productName = cleanString(o.product_name)
  if (!productName) return null

  const confidence = cleanNumber(o.confidence)
  if (confidence == null) return null

  return {
    product_name: productName,
    brand: cleanString(o.brand),
    variant: cleanString(o.variant),
    confidence: Math.max(0, Math.min(1, confidence)),
    ingredients: flattenVisionIngredients(cleanStringArray(o.ingredients)),
    nutrition_facts: normalizeNutritionFacts(o.nutrition_facts),
    allergens: cleanStringArray(o.allergens),
    may_contain_allergens: cleanStringArray(o.may_contain_allergens),
    country_variant: cleanString(o.country_variant),
  }
}

export function visionDisplayName(identification: VisionProductIdentification): string {
  const brand = identification.brand.trim()
  const productName = identification.product_name.trim()
  const variant = identification.variant.trim()
  const base = brand && !productName.toLowerCase().startsWith(brand.toLowerCase())
    ? `${brand} ${productName}`
    : productName || brand
  return [base, variant].filter(Boolean).join(' - ') || 'Identified product'
}

export function visionIngredientsText(identification: VisionProductIdentification): string {
  return flattenVisionIngredients(identification.ingredients).join(', ')
}

export function visionContainsAllergenText(identification: VisionProductIdentification): string {
  const allergens = identification.allergens.map((x) => x.trim()).filter(Boolean)
  return allergens.length > 0 ? `Contains: ${allergens.join(', ')}` : ''
}

export function visionMayContainAllergenText(identification: VisionProductIdentification): string {
  const allergens = identification.may_contain_allergens.map((x) => x.trim()).filter(Boolean)
  return allergens.length > 0 ? `May contain: ${allergens.join(', ')}` : ''
}

export function visionMeetsConfidenceThreshold(
  identification: Pick<VisionProductIdentification, 'confidence'>
): boolean {
  return identification.confidence >= VISION_CONFIDENCE_THRESHOLD
}

export function visionNutritionToProductJson(
  identification: VisionProductIdentification
): Record<string, unknown> {
  const facts = identification.nutrition_facts
  const out: Record<string, unknown> = {}
  if (facts.calories != null) out['energy-kcal_serving'] = facts.calories
  if (facts.fat_g != null) out.fat_serving = facts.fat_g
  if (facts.saturated_fat_g != null) out['saturated-fat_serving'] = facts.saturated_fat_g
  if (facts.carbohydrates_g != null) out.carbohydrates_serving = facts.carbohydrates_g
  if (facts.fibre_g != null) out.fiber_serving = facts.fibre_g
  if (facts.sugars_g != null) out.sugars_serving = facts.sugars_g
  if (facts.protein_g != null) out.proteins_serving = facts.protein_g
  if (facts.sodium_mg != null) out.sodium_serving_mg = facts.sodium_mg
  return out
}
