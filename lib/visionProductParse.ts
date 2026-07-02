import type { VisionNutritionFacts, VisionProductIdentification } from '../types'

export const VISION_CONFIDENCE_THRESHOLD = 0.7

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function finiteNumber(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : NaN
  return Number.isFinite(n) ? n : undefined
}

function normalizeConfidence(value: unknown): number {
  const n = finiteNumber(value)
  if (n == null) return 0
  if (n > 1 && n <= 100) return Math.max(0, Math.min(1, n / 100))
  return Math.max(0, Math.min(1, n))
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const s = stringValue(item)
    if (!s) continue
    const key = s.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
  }
  return out
}

function nutritionNumber(value: unknown): number | undefined {
  const n = finiteNumber(value)
  if (n == null || n < 0) return undefined
  return Math.round(n * 10) / 10
}

function normalizeNutritionFacts(value: unknown): VisionNutritionFacts {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const facts: VisionNutritionFacts = {}
  const servingSize = stringValue(source.serving_size)
  if (servingSize) facts.serving_size = servingSize

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
    const n = nutritionNumber(source[key])
    if (n != null) facts[key] = n
  }
  return facts
}

function splitTopLevelList(value: string): string[] {
  const parts: string[] = []
  let current = ''
  let depth = 0
  for (const ch of value) {
    if (ch === '(' || ch === '[' || ch === '{') depth++
    if (ch === ')' || ch === ']' || ch === '}') depth = Math.max(0, depth - 1)
    if ((ch === ',' || ch === ';') && depth === 0) {
      const part = current.trim()
      if (part) parts.push(part)
      current = ''
      continue
    }
    current += ch
  }
  const last = current.trim()
  if (last) parts.push(last)
  return parts
}

function pushUnique(out: string[], seen: Set<string>, raw: string): void {
  const item = raw.replace(/\s+/g, ' ').trim()
  if (!item) return
  const key = item.toLowerCase()
  if (seen.has(key)) return
  seen.add(key)
  out.push(item)
}

export function flattenVisionIngredients(ingredients: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()

  for (const raw of ingredients) {
    const item = stringValue(raw)
    if (!item) continue

    const disclosureMatch = item.match(/\b(?:contains?|containing|including)\s*:?\s+/i)
    if (!disclosureMatch || disclosureMatch.index == null) {
      pushUnique(out, seen, item)
      continue
    }

    const prefix = item.slice(0, disclosureMatch.index).trim().replace(/[:,-]\s*$/, '')
    const rest = item.slice(disclosureMatch.index + disclosureMatch[0].length).trim()
    if (prefix) pushUnique(out, seen, prefix)
    for (const part of splitTopLevelList(rest)) {
      pushUnique(out, seen, part)
    }
  }

  return out
}

export function normalizeVisionProductIdentification(input: unknown): VisionProductIdentification | null {
  if (!input || typeof input !== 'object') return null
  const source = input as Record<string, unknown>
  const productName = stringValue(source.product_name)
  const brand = stringValue(source.brand)
  const confidence = normalizeConfidence(source.confidence)

  if (!productName && confidence >= VISION_CONFIDENCE_THRESHOLD) return null

  return {
    product_name: productName,
    brand,
    variant: stringValue(source.variant),
    confidence,
    ingredients: flattenVisionIngredients(stringArray(source.ingredients)),
    nutrition_facts: normalizeNutritionFacts(source.nutrition_facts),
    allergens: stringArray(source.allergens),
    may_contain_allergens: stringArray(source.may_contain_allergens),
    country_variant: stringValue(source.country_variant),
  }
}

export function visionMeetsConfidenceThreshold(identification: VisionProductIdentification | null | undefined): boolean {
  return Boolean(
    identification &&
      identification.confidence >= VISION_CONFIDENCE_THRESHOLD &&
      identification.product_name.trim()
  )
}

export function visionDisplayName(identification: VisionProductIdentification): string {
  const brand = identification.brand.trim()
  const name = identification.product_name.trim()
  const variant = identification.variant.trim()
  const base =
    brand && name && !name.toLowerCase().includes(brand.toLowerCase())
      ? `${brand} ${name}`
      : name || brand || 'Identified product'
  return variant && !base.toLowerCase().includes(variant.toLowerCase()) ? `${base} ${variant}` : base
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

function addNutritionValue(out: Record<string, unknown>, key: string, value: number | undefined): void {
  if (value == null || value <= 0) return
  out[key] = value
}

export function visionNutritionToProductJson(
  identification: VisionProductIdentification
): Record<string, unknown> {
  const facts = identification.nutrition_facts
  const out: Record<string, unknown> = {}
  if (facts.serving_size?.trim()) out.serving_size = facts.serving_size.trim()
  addNutritionValue(out, 'energy-kcal_serving', facts.calories)
  addNutritionValue(out, 'fat_serving', facts.fat_g)
  addNutritionValue(out, 'saturated-fat_serving', facts.saturated_fat_g)
  addNutritionValue(out, 'trans-fat_serving', facts.trans_fat_g)
  addNutritionValue(out, 'carbohydrates_serving', facts.carbohydrates_g)
  addNutritionValue(out, 'fiber_serving', facts.fibre_g)
  addNutritionValue(out, 'sugars_serving', facts.sugars_g)
  addNutritionValue(out, 'proteins_serving', facts.protein_g)
  addNutritionValue(out, 'sodium_serving_mg', facts.sodium_mg)
  return out
}

