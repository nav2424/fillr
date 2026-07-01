import type { VisionNutritionFacts, VisionProductIdentification } from '../types'

export const VISION_CONFIDENCE_THRESHOLD = 0.7

function asRecord(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null
}

function cleanString(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : raw == null ? '' : String(raw).trim()
}

function cleanNumber(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.trim()) : NaN
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function cleanNutritionNumber(raw: unknown): number | undefined {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.trim()) : NaN
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function uniqueStrings(values: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const v = value.trim().replace(/\s+/g, ' ')
    const key = v.toLowerCase()
    if (!v || seen.has(key)) continue
    seen.add(key)
    out.push(v)
  }
  return out
}

function splitOutsideParens(value: string): string[] {
  const parts: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of value) {
    if (ch === '(') depth++
    if (ch === ')') depth = Math.max(0, depth - 1)
    if ((ch === ',' || ch === ';') && depth === 0) {
      parts.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  parts.push(cur)
  return parts.map((p) => p.trim()).filter(Boolean)
}

function stringArray(raw: unknown, splitStrings = false): string[] {
  const values = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : []
  const out: string[] = []
  for (const value of values) {
    const s = cleanString(value)
    if (!s) continue
    out.push(...(splitStrings ? splitOutsideParens(s) : [s]))
  }
  return uniqueStrings(out)
}

export function flattenVisionIngredients(ingredients: string[]): string[] {
  const out: string[] = []
  for (const ingredient of ingredients) {
    const value = cleanString(ingredient)
    if (!value) continue

    const containingMatch = value.match(/\b(?:containing|contains|including)\s*:/i)
    if (!containingMatch || containingMatch.index == null) {
      out.push(value)
      continue
    }

    const prefix = value.slice(0, containingMatch.index).trim().replace(/[,:;]+$/, '')
    if (prefix) out.push(prefix)
    const remainder = value.slice(containingMatch.index + containingMatch[0].length)
    out.push(...splitOutsideParens(remainder))
  }
  return uniqueStrings(out)
}

function normalizeNutritionFacts(raw: unknown): VisionNutritionFacts {
  const r = asRecord(raw) ?? {}
  const servingSize = cleanString(r.serving_size)
  return {
    ...(servingSize ? { serving_size: servingSize } : {}),
    ...(cleanNutritionNumber(r.calories) ? { calories: cleanNutritionNumber(r.calories) } : {}),
    ...(cleanNutritionNumber(r.fat_g) ? { fat_g: cleanNutritionNumber(r.fat_g) } : {}),
    ...(cleanNutritionNumber(r.saturated_fat_g)
      ? { saturated_fat_g: cleanNutritionNumber(r.saturated_fat_g) }
      : {}),
    ...(cleanNutritionNumber(r.trans_fat_g) ? { trans_fat_g: cleanNutritionNumber(r.trans_fat_g) } : {}),
    ...(cleanNutritionNumber(r.carbohydrates_g)
      ? { carbohydrates_g: cleanNutritionNumber(r.carbohydrates_g) }
      : {}),
    ...(cleanNutritionNumber(r.fibre_g) ? { fibre_g: cleanNutritionNumber(r.fibre_g) } : {}),
    ...(cleanNutritionNumber(r.sugars_g) ? { sugars_g: cleanNutritionNumber(r.sugars_g) } : {}),
    ...(cleanNutritionNumber(r.protein_g) ? { protein_g: cleanNutritionNumber(r.protein_g) } : {}),
    ...(cleanNutritionNumber(r.sodium_mg) ? { sodium_mg: cleanNutritionNumber(r.sodium_mg) } : {}),
  }
}

export function normalizeVisionProductIdentification(raw: unknown): VisionProductIdentification | null {
  const r = asRecord(raw)
  if (!r) return null

  const productName = cleanString(r.product_name)
  const brand = cleanString(r.brand)
  if (!productName && !brand) return null

  return {
    product_name: productName || brand,
    brand,
    variant: cleanString(r.variant),
    confidence: cleanNumber(r.confidence),
    ingredients: flattenVisionIngredients(stringArray(r.ingredients, true)),
    nutrition_facts: normalizeNutritionFacts(r.nutrition_facts),
    allergens: stringArray(r.allergens, true),
    may_contain_allergens: stringArray(r.may_contain_allergens, true),
    country_variant: cleanString(r.country_variant),
  }
}

export function visionDisplayName(identification: VisionProductIdentification): string {
  const brand = identification.brand.trim()
  const name = identification.product_name.trim()
  const variant = identification.variant.trim()
  const lowerName = name.toLowerCase()
  const parts: string[] = []
  if (brand && !lowerName.startsWith(brand.toLowerCase())) parts.push(brand)
  if (name) parts.push(name)
  if (variant && !lowerName.includes(variant.toLowerCase())) parts.push(variant)
  return parts.join(' ').trim() || 'Unknown product'
}

export function visionIngredientsText(identification: VisionProductIdentification): string {
  return flattenVisionIngredients(identification.ingredients).join(', ')
}

export function visionContainsAllergenText(identification: VisionProductIdentification): string {
  const allergens = stringArray(identification.allergens)
  return allergens.length ? `Contains: ${allergens.join(', ')}` : ''
}

export function visionMayContainAllergenText(identification: VisionProductIdentification): string {
  const allergens = stringArray(identification.may_contain_allergens)
  return allergens.length ? `May contain: ${allergens.join(', ')}` : ''
}

export function visionMeetsConfidenceThreshold(identification: VisionProductIdentification): boolean {
  return identification.confidence >= VISION_CONFIDENCE_THRESHOLD && Boolean(visionDisplayName(identification).trim())
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
