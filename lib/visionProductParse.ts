import type { VisionNutritionFacts, VisionProductIdentification } from '../types'

export const VISION_CONFIDENCE_THRESHOLD = 0.7

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const cleaned = cleanString(item)
      .replace(/^[\s\-*\u2022]+/, '')
      .replace(/\s+/g, ' ')
      .trim()
    const key = cleaned.toLowerCase()
    if (!cleaned || seen.has(key)) continue
    seen.add(key)
    out.push(cleaned)
  }
  return out
}

function finiteNumber(value: unknown): number | undefined {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(num) && num > 0 ? num : undefined
}

function normalizeNutritionFacts(value: unknown): VisionNutritionFacts {
  const raw = asRecord(value)
  if (!raw) return {}
  const facts: VisionNutritionFacts = {}
  const servingSize = cleanString(raw.serving_size)
  if (servingSize) facts.serving_size = servingSize
  const calories = finiteNumber(raw.calories)
  if (calories != null) facts.calories = calories
  const fat = finiteNumber(raw.fat_g)
  if (fat != null) facts.fat_g = fat
  const saturatedFat = finiteNumber(raw.saturated_fat_g)
  if (saturatedFat != null) facts.saturated_fat_g = saturatedFat
  const transFat = finiteNumber(raw.trans_fat_g)
  if (transFat != null) facts.trans_fat_g = transFat
  const carbs = finiteNumber(raw.carbohydrates_g)
  if (carbs != null) facts.carbohydrates_g = carbs
  const fibre = finiteNumber(raw.fibre_g)
  if (fibre != null) facts.fibre_g = fibre
  const sugars = finiteNumber(raw.sugars_g)
  if (sugars != null) facts.sugars_g = sugars
  const protein = finiteNumber(raw.protein_g)
  if (protein != null) facts.protein_g = protein
  const sodium = finiteNumber(raw.sodium_mg)
  if (sodium != null) facts.sodium_mg = sodium
  return facts
}

function uniquePush(out: string[], seen: Set<string>, value: string) {
  const cleaned = value.replace(/\s+/g, ' ').trim()
  const key = cleaned.toLowerCase()
  if (!cleaned || seen.has(key)) return
  seen.add(key)
  out.push(cleaned)
}

export function flattenVisionIngredients(ingredients: readonly string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of ingredients) {
    const item = String(raw ?? '').replace(/\s+/g, ' ').trim()
    if (!item) continue
    uniquePush(out, seen, item)

    const blendMatch = item.match(/\b(?:containing|contains):\s*(.+)$/i)
    if (!blendMatch) continue
    for (const part of blendMatch[1].split(/[,;]/)) {
      uniquePush(out, seen, part)
    }
  }
  return out
}

export function normalizeVisionProductIdentification(
  value: unknown
): VisionProductIdentification | null {
  const raw = asRecord(value)
  if (!raw) return null

  const confidenceRaw =
    typeof raw.confidence === 'number'
      ? raw.confidence
      : typeof raw.confidence === 'string'
        ? Number(raw.confidence)
        : NaN
  const confidence = Number.isFinite(confidenceRaw)
    ? Math.min(1, Math.max(0, confidenceRaw))
    : 0

  return {
    product_name: cleanString(raw.product_name),
    brand: cleanString(raw.brand),
    variant: cleanString(raw.variant),
    confidence,
    ingredients: flattenVisionIngredients(cleanStringArray(raw.ingredients)),
    nutrition_facts: normalizeNutritionFacts(raw.nutrition_facts),
    allergens: cleanStringArray(raw.allergens),
    may_contain_allergens: cleanStringArray(raw.may_contain_allergens),
    country_variant: cleanString(raw.country_variant),
  }
}

export function visionMeetsConfidenceThreshold(
  identification: VisionProductIdentification | null | undefined
): boolean {
  return Boolean(
    identification &&
      identification.confidence >= VISION_CONFIDENCE_THRESHOLD &&
      (identification.product_name.trim() || identification.brand.trim())
  )
}

export function visionDisplayName(identification: VisionProductIdentification): string {
  const productName = identification.product_name.trim()
  const brand = identification.brand.trim()
  const variant = identification.variant.trim()
  const base =
    brand && productName && !productName.toLowerCase().startsWith(brand.toLowerCase())
      ? `${brand} ${productName}`
      : productName || brand || 'Identified product'
  if (!variant || base.toLowerCase().includes(variant.toLowerCase())) return base
  return `${base} ${variant}`.trim()
}

export function visionIngredientsText(identification: VisionProductIdentification): string {
  return flattenVisionIngredients(identification.ingredients).join(', ')
}

export function visionContainsAllergenText(
  identification: VisionProductIdentification
): string {
  const allergens = cleanStringArray(identification.allergens)
  return allergens.length > 0 ? `Contains: ${allergens.join(', ')}` : ''
}

export function visionMayContainAllergenText(
  identification: VisionProductIdentification
): string {
  const allergens = cleanStringArray(identification.may_contain_allergens)
  return allergens.length > 0 ? `May contain: ${allergens.join(', ')}` : ''
}

export function visionNutritionToProductJson(
  identification: VisionProductIdentification
): Record<string, unknown> {
  const facts = identification.nutrition_facts
  const out: Record<string, unknown> = {}
  if (facts.serving_size) out.serving_size = facts.serving_size
  if (facts.calories) out['energy-kcal_serving'] = facts.calories
  if (facts.fat_g) out.fat_serving = facts.fat_g
  if (facts.saturated_fat_g) out['saturated-fat_serving'] = facts.saturated_fat_g
  if (facts.carbohydrates_g) out.carbohydrates_serving = facts.carbohydrates_g
  if (facts.fibre_g) out.fiber_serving = facts.fibre_g
  if (facts.sugars_g) out.sugars_serving = facts.sugars_g
  if (facts.protein_g) out.proteins_serving = facts.protein_g
  if (facts.sodium_mg) out.sodium_serving_mg = facts.sodium_mg
  return out
}
