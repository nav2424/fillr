import type { VisionNutritionFacts, VisionProductIdentification } from '../types'

export const VISION_CONFIDENCE_THRESHOLD = 0.7

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function positiveNumber(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function confidenceNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(cleanString).filter(Boolean)
  }
  const single = cleanString(value)
  return single ? [single] : []
}

function splitTopLevelList(value: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0

  for (let i = 0; i < value.length; i++) {
    const ch = value[i]
    if (ch === '(' || ch === '[') depth++
    if ((ch === ')' || ch === ']') && depth > 0) depth--
    if (depth === 0 && (ch === ',' || ch === ';')) {
      parts.push(value.slice(start, i))
      start = i + 1
    }
  }
  parts.push(value.slice(start))
  return parts.map(cleanString).filter(Boolean)
}

function normalizeNutritionFacts(value: unknown): VisionNutritionFacts {
  if (!value || typeof value !== 'object') return {}
  const raw = value as Record<string, unknown>
  const out: VisionNutritionFacts = {}

  const serving = cleanString(raw.serving_size)
  if (serving) out.serving_size = serving

  const fields: Array<[keyof VisionNutritionFacts, string]> = [
    ['calories', 'calories'],
    ['fat_g', 'fat_g'],
    ['saturated_fat_g', 'saturated_fat_g'],
    ['trans_fat_g', 'trans_fat_g'],
    ['carbohydrates_g', 'carbohydrates_g'],
    ['fibre_g', 'fibre_g'],
    ['sugars_g', 'sugars_g'],
    ['protein_g', 'protein_g'],
    ['sodium_mg', 'sodium_mg'],
  ]

  for (const [key, rawKey] of fields) {
    const n = positiveNumber(raw[rawKey])
    if (n != null) {
      ;(out as Record<string, number | string>)[key] = n
    }
  }

  return out
}

export function flattenVisionIngredients(ingredients: readonly string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()

  for (const raw of ingredients) {
    const item = cleanString(raw)
    if (!item) continue

    const sublistMatch = item.match(/\b(?:contains?|containing|including)\s*:\s*/i)
    const candidates = sublistMatch
      ? splitTopLevelList(item.slice((sublistMatch.index ?? 0) + sublistMatch[0].length))
      : splitTopLevelList(item)

    for (const candidate of candidates.length > 0 ? candidates : [item]) {
      const cleaned = cleanString(candidate.replace(/^[*-]\s*/, ''))
      if (!cleaned) continue
      const key = cleaned.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(cleaned)
    }
  }

  return out
}

export function normalizeVisionProductIdentification(value: unknown): VisionProductIdentification | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>

  return {
    product_name: cleanString(raw.product_name),
    brand: cleanString(raw.brand),
    variant: cleanString(raw.variant),
    confidence: confidenceNumber(raw.confidence),
    ingredients: flattenVisionIngredients(stringArray(raw.ingredients)),
    nutrition_facts: normalizeNutritionFacts(raw.nutrition_facts),
    allergens: stringArray(raw.allergens),
    may_contain_allergens: stringArray(raw.may_contain_allergens),
    country_variant: cleanString(raw.country_variant),
  }
}

export function visionMeetsConfidenceThreshold(identification: VisionProductIdentification | null | undefined): boolean {
  return (identification?.confidence ?? 0) >= VISION_CONFIDENCE_THRESHOLD
}

export function visionDisplayName(identification: VisionProductIdentification): string {
  const productName = identification.product_name.trim()
  const brand = identification.brand.trim()
  const variant = identification.variant.trim()
  const parts: string[] = []

  if (brand && (!productName || !productName.toLowerCase().includes(brand.toLowerCase()))) {
    parts.push(brand)
  }
  if (productName) parts.push(productName)
  if (variant && !parts.join(' ').toLowerCase().includes(variant.toLowerCase())) {
    parts.push(variant)
  }

  return parts.join(' ').trim() || 'Identified product'
}

export function visionIngredientsText(identification: VisionProductIdentification): string {
  return flattenVisionIngredients(identification.ingredients).join(', ')
}

export function visionContainsAllergenText(identification: VisionProductIdentification): string {
  const allergens = stringArray(identification.allergens)
  return allergens.length > 0 ? `Contains: ${allergens.join(', ')}` : ''
}

export function visionMayContainAllergenText(identification: VisionProductIdentification): string {
  const allergens = stringArray(identification.may_contain_allergens)
  return allergens.length > 0 ? `May contain: ${allergens.join(', ')}` : ''
}

export function visionNutritionToProductJson(
  identification: VisionProductIdentification
): Record<string, number | string> {
  const facts = identification.nutrition_facts ?? {}
  const out: Record<string, number | string> = {}

  if (facts.serving_size?.trim()) out.serving_size = facts.serving_size.trim()
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
