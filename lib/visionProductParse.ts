import type { VisionNutritionFacts, VisionProductIdentification } from '../types'

export const VISION_CONFIDENCE_THRESHOLD = 0.7

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? parseFloat(value) : NaN
  return Number.isFinite(n) && n > 0 ? n : 0
}

function cleanList(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const text = asText(value).replace(/\s+/g, ' ')
    if (!text) continue
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(text)
  }
  return out
}

function splitFlatIngredient(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim()
  const match = normalized.match(/\b(?:containing|contains|including)\s*:\s*(.+)$/i)
  if (!match) return [normalized]

  const prefix = normalized.slice(0, match.index).trim().replace(/[,:;]\s*$/, '')
  const subIngredients = match[1]
    .split(/[,;]+/)
    .map((x) => x.trim())
    .filter(Boolean)

  return [prefix, ...subIngredients].filter(Boolean)
}

export function flattenVisionIngredients(values: unknown): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const value of cleanList(values)) {
    for (const item of splitFlatIngredient(value)) {
      const key = item.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(item)
    }
  }
  return out
}

function normalizeNutritionFacts(value: unknown): VisionNutritionFacts {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const servingSize = asText(raw.serving_size)
  const facts: VisionNutritionFacts = {}
  if (servingSize) facts.serving_size = servingSize

  const keys: Array<keyof Omit<VisionNutritionFacts, 'serving_size'>> = [
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
  for (const key of keys) {
    const n = asNumber(raw[key])
    if (n > 0) facts[key] = n
  }
  return facts
}

export function normalizeVisionProductIdentification(value: unknown): VisionProductIdentification | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const productName = asText(raw.product_name)
  const brand = asText(raw.brand)
  const confidence = asNumber(raw.confidence)
  if (!productName || !brand || confidence <= 0) return null

  return {
    product_name: productName,
    brand,
    variant: asText(raw.variant),
    confidence: Math.max(0, Math.min(1, confidence)),
    ingredients: flattenVisionIngredients(raw.ingredients),
    nutrition_facts: normalizeNutritionFacts(raw.nutrition_facts),
    allergens: cleanList(raw.allergens),
    may_contain_allergens: cleanList(raw.may_contain_allergens),
    country_variant: asText(raw.country_variant),
  }
}

export function visionMeetsConfidenceThreshold(identification: VisionProductIdentification): boolean {
  return identification.confidence >= VISION_CONFIDENCE_THRESHOLD
}

export function visionDisplayName(identification: VisionProductIdentification): string {
  const parts = [identification.brand, identification.product_name, identification.variant]
    .map((x) => x.trim())
    .filter(Boolean)
  return parts.join(' ')
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
  const out: Record<string, unknown> = {}
  if (facts.serving_size) out.serving_size = facts.serving_size
  if (facts.calories) out['energy-kcal_serving'] = facts.calories
  if (facts.fat_g) out.fat_serving = facts.fat_g
  if (facts.carbohydrates_g) out.carbohydrates_serving = facts.carbohydrates_g
  if (facts.sugars_g) out.sugars_serving = facts.sugars_g
  if (facts.protein_g) out.proteins_serving = facts.protein_g
  if (facts.sodium_mg) out.sodium_serving_mg = facts.sodium_mg
  if (facts.fibre_g) out.fiber_serving = facts.fibre_g
  return out
}
