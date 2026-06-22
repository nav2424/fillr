import type { VisionNutritionFacts, VisionProductIdentification } from '../types'

export const VISION_CONFIDENCE_THRESHOLD = 0.7

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of value) {
    const text = cleanString(item)
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
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

function normalizeNutritionFacts(value: unknown): VisionNutritionFacts {
  if (!value || typeof value !== 'object') return {}
  const raw = value as Record<string, unknown>
  const facts: VisionNutritionFacts = {}
  const servingSize = cleanString(raw.serving_size)
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
    const n = cleanNumber(raw[key])
    if (n !== undefined) facts[key] = n
  }
  return facts
}

function splitIngredientParts(text: string): string[] {
  const normalized = text
    .replace(/\s+/g, ' ')
    .replace(/\bcontaining\s*:/gi, ',')
    .replace(/\bcontains\s*:/gi, ',')
    .trim()
  if (!normalized) return []

  const parts = [normalized]
  const parenMatches = normalized.match(/\(([^)]*)\)/g) ?? []
  for (const match of parenMatches) {
    const inner = match.slice(1, -1)
    parts.push(...inner.split(/,|\band\/or\b|\bor\b/gi))
  }
  parts.push(...normalized.replace(/\([^)]*\)/g, '').split(/[,;]/))
  return parts.map((part) => part.trim()).filter(Boolean)
}

export function flattenVisionIngredients(ingredients: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const ingredient of ingredients) {
    for (const part of splitIngredientParts(ingredient)) {
      const key = part.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(part)
    }
  }
  return out
}

export function normalizeVisionProductIdentification(
  value: unknown
): VisionProductIdentification | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const productName = cleanString(raw.product_name)
  const confidence = cleanNumber(raw.confidence)
  if (!productName || confidence === undefined) return null

  return {
    product_name: productName,
    brand: cleanString(raw.brand),
    variant: cleanString(raw.variant),
    confidence: Math.max(0, Math.min(1, confidence)),
    ingredients: flattenVisionIngredients(cleanStringArray(raw.ingredients)),
    nutrition_facts: normalizeNutritionFacts(raw.nutrition_facts),
    allergens: cleanStringArray(raw.allergens),
    may_contain_allergens: cleanStringArray(raw.may_contain_allergens),
    country_variant: cleanString(raw.country_variant),
  }
}

export function visionMeetsConfidenceThreshold(
  identification: VisionProductIdentification,
  threshold = VISION_CONFIDENCE_THRESHOLD
): boolean {
  return identification.confidence >= threshold
}

export function visionDisplayName(identification: VisionProductIdentification): string {
  return [identification.brand, identification.product_name, identification.variant]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ')
}

export function visionIngredientsText(identification: VisionProductIdentification): string {
  return identification.ingredients.join(', ')
}

export function visionContainsAllergenText(identification: VisionProductIdentification): string {
  return identification.allergens.length > 0
    ? `Contains: ${identification.allergens.join(', ')}`
    : ''
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
  if (facts.calories !== undefined) out['energy-kcal_serving'] = facts.calories
  if (facts.fat_g !== undefined) out.fat_serving = facts.fat_g
  if (facts.saturated_fat_g !== undefined) out['saturated-fat_serving'] = facts.saturated_fat_g
  if (facts.trans_fat_g !== undefined) out['trans-fat_serving'] = facts.trans_fat_g
  if (facts.carbohydrates_g !== undefined) out.carbohydrates_serving = facts.carbohydrates_g
  if (facts.fibre_g !== undefined) out.fiber_serving = facts.fibre_g
  if (facts.sugars_g !== undefined) out.sugars_serving = facts.sugars_g
  if (facts.protein_g !== undefined) out.proteins_serving = facts.protein_g
  if (facts.sodium_mg !== undefined) out.sodium_serving_mg = facts.sodium_mg
  return out
}

