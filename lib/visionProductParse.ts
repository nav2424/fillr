import type { VisionNutritionFacts, VisionProductIdentification } from '../types'

export const VISION_CONFIDENCE_THRESHOLD = 0.7

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const text = cleanText(item)
    if (!text) continue
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(text)
  }
  return out
}

function cleanNumber(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(n) || n < 0) return undefined
  return n
}

function normalizeConfidence(value: unknown): number {
  const n = cleanNumber(value)
  if (n == null) return 0
  return Math.max(0, Math.min(1, n))
}

function normalizeNutritionFacts(value: unknown): VisionNutritionFacts {
  const raw = value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
  const out: VisionNutritionFacts = {}
  const serving = cleanText(raw.serving_size)
  if (serving) out.serving_size = serving

  const numericKeys = [
    'calories',
    'fat_g',
    'saturated_fat_g',
    'trans_fat_g',
    'carbohydrates_g',
    'fibre_g',
    'sugars_g',
    'protein_g',
    'sodium_mg',
  ] as const

  for (const key of numericKeys) {
    const n = cleanNumber(raw[key])
    if (n != null) out[key] = n
  }

  return out
}

function splitDelimitedIngredient(text: string): string[] {
  const markerMatch = text.match(/\b(?:containing|contains|including)\s*:\s*/i)
  if (!markerMatch?.index) return [text]

  const prefix = text.slice(0, markerMatch.index).trim()
  const remainder = text.slice(markerMatch.index + markerMatch[0].length).trim()
  const parts = remainder
    .split(/\s*,\s*|\s*;\s*/)
    .map((part) => part.trim())
    .filter(Boolean)

  return [prefix, ...parts].filter(Boolean)
}

export function flattenVisionIngredients(ingredients: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const ingredient of ingredients) {
    for (const part of splitDelimitedIngredient(ingredient)) {
      const text = part.trim()
      if (!text) continue
      const key = text.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(text)
    }
  }
  return out
}

export function normalizeVisionProductIdentification(
  value: unknown
): VisionProductIdentification | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const productName = cleanText(raw.product_name)
  const brand = cleanText(raw.brand)
  const confidence = normalizeConfidence(raw.confidence)

  if (!productName && !brand) return null

  return {
    product_name: productName,
    brand,
    variant: cleanText(raw.variant),
    confidence,
    ingredients: flattenVisionIngredients(cleanTextArray(raw.ingredients)),
    nutrition_facts: normalizeNutritionFacts(raw.nutrition_facts),
    allergens: cleanTextArray(raw.allergens),
    may_contain_allergens: cleanTextArray(raw.may_contain_allergens),
    country_variant: cleanText(raw.country_variant),
  }
}

export function visionDisplayName(identification: VisionProductIdentification): string {
  const parts = [
    identification.brand,
    identification.product_name,
    identification.variant,
  ].map((part) => part.trim()).filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : 'Vision-scanned product'
}

export function visionContainsAllergenText(identification: VisionProductIdentification): string {
  const allergens = identification.allergens.map((a) => a.trim()).filter(Boolean)
  return allergens.length > 0 ? `Contains: ${allergens.join(', ')}` : ''
}

export function visionMayContainAllergenText(identification: VisionProductIdentification): string {
  const allergens = identification.may_contain_allergens.map((a) => a.trim()).filter(Boolean)
  return allergens.length > 0 ? `May contain: ${allergens.join(', ')}` : ''
}

export function visionIngredientsText(identification: VisionProductIdentification): string {
  const lines = [
    ...identification.ingredients,
    visionContainsAllergenText(identification),
    visionMayContainAllergenText(identification),
  ]
    .map((line) => line.trim())
    .filter(Boolean)
  return lines.join(', ')
}

export function visionMeetsConfidenceThreshold(
  identification: VisionProductIdentification
): boolean {
  return identification.confidence >= VISION_CONFIDENCE_THRESHOLD
}

export function visionNutritionToProductJson(
  identification: VisionProductIdentification
): Record<string, unknown> {
  const facts = identification.nutrition_facts
  const out: Record<string, unknown> = {}
  if (facts.serving_size) out.serving_size = facts.serving_size
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

