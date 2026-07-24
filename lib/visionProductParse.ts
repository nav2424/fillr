import type { VisionNutritionFacts, VisionProductIdentification } from '../types'

export const VISION_CONFIDENCE_THRESHOLD = 0.7

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanNumber(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function normalizeConfidence(value: unknown): number {
  const raw = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(raw)) return 0
  const scaled = raw > 1 && raw <= 100 ? raw / 100 : raw
  return Math.max(0, Math.min(1, Math.round(scaled * 100) / 100))
}

function splitIngredientSubList(value: string): string[] {
  const out: string[] = []
  let current = ''
  let depth = 0
  for (const ch of value) {
    if (ch === '(' || ch === '[') depth += 1
    if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1)
    if ((ch === ',' || ch === ';') && depth === 0) {
      const part = current.trim()
      if (part) out.push(part)
      current = ''
    } else {
      current += ch
    }
  }
  const last = current.trim()
  if (last) out.push(last)
  return out
}

function cleanIngredient(value: string): string {
  return value
    .replace(/^(?:and\/or|and)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function flattenVisionIngredients(values: unknown): string[] {
  const rawValues = Array.isArray(values)
    ? values
    : typeof values === 'string'
      ? values.split(/\r?\n|,(?=\s*[A-Z][a-z])/)
      : []
  const out: string[] = []
  const seen = new Set<string>()

  function add(value: string) {
    const item = cleanIngredient(value)
    const key = item.toLowerCase()
    if (!item || seen.has(key)) return
    seen.add(key)
    out.push(item)
  }

  for (const raw of rawValues) {
    const item = cleanString(raw)
    if (!item) continue

    const subListMatch = item.match(/^(.*?\b(?:contains?|containing|including)\b)\s*:?\s+(.+)$/i)
    if (subListMatch) {
      const prefix = subListMatch[1]
        .replace(/\b(?:contains?|containing|including)\b\s*:?\s*$/i, '')
        .trim()
      if (prefix) add(prefix)
      splitIngredientSubList(subListMatch[2]).forEach(add)
      continue
    }

    const colonIndex = item.indexOf(':')
    if (colonIndex > 0 && colonIndex < item.length - 1) {
      const prefix = item.slice(0, colonIndex).trim()
      if (prefix) add(prefix)
      splitIngredientSubList(item.slice(colonIndex + 1)).forEach(add)
      continue
    }

    add(item)
  }

  return out
}

function normalizeTextArray(value: unknown): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/\r?\n|,/)
      : []
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of values) {
    const item = cleanString(raw).replace(/\s+/g, ' ')
    const key = item.toLowerCase()
    if (!item || seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

function normalizeNutritionFacts(value: unknown): VisionNutritionFacts {
  const src = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const facts: VisionNutritionFacts = {}
  const serving = cleanString(src.serving_size)
  if (serving) facts.serving_size = serving

  const numericKeys = [
    'calories',
    'fat_g',
    'saturated_fat_g',
    'trans_fat_g',
    'carbohydrates_g',
    'fibre_g',
    'sugars_g',
    'protein_g',
    'sodium_mg',
  ] as const
  for (const key of numericKeys) {
    const n = cleanNumber(src[key])
    if (n != null) facts[key] = n
  }
  return facts
}

export function normalizeVisionProductIdentification(value: unknown): VisionProductIdentification | null {
  if (!value || typeof value !== 'object') return null
  const src = value as Record<string, unknown>
  const productName = cleanString(src.product_name ?? src.name)
  if (!productName) return null

  return {
    product_name: productName,
    brand: cleanString(src.brand),
    variant: cleanString(src.variant),
    confidence: normalizeConfidence(src.confidence),
    ingredients: flattenVisionIngredients(src.ingredients),
    nutrition_facts: normalizeNutritionFacts(src.nutrition_facts),
    allergens: normalizeTextArray(src.allergens),
    may_contain_allergens: normalizeTextArray(src.may_contain_allergens),
    country_variant: cleanString(src.country_variant),
  }
}

export function visionMeetsConfidenceThreshold(id: VisionProductIdentification | null | undefined): boolean {
  return Boolean(id && id.confidence >= VISION_CONFIDENCE_THRESHOLD && id.product_name.trim())
}

export function visionDisplayName(id: VisionProductIdentification): string {
  return [id.brand, id.product_name, id.variant].map((s) => s.trim()).filter(Boolean).join(' ')
}

export function visionIngredientsText(id: VisionProductIdentification): string {
  return flattenVisionIngredients(id.ingredients).join(', ')
}

export function visionContainsAllergenText(id: VisionProductIdentification): string {
  const allergens = normalizeTextArray(id.allergens)
  return allergens.length > 0 ? `Contains: ${allergens.join(', ')}` : ''
}

export function visionMayContainAllergenText(id: VisionProductIdentification): string {
  const allergens = normalizeTextArray(id.may_contain_allergens)
  return allergens.length > 0 ? `May contain: ${allergens.join(', ')}` : ''
}

export function visionNutritionToProductJson(id: VisionProductIdentification): Record<string, unknown> {
  const facts = id.nutrition_facts ?? {}
  const out: Record<string, unknown> = {}
  if (facts.serving_size) out.serving_size = facts.serving_size
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

