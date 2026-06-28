import type { VisionNutritionFacts, VisionProductIdentification } from '../types'

export const VISION_CONFIDENCE_THRESHOLD = 0.7

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanTextArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(cleanText).filter(Boolean)
  }
  const text = cleanText(value)
  if (!text) return []
  return text
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean)
}

function cleanNumber(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function cleanNutritionFacts(value: unknown): VisionNutritionFacts {
  if (!value || typeof value !== 'object') return {}
  const raw = value as Record<string, unknown>
  return {
    ...(cleanText(raw.serving_size) ? { serving_size: cleanText(raw.serving_size) } : {}),
    ...(cleanNumber(raw.calories) != null ? { calories: cleanNumber(raw.calories) } : {}),
    ...(cleanNumber(raw.fat_g) != null ? { fat_g: cleanNumber(raw.fat_g) } : {}),
    ...(cleanNumber(raw.saturated_fat_g) != null ? { saturated_fat_g: cleanNumber(raw.saturated_fat_g) } : {}),
    ...(cleanNumber(raw.trans_fat_g) != null ? { trans_fat_g: cleanNumber(raw.trans_fat_g) } : {}),
    ...(cleanNumber(raw.carbohydrates_g) != null ? { carbohydrates_g: cleanNumber(raw.carbohydrates_g) } : {}),
    ...(cleanNumber(raw.fibre_g) != null ? { fibre_g: cleanNumber(raw.fibre_g) } : {}),
    ...(cleanNumber(raw.sugars_g) != null ? { sugars_g: cleanNumber(raw.sugars_g) } : {}),
    ...(cleanNumber(raw.protein_g) != null ? { protein_g: cleanNumber(raw.protein_g) } : {}),
    ...(cleanNumber(raw.sodium_mg) != null ? { sodium_mg: cleanNumber(raw.sodium_mg) } : {}),
  }
}

function uniquePreservingCase(values: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const text = value.trim()
    const key = text.toLowerCase()
    if (!text || seen.has(key)) continue
    seen.add(key)
    out.push(text)
  }
  return out
}

function splitIngredientBlob(value: string): string[] {
  const normalized = value
    .replace(/\bingredients?\s*:\s*/i, '')
    .replace(/\bcontains?\s*:\s*/i, 'containing: ')
    .trim()
  if (!normalized) return []

  const pieces: string[] = []
  const containing = normalized.split(/\bcontaining\s*:\s*/i)
  if (containing.length > 1) {
    pieces.push(containing[0])
    pieces.push(...containing.slice(1).join(', ').split(/[,;]+/))
    return pieces.map((x) => x.trim()).filter(Boolean)
  }

  const parenMatches = [...normalized.matchAll(/\(([^)]+)\)/g)].flatMap((match) =>
    match[1].split(/[,;]|\band\/or\b|\bor\b/i)
  )
  const withoutParens = normalized.replace(/\([^)]*\)/g, '').trim()
  pieces.push(withoutParens || normalized)
  pieces.push(...parenMatches)
  return pieces.map((x) => x.trim()).filter(Boolean)
}

export function flattenVisionIngredients(ingredients: string[]): string[] {
  return uniquePreservingCase(ingredients.flatMap(splitIngredientBlob))
}

export function normalizeVisionProductIdentification(raw: unknown): VisionProductIdentification | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  const productName = cleanText(value.product_name)
  if (!productName) return null

  const confidenceRaw =
    typeof value.confidence === 'number'
      ? value.confidence
      : typeof value.confidence === 'string'
        ? Number(value.confidence)
        : NaN
  const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0

  return {
    product_name: productName,
    brand: cleanText(value.brand),
    variant: cleanText(value.variant),
    confidence,
    ingredients: flattenVisionIngredients(cleanTextArray(value.ingredients)),
    nutrition_facts: cleanNutritionFacts(value.nutrition_facts),
    allergens: uniquePreservingCase(cleanTextArray(value.allergens)),
    may_contain_allergens: uniquePreservingCase(cleanTextArray(value.may_contain_allergens)),
    country_variant: cleanText(value.country_variant),
  }
}

export function visionDisplayName(identification: VisionProductIdentification): string {
  return [identification.brand, identification.product_name, identification.variant]
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x, idx, arr) => arr.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === idx)
    .join(' ')
    .trim()
}

export function visionContainsAllergenText(identification: VisionProductIdentification): string {
  const allergens = uniquePreservingCase(identification.allergens)
  return allergens.length > 0 ? `Contains: ${allergens.join(', ')}` : ''
}

export function visionMayContainAllergenText(identification: VisionProductIdentification): string {
  const allergens = uniquePreservingCase(identification.may_contain_allergens)
  return allergens.length > 0 ? `May contain: ${allergens.join(', ')}` : ''
}

export function visionIngredientsText(identification: VisionProductIdentification): string {
  return flattenVisionIngredients(identification.ingredients).join(', ')
}

export function visionNutritionToProductJson(
  identification: VisionProductIdentification
): Record<string, unknown> {
  const facts = identification.nutrition_facts
  return {
    ...(facts.calories != null ? { 'energy-kcal_serving': facts.calories } : {}),
    ...(facts.fat_g != null ? { fat_serving: facts.fat_g } : {}),
    ...(facts.saturated_fat_g != null ? { 'saturated-fat_serving': facts.saturated_fat_g } : {}),
    ...(facts.carbohydrates_g != null ? { carbohydrates_serving: facts.carbohydrates_g } : {}),
    ...(facts.fibre_g != null ? { fiber_serving: facts.fibre_g } : {}),
    ...(facts.sugars_g != null ? { sugars_serving: facts.sugars_g } : {}),
    ...(facts.protein_g != null ? { proteins_serving: facts.protein_g } : {}),
    ...(facts.sodium_mg != null ? { sodium_serving_mg: facts.sodium_mg } : {}),
  }
}

export function visionMeetsConfidenceThreshold(
  identification: VisionProductIdentification,
  threshold = VISION_CONFIDENCE_THRESHOLD
): boolean {
  return identification.product_name.trim().length > 0 && identification.confidence >= threshold
}

