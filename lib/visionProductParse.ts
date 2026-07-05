import type { VisionNutritionFacts, VisionProductIdentification } from '../types'

export const VISION_CONFIDENCE_THRESHOLD = 0.7

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function finiteNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(n) ? n : 0
}

function confidenceNumber(value: unknown): number {
  const n = finiteNumber(value)
  if (n > 1 && n <= 100) return Math.max(0, Math.min(1, n / 100))
  return Math.max(0, Math.min(1, n))
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(cleanString).filter(Boolean)
  }
  const s = cleanString(value)
  if (!s) return []
  return s
    .split(/\r?\n|;/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function normalizeNutritionFacts(value: unknown): VisionNutritionFacts {
  if (!value || typeof value !== 'object') return {}
  const o = value as Record<string, unknown>
  const out: VisionNutritionFacts = {}
  const serving = cleanString(o.serving_size)
  if (serving) out.serving_size = serving

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
    const n = finiteNumber(o[key])
    if (n > 0) out[key] = n
  }
  return out
}

export function flattenVisionIngredients(ingredients: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (value: string) => {
    const cleaned = value.trim().replace(/\s+/g, ' ')
    const key = cleaned.toLowerCase()
    if (!cleaned || seen.has(key)) return
    seen.add(key)
    out.push(cleaned)
  }

  for (const ingredient of ingredients) {
    const line = cleanString(ingredient)
    if (!line) continue
    const containingMatch = line.match(/^(.+?)\s+(?:blend\s+)?containing:\s*(.+)$/i)
    if (containingMatch) {
      push(containingMatch[1])
      containingMatch[2]
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach(push)
      continue
    }
    push(line)
  }
  return out
}

export function normalizeVisionProductIdentification(
  raw: unknown
): VisionProductIdentification | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const productName = cleanString(o.product_name)
  const brand = cleanString(o.brand)
  const confidence = confidenceNumber(o.confidence)

  if (!productName && !brand) return null

  return {
    product_name: productName,
    brand,
    variant: cleanString(o.variant),
    confidence,
    ingredients: flattenVisionIngredients(stringList(o.ingredients)),
    nutrition_facts: normalizeNutritionFacts(o.nutrition_facts),
    allergens: stringList(o.allergens),
    may_contain_allergens: stringList(o.may_contain_allergens),
    country_variant: cleanString(o.country_variant),
  }
}

export function visionMeetsConfidenceThreshold(
  identification: VisionProductIdentification | null | undefined
): boolean {
  return Boolean(identification && identification.confidence >= VISION_CONFIDENCE_THRESHOLD)
}

export function visionDisplayName(identification: VisionProductIdentification): string {
  const productName = identification.product_name.trim()
  const brand = identification.brand.trim()
  const variant = identification.variant.trim()
  const parts: string[] = []
  if (brand && !productName.toLowerCase().includes(brand.toLowerCase())) parts.push(brand)
  if (productName) parts.push(productName)
  if (variant && !parts.join(' ').toLowerCase().includes(variant.toLowerCase())) parts.push(variant)
  return parts.join(' ').trim() || 'Identified product'
}

export function visionIngredientsText(identification: VisionProductIdentification): string {
  return flattenVisionIngredients(identification.ingredients).join(', ')
}

export function visionContainsAllergenText(identification: VisionProductIdentification): string {
  const allergens = stringList(identification.allergens)
  return allergens.length > 0 ? `Contains: ${allergens.join(', ')}` : ''
}

export function visionMayContainAllergenText(identification: VisionProductIdentification): string {
  const allergens = stringList(identification.may_contain_allergens)
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
  if (facts.trans_fat_g) out['trans-fat_serving'] = facts.trans_fat_g
  if (facts.carbohydrates_g) out.carbohydrates_serving = facts.carbohydrates_g
  if (facts.fibre_g) out.fiber_serving = facts.fibre_g
  if (facts.sugars_g) out.sugars_serving = facts.sugars_g
  if (facts.protein_g) out.proteins_serving = facts.protein_g
  if (facts.sodium_mg) out.sodium_serving_mg = facts.sodium_mg
  return out
}
