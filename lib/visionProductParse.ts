import type { VisionNutritionFacts, VisionProductIdentification } from '../types'
import { splitIngredientBlobOutsideParens } from './ingredientTextParsing'

export const VISION_CONFIDENCE_THRESHOLD = 0.5

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function finiteNumber(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? parseFloat(value) : NaN
  return Number.isFinite(n) ? n : undefined
}

function positiveNumber(value: unknown): number | undefined {
  const n = finiteNumber(value)
  return n != null && n > 0 ? n : undefined
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const value = cleanString(raw)
    if (!value) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return uniqueStrings(value.map(cleanString))
  }
  const text = cleanString(value)
  if (!text) return []
  return uniqueStrings(splitIngredientBlobOutsideParens(text).map(cleanString))
}

function splitVisionIngredientLine(line: string): string[] {
  const trimmed = cleanString(line).replace(/^ingredients?\s*:\s*/i, '')
  if (!trimmed) return []

  const containing = trimmed.match(/^(.+?)\b(?:containing|contains|including)\s*:\s*(.+)$/i)
  if (containing?.[2]) {
    const prefix = cleanString(containing[1])
    const inner = splitIngredientBlobOutsideParens(containing[2]).map(cleanString).filter(Boolean)
    if (/\b(blend|mix|seasoning|spices?|flavou?rs?)\b/i.test(prefix) && inner.length > 0) {
      return inner
    }
    return uniqueStrings([prefix, ...inner])
  }

  return splitIngredientBlobOutsideParens(trimmed).map(cleanString).filter(Boolean)
}

export function flattenVisionIngredients(ingredients: unknown): string[] {
  const lines = Array.isArray(ingredients)
    ? ingredients.map(cleanString)
    : stringArray(ingredients)
  return uniqueStrings(lines.flatMap(splitVisionIngredientLine))
}

function normalizeNutritionFacts(value: unknown): VisionNutritionFacts {
  const raw = asRecord(value)
  if (!raw) return {}
  const out: VisionNutritionFacts = {}
  const servingSize = cleanString(raw.serving_size ?? raw.servingSize)
  if (servingSize) out.serving_size = servingSize

  const calories = positiveNumber(raw.calories ?? raw.energy_kcal)
  if (calories != null) out.calories = Math.round(calories)

  const fat = positiveNumber(raw.fat_g ?? raw.fat)
  if (fat != null) out.fat_g = Math.round(fat * 10) / 10

  const saturatedFat = positiveNumber(raw.saturated_fat_g ?? raw.saturatedFatG)
  if (saturatedFat != null) out.saturated_fat_g = Math.round(saturatedFat * 10) / 10

  const transFat = positiveNumber(raw.trans_fat_g ?? raw.transFatG)
  if (transFat != null) out.trans_fat_g = Math.round(transFat * 10) / 10

  const carbs = positiveNumber(raw.carbohydrates_g ?? raw.carbs_g ?? raw.carbohydrates)
  if (carbs != null) out.carbohydrates_g = Math.round(carbs * 10) / 10

  const fibre = positiveNumber(raw.fibre_g ?? raw.fiber_g ?? raw.fibre ?? raw.fiber)
  if (fibre != null) out.fibre_g = Math.round(fibre * 10) / 10

  const sugars = positiveNumber(raw.sugars_g ?? raw.sugar_g ?? raw.sugars)
  if (sugars != null) out.sugars_g = Math.round(sugars * 10) / 10

  const protein = positiveNumber(raw.protein_g ?? raw.proteins_g ?? raw.protein)
  if (protein != null) out.protein_g = Math.round(protein * 10) / 10

  const sodium = positiveNumber(raw.sodium_mg ?? raw.sodium)
  if (sodium != null) out.sodium_mg = Math.round(sodium)

  return out
}

export function normalizeVisionProductIdentification(
  value: unknown
): VisionProductIdentification | null {
  const raw = asRecord(value)
  if (!raw) return null

  const productName = cleanString(raw.product_name ?? raw.productName ?? raw.name)
  const brand = cleanString(raw.brand)
  if (!productName && !brand) return null

  const confidence = finiteNumber(raw.confidence) ?? 0

  return {
    product_name: productName,
    brand,
    variant: cleanString(raw.variant),
    confidence: Math.min(1, Math.max(0, confidence)),
    ingredients: flattenVisionIngredients(raw.ingredients),
    nutrition_facts: normalizeNutritionFacts(raw.nutrition_facts ?? raw.nutritionFacts),
    allergens: stringArray(raw.allergens),
    may_contain_allergens: stringArray(raw.may_contain_allergens ?? raw.mayContainAllergens),
    country_variant: cleanString(raw.country_variant ?? raw.countryVariant),
  }
}

export function visionMeetsConfidenceThreshold(id: VisionProductIdentification): boolean {
  return id.confidence >= VISION_CONFIDENCE_THRESHOLD && Boolean(visionDisplayName(id).trim())
}

export function visionDisplayName(id: VisionProductIdentification): string {
  const name = cleanString(id.product_name)
  const variant = cleanString(id.variant)
  const brand = cleanString(id.brand)
  const base = name || brand || 'Identified product'
  if (!variant || base.toLowerCase().includes(variant.toLowerCase())) return base
  return `${base} ${variant}`.trim()
}

export function visionIngredientsText(id: VisionProductIdentification): string {
  return flattenVisionIngredients(id.ingredients).join(', ')
}

export function visionContainsAllergenText(id: VisionProductIdentification): string {
  const allergens = uniqueStrings(id.allergens ?? [])
  return allergens.length > 0 ? `Contains: ${allergens.join(', ')}` : ''
}

export function visionMayContainAllergenText(id: VisionProductIdentification): string {
  const allergens = uniqueStrings(id.may_contain_allergens ?? [])
  return allergens.length > 0 ? `May contain: ${allergens.join(', ')}` : ''
}

export function visionNutritionToProductJson(
  id: VisionProductIdentification
): Record<string, unknown> {
  const facts = id.nutrition_facts ?? {}
  const out: Record<string, unknown> = {}
  if (facts.calories) out['energy-kcal_serving'] = facts.calories
  if (facts.fat_g) out.fat_serving = facts.fat_g
  if (facts.saturated_fat_g) out['saturated-fat_serving'] = facts.saturated_fat_g
  if (facts.trans_fat_g) out['trans-fat_serving'] = facts.trans_fat_g
  if (facts.carbohydrates_g) out.carbohydrates_serving = facts.carbohydrates_g
  if (facts.fibre_g) out.fiber_serving = facts.fibre_g
  if (facts.sugars_g) out.sugars_serving = facts.sugars_g
  if (facts.protein_g) out.proteins_serving = facts.protein_g
  if (facts.sodium_mg) out.sodium_serving_mg = facts.sodium_mg
  return out
}

