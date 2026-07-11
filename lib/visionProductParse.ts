import type { VisionNutritionFacts, VisionProductIdentification } from '../types'

export const VISION_CONFIDENCE_THRESHOLD = 0.7

type UnknownRecord = Record<string, unknown>

const NUTRITION_KEYS: Array<keyof VisionNutritionFacts> = [
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
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(asString).filter(Boolean)
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string' || !value.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function normalizeNutrition(value: unknown): VisionNutritionFacts {
  if (!isRecord(value)) return {}
  const facts: VisionNutritionFacts = {}
  const servingSize = asString(value.serving_size)
  if (servingSize) facts.serving_size = servingSize
  for (const key of NUTRITION_KEYS) {
    const n = asNumber(value[key])
    if (n !== undefined) facts[key] = n
  }
  return facts
}

function splitIngredientBlob(text: string): string[] {
  return text
    .replace(/\b(?:ingredients?|contains?|including|containing)\s*:\s*/gi, ', ')
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function flattenIngredientLine(line: string): string[] {
  const normalized = line.trim()
  if (!normalized) return []

  const parts: string[] = [normalized]
  const parenMatches = normalized.matchAll(/\(([^()]*)\)/g)
  for (const match of parenMatches) {
    parts.push(...splitIngredientBlob(match[1] ?? ''))
  }

  if (/\b(?:ingredients?|contains?|including|containing)\s*:/i.test(normalized)) {
    parts.push(...splitIngredientBlob(normalized))
  }

  const seen = new Set<string>()
  return parts.filter((part) => {
    const key = part.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function flattenVisionIngredients(ingredients: string[]): string[] {
  return ingredients.flatMap(flattenIngredientLine)
}

export function normalizeVisionProductIdentification(value: unknown): VisionProductIdentification | null {
  if (!isRecord(value)) return null

  const productName = asString(value.product_name)
  const ingredients = flattenVisionIngredients(asStringArray(value.ingredients))
  const confidence = asNumber(value.confidence)

  if (!productName || confidence === undefined || confidence < 0 || confidence > 1) {
    return null
  }

  return {
    product_name: productName,
    brand: asString(value.brand),
    variant: asString(value.variant),
    confidence,
    ingredients,
    nutrition_facts: normalizeNutrition(value.nutrition_facts),
    allergens: asStringArray(value.allergens),
    may_contain_allergens: asStringArray(value.may_contain_allergens),
    country_variant: asString(value.country_variant),
  }
}

export function visionDisplayName(identification: VisionProductIdentification): string {
  return [identification.brand, identification.product_name, identification.variant]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ')
}

export function visionIngredientsText(identification: VisionProductIdentification): string {
  return flattenVisionIngredients(identification.ingredients).join(', ')
}

export function visionContainsAllergenText(identification: VisionProductIdentification): string {
  return identification.allergens.length > 0 ? `Contains: ${identification.allergens.join(', ')}` : ''
}

export function visionMayContainAllergenText(identification: VisionProductIdentification): string {
  return identification.may_contain_allergens.length > 0
    ? `May contain: ${identification.may_contain_allergens.join(', ')}`
    : ''
}

export function visionNutritionToProductJson(
  identification: VisionProductIdentification
): Record<string, unknown> {
  const facts = identification.nutrition_facts
  const json: Record<string, unknown> = {}
  if (facts.calories !== undefined) json.energy_kcal_serving = facts.calories
  if (facts.fat_g !== undefined) json.fat_serving = facts.fat_g
  if (facts.saturated_fat_g !== undefined) json.saturated_fat_serving = facts.saturated_fat_g
  if (facts.trans_fat_g !== undefined) json.trans_fat_serving = facts.trans_fat_g
  if (facts.carbohydrates_g !== undefined) json.carbohydrates_serving = facts.carbohydrates_g
  if (facts.fibre_g !== undefined) json.fiber_serving = facts.fibre_g
  if (facts.sugars_g !== undefined) json.sugars_serving = facts.sugars_g
  if (facts.protein_g !== undefined) json.proteins_serving = facts.protein_g
  if (facts.sodium_mg !== undefined) json.sodium_serving = facts.sodium_mg / 1000
  if (facts.serving_size) json.serving_size = facts.serving_size
  return json
}

export function visionMeetsConfidenceThreshold(
  identification: VisionProductIdentification,
  threshold = VISION_CONFIDENCE_THRESHOLD
): boolean {
  return identification.confidence >= threshold
}

