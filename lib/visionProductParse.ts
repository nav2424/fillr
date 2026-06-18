import type { VisionNutritionFacts, VisionProductIdentification } from '../types'

export const VISION_CONFIDENCE_THRESHOLD = 0.7

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function cleanString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function cleanStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of v) {
    const text = cleanString(item).replace(/\s+/g, ' ')
    if (!text) continue
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(text)
  }
  return out
}

function cleanNumber(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number.parseFloat(v) : NaN
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function cleanNutritionFacts(v: unknown): VisionNutritionFacts {
  const raw = asRecord(v)
  if (!raw) return {}

  const facts: VisionNutritionFacts = {}
  const serving = cleanString(raw.serving_size)
  if (serving) facts.serving_size = serving

  const numericKeys: Array<keyof Omit<VisionNutritionFacts, 'serving_size'>> = [
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
    const n = cleanNumber(raw[key])
    if (n != null) facts[key] = n
  }

  return facts
}

function splitIngredientBlob(text: string): string[] {
  const normalized = text
    .replace(/\bcontaining\s*:/gi, ',')
    .replace(/\bcontains\s*:/gi, ',')
    .replace(/\bingredients\s*:/gi, ',')

  return normalized
    .split(/[,;]+/)
    .map((x) => x.trim())
    .filter(Boolean)
}

export function flattenVisionIngredients(ingredients: unknown): string[] {
  const raw = cleanStringArray(ingredients)
  const flattened: string[] = []
  const seen = new Set<string>()

  for (const item of raw) {
    const pieces = /\b(containing|contains|ingredients)\s*:/i.test(item) ? splitIngredientBlob(item) : [item]
    for (const piece of pieces) {
      const text = piece.replace(/\s+/g, ' ').trim()
      if (!text) continue
      const key = text.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      flattened.push(text)
    }
  }

  return flattened
}

export function normalizeVisionProductIdentification(input: unknown): VisionProductIdentification | null {
  const raw = asRecord(input)
  if (!raw) return null

  const productName = cleanString(raw.product_name).replace(/\s+/g, ' ')
  const brand = cleanString(raw.brand).replace(/\s+/g, ' ')
  const confidenceRaw =
    typeof raw.confidence === 'number'
      ? raw.confidence
      : typeof raw.confidence === 'string'
        ? Number.parseFloat(raw.confidence)
        : NaN
  const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0

  if (!productName && !brand && confidence <= 0) return null

  return {
    product_name: productName,
    brand,
    variant: cleanString(raw.variant).replace(/\s+/g, ' '),
    confidence,
    ingredients: flattenVisionIngredients(raw.ingredients),
    nutrition_facts: cleanNutritionFacts(raw.nutrition_facts),
    allergens: cleanStringArray(raw.allergens),
    may_contain_allergens: cleanStringArray(raw.may_contain_allergens),
    country_variant: cleanString(raw.country_variant).replace(/\s+/g, ' '),
  }
}

export function visionMeetsConfidenceThreshold(id: VisionProductIdentification): boolean {
  return id.confidence >= VISION_CONFIDENCE_THRESHOLD && Boolean(visionDisplayName(id).trim())
}

export function visionDisplayName(id: VisionProductIdentification): string {
  const parts = [id.brand, id.product_name, id.variant]
    .map((x) => x.trim())
    .filter(Boolean)
  const seen = new Set<string>()
  return parts
    .filter((part) => {
      const key = part.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .join(' ')
    .trim()
}

export function visionIngredientsText(id: VisionProductIdentification): string {
  return flattenVisionIngredients(id.ingredients).join(', ')
}

export function visionContainsAllergenText(id: VisionProductIdentification): string {
  const allergens = cleanStringArray(id.allergens)
  return allergens.length > 0 ? `Contains: ${allergens.join(', ')}` : ''
}

export function visionMayContainAllergenText(id: VisionProductIdentification): string {
  const allergens = cleanStringArray(id.may_contain_allergens)
  return allergens.length > 0 ? `May contain: ${allergens.join(', ')}` : ''
}

export function visionNutritionToProductJson(id: VisionProductIdentification): Record<string, unknown> {
  const facts = cleanNutritionFacts(id.nutrition_facts)
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
  if (facts.serving_size) out.serving_size = facts.serving_size

  return out
}

