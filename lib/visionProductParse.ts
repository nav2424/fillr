import type { VisionNutritionFacts, VisionProductIdentification } from '../types'

export const VISION_CONFIDENCE_THRESHOLD = 0.65

type UnknownRecord = Record<string, unknown>

const NUTRITION_KEYS: Array<keyof VisionNutritionFacts> = [
  'serving_size',
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

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asNumber(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

function normalizeConfidence(value: unknown): number | null {
  const n = asNumber(value)
  if (n == null) return null
  if (n > 1 && n <= 100) return Math.min(1, n / 100)
  return Math.min(1, n)
}

function uniqueTexts(values: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const text = value.replace(/\s+/g, ' ').trim()
    if (!text) continue
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(text)
  }
  return out
}

function asTextArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return uniqueTexts(value.flatMap((item) => (typeof item === 'string' ? [item] : [])))
  }
  if (typeof value === 'string') {
    return uniqueTexts(value.split(/\r?\n|;/).flatMap((part) => part.split(',')).map((part) => part.trim()))
  }
  return []
}

function normalizeNutritionFacts(value: unknown): VisionNutritionFacts {
  if (!isRecord(value)) return {}
  const out: VisionNutritionFacts = {}
  for (const key of NUTRITION_KEYS) {
    const raw = value[key]
    if (key === 'serving_size') {
      const serving = asText(raw)
      if (serving) out.serving_size = serving
      continue
    }
    const n = asNumber(raw)
    if (n != null) {
      ;(out as Record<string, number>)[key] = n
    }
  }
  return out
}

function splitIngredientLine(line: string): string[] {
  const normalized = line
    .replace(/\bcontains?\s*:/gi, ', ')
    .replace(/\bcontaining\s*:/gi, ', ')
    .replace(/\bincludes?\s*:/gi, ', ')
    .replace(/\bincluding\s*:/gi, ', ')

  const parentheticalParts = Array.from(normalized.matchAll(/\(([^)]+)\)/g)).flatMap((match) =>
    match[1].split(/,|;/).map((part) => part.trim())
  )
  const withoutParens = normalized.replace(/\(([^)]+)\)/g, ' ')
  return [...withoutParens.split(/,|;/), ...parentheticalParts]
}

export function flattenVisionIngredients(ingredients: string[]): string[] {
  return uniqueTexts(ingredients.flatMap(splitIngredientLine))
}

export function normalizeVisionProductIdentification(value: unknown): VisionProductIdentification | null {
  if (!isRecord(value)) return null

  const productName = asText(value.product_name)
  if (!productName) return null

  const confidence = normalizeConfidence(value.confidence)
  if (confidence == null) return null

  return {
    product_name: productName,
    brand: asText(value.brand),
    variant: asText(value.variant),
    confidence,
    ingredients: flattenVisionIngredients(asTextArray(value.ingredients)),
    nutrition_facts: normalizeNutritionFacts(value.nutrition_facts),
    allergens: asTextArray(value.allergens),
    may_contain_allergens: asTextArray(value.may_contain_allergens),
    country_variant: asText(value.country_variant),
  }
}

export function visionMeetsConfidenceThreshold(identification: VisionProductIdentification): boolean {
  return (
    identification.product_name.trim().length > 0 &&
    identification.confidence >= VISION_CONFIDENCE_THRESHOLD
  )
}

export function visionDisplayName(identification: VisionProductIdentification): string {
  const name = identification.product_name.trim()
  const brand = identification.brand.trim()
  const variant = identification.variant.trim()
  const parts: string[] = []
  if (brand && !name.toLowerCase().startsWith(brand.toLowerCase())) parts.push(brand)
  parts.push(name || 'Unknown product')
  if (variant && !parts.join(' ').toLowerCase().includes(variant.toLowerCase())) parts.push(variant)
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

export function visionIngredientsText(identification: VisionProductIdentification): string {
  return flattenVisionIngredients(identification.ingredients).join(', ')
}

export function visionContainsAllergenText(identification: VisionProductIdentification): string {
  const allergens = uniqueTexts(identification.allergens)
  return allergens.length ? `Contains: ${allergens.join(', ')}` : ''
}

export function visionMayContainAllergenText(identification: VisionProductIdentification): string {
  const allergens = uniqueTexts(identification.may_contain_allergens)
  return allergens.length ? `May contain: ${allergens.join(', ')}` : ''
}

export function visionNutritionToProductJson(
  identification: VisionProductIdentification
): Record<string, unknown> {
  const facts = identification.nutrition_facts
  const out: Record<string, unknown> = {}
  if (facts.calories != null) out['energy-kcal_serving'] = facts.calories
  if (facts.fat_g != null) out.fat_serving = facts.fat_g
  if (facts.saturated_fat_g != null) out['saturated-fat_serving'] = facts.saturated_fat_g
  if (facts.trans_fat_g != null) out['trans-fat_serving'] = facts.trans_fat_g
  if (facts.carbohydrates_g != null) out.carbohydrates_serving = facts.carbohydrates_g
  if (facts.fibre_g != null) out.fiber_serving = facts.fibre_g
  if (facts.sugars_g != null) out.sugars_serving = facts.sugars_g
  if (facts.protein_g != null) out.proteins_serving = facts.protein_g
  if (facts.sodium_mg != null) out.sodium_serving_mg = facts.sodium_mg
  return out
}

