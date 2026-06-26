import type { VisionNutritionFacts, VisionProductIdentification } from '../types'

export const VISION_CONFIDENCE_THRESHOLD = 0.7

const NUTRITION_NUMBER_KEYS = [
  'calories',
  'fat_g',
  'saturated_fat_g',
  'trans_fat_g',
  'carbohydrates_g',
  'fibre_g',
  'sugars_g',
  'protein_g',
  'sodium_mg',
] as const satisfies readonly (keyof VisionNutritionFacts)[]

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanNumber(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const text = cleanText(item).replace(/\s+/g, ' ')
    const key = text.toLowerCase()
    if (!text || seen.has(key)) continue
    seen.add(key)
    out.push(text)
  }
  return out
}

function normalizeNutritionFacts(value: unknown): VisionNutritionFacts {
  const record = asRecord(value)
  if (!record) return {}
  const out: VisionNutritionFacts = {}
  const servingSize = cleanText(record.serving_size)
  if (servingSize) out.serving_size = servingSize
  for (const key of NUTRITION_NUMBER_KEYS) {
    const n = cleanNumber(record[key])
    if (n !== undefined) out[key] = n
  }
  return out
}

function splitTopLevelIngredientList(text: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '(' || ch === '[') depth++
    else if ((ch === ')' || ch === ']') && depth > 0) depth--
    else if (depth === 0 && (ch === ',' || ch === ';')) {
      const part = text.slice(start, i).trim()
      if (part) parts.push(part)
      start = i + 1
    }
  }
  const last = text.slice(start).trim()
  if (last) parts.push(last)
  return parts
}

export function flattenVisionIngredients(ingredients: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const add = (item: string) => {
    const text = item.trim().replace(/\s+/g, ' ')
    const key = text.toLowerCase()
    if (!text || seen.has(key)) return
    seen.add(key)
    out.push(text)
  }

  for (const raw of ingredients) {
    const text = raw.trim()
    if (!text) continue
    const containing = text.match(/^(.+?)\b(?:containing|contains)\s*:\s*(.+)$/i)
    if (containing) {
      add(containing[1])
      for (const part of splitTopLevelIngredientList(containing[2])) add(part)
      continue
    }
    add(text)
  }
  return out
}

export function normalizeVisionProductIdentification(value: unknown): VisionProductIdentification | null {
  const record = asRecord(value)
  if (!record) return null

  const confidence = cleanNumber(record.confidence) ?? 0
  return {
    product_name: cleanText(record.product_name),
    brand: cleanText(record.brand),
    variant: cleanText(record.variant),
    confidence: Math.min(1, confidence),
    ingredients: normalizeList(record.ingredients),
    nutrition_facts: normalizeNutritionFacts(record.nutrition_facts),
    allergens: normalizeList(record.allergens),
    may_contain_allergens: normalizeList(record.may_contain_allergens),
    country_variant: cleanText(record.country_variant),
  }
}

export function visionMeetsConfidenceThreshold(
  identification: VisionProductIdentification | null | undefined
): boolean {
  if (!identification) return false
  const hasVisibleIdentity = Boolean(
    identification.product_name.trim() || identification.brand.trim()
  )
  return hasVisibleIdentity && identification.confidence >= VISION_CONFIDENCE_THRESHOLD
}

export function visionDisplayName(identification: VisionProductIdentification): string {
  const product = identification.product_name.trim()
  const brand = identification.brand.trim()
  const variant = identification.variant.trim()
  const productLower = product.toLowerCase()
  const parts: string[] = []
  if (brand && !productLower.includes(brand.toLowerCase())) parts.push(brand)
  if (product) parts.push(product)
  if (variant && !productLower.includes(variant.toLowerCase())) parts.push(variant)
  return parts.join(' ').trim() || 'Identified product'
}

export function visionIngredientsText(identification: VisionProductIdentification): string {
  return flattenVisionIngredients(identification.ingredients).join(', ')
}

export function visionContainsAllergenText(identification: VisionProductIdentification): string {
  return identification.allergens.length ? `Contains: ${identification.allergens.join(', ')}` : ''
}

export function visionMayContainAllergenText(identification: VisionProductIdentification): string {
  return identification.may_contain_allergens.length
    ? `May contain: ${identification.may_contain_allergens.join(', ')}`
    : ''
}

export function visionNutritionToProductJson(
  identification: VisionProductIdentification
): Record<string, unknown> {
  const facts = identification.nutrition_facts
  const out: Record<string, unknown> = {}
  if (facts.serving_size?.trim()) out.serving_size = facts.serving_size.trim()
  if (typeof facts.calories === 'number') out['energy-kcal_serving'] = facts.calories
  if (typeof facts.fat_g === 'number') out.fat_serving = facts.fat_g
  if (typeof facts.saturated_fat_g === 'number') out['saturated-fat_serving'] = facts.saturated_fat_g
  if (typeof facts.trans_fat_g === 'number') out['trans-fat_serving'] = facts.trans_fat_g
  if (typeof facts.carbohydrates_g === 'number') out.carbohydrates_serving = facts.carbohydrates_g
  if (typeof facts.fibre_g === 'number') out.fiber_serving = facts.fibre_g
  if (typeof facts.sugars_g === 'number') out.sugars_serving = facts.sugars_g
  if (typeof facts.protein_g === 'number') out.proteins_serving = facts.protein_g
  if (typeof facts.sodium_mg === 'number') out.sodium_serving_mg = facts.sodium_mg
  return out
}
