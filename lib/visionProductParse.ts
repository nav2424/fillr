import type { VisionNutritionFacts, VisionProductIdentification } from '../types'

export const VISION_CONFIDENCE_THRESHOLD = 0.5

function text(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN
  return Number.isFinite(n) && n > 0 ? n : 0
}

function cleanList(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of v) {
    const s = text(item)
    if (!s) continue
    const key = s.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
  }
  return out
}

function splitTopLevel(input: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (ch === '(') depth++
    if (ch === ')') depth = Math.max(0, depth - 1)
    if (depth === 0 && (ch === ',' || ch === ';')) {
      parts.push(input.slice(start, i).trim())
      start = i + 1
    }
  }
  parts.push(input.slice(start).trim())
  return parts.filter(Boolean)
}

function normalizeNutritionFacts(v: unknown): VisionNutritionFacts {
  if (!v || typeof v !== 'object') return {}
  const o = v as Record<string, unknown>
  const facts: VisionNutritionFacts = {}
  const servingSize = text(o.serving_size)
  if (servingSize) facts.serving_size = servingSize
  const calories = num(o.calories)
  if (calories) facts.calories = Math.round(calories)
  const fat = num(o.fat_g)
  if (fat) facts.fat_g = fat
  const saturatedFat = num(o.saturated_fat_g)
  if (saturatedFat) facts.saturated_fat_g = saturatedFat
  const transFat = num(o.trans_fat_g)
  if (transFat) facts.trans_fat_g = transFat
  const carbs = num(o.carbohydrates_g)
  if (carbs) facts.carbohydrates_g = carbs
  const fibre = num(o.fibre_g ?? o.fiber_g)
  if (fibre) facts.fibre_g = fibre
  const sugars = num(o.sugars_g)
  if (sugars) facts.sugars_g = sugars
  const protein = num(o.protein_g)
  if (protein) facts.protein_g = protein
  const sodium = num(o.sodium_mg)
  if (sodium) facts.sodium_mg = Math.round(sodium)
  return facts
}

export function normalizeVisionProductIdentification(v: unknown): VisionProductIdentification | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const productName = text(o.product_name)
  const brand = text(o.brand)
  const confidenceRaw = typeof o.confidence === 'number' ? o.confidence : parseFloat(text(o.confidence))
  const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0

  if (!productName && !brand) return null

  return {
    product_name: productName,
    brand,
    variant: text(o.variant),
    confidence,
    ingredients: flattenVisionIngredients(cleanList(o.ingredients)),
    nutrition_facts: normalizeNutritionFacts(o.nutrition_facts),
    allergens: cleanList(o.allergens),
    may_contain_allergens: cleanList(o.may_contain_allergens),
    country_variant: text(o.country_variant),
  }
}

export function flattenVisionIngredients(ingredients: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()

  const add = (value: string) => {
    const item = value.replace(/\s+/g, ' ').trim()
    if (!item) return
    const key = item.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(item)
  }

  for (const raw of ingredients) {
    const item = text(raw)
    if (!item) continue

    const containing = item.match(/^(.*?)(?:\bcontains?|\bcontaining)\s*:\s*(.+)$/i)
    if (containing) {
      const prefix = containing[1].trim().replace(/[,;:]$/, '')
      if (prefix && !/\b(blend|seasoning|mix|ingredients?)$/i.test(prefix)) {
        add(prefix)
      }
      for (const part of splitTopLevel(containing[2])) add(part)
      continue
    }

    for (const part of splitTopLevel(item)) add(part)
  }

  return out
}

export function visionIngredientsText(identification: VisionProductIdentification): string {
  return flattenVisionIngredients(identification.ingredients).join(', ')
}

export function visionDisplayName(identification: VisionProductIdentification): string {
  return [identification.brand, identification.product_name, identification.variant]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim() || 'Identified product'
}

export function visionContainsAllergenText(identification: VisionProductIdentification): string {
  const allergens = cleanList(identification.allergens)
  return allergens.length ? `Contains: ${allergens.join(', ')}` : ''
}

export function visionMayContainAllergenText(identification: VisionProductIdentification): string {
  const allergens = cleanList(identification.may_contain_allergens)
  return allergens.length ? `May contain: ${allergens.join(', ')}` : ''
}

export function visionMeetsConfidenceThreshold(identification: VisionProductIdentification): boolean {
  return identification.confidence >= VISION_CONFIDENCE_THRESHOLD
}

export function visionNutritionToProductJson(
  identification: VisionProductIdentification
): Record<string, unknown> {
  const facts = identification.nutrition_facts ?? {}
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
