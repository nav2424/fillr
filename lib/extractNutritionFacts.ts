import type { ScanResult } from '../types'

export type NutritionFacts = {
  servingSize?: string
  calories?: number
  proteinG?: number
  fatG?: number
  carbsG?: number
  sugarsG?: number
  sodiumMg?: number
  fibreG?: number
}

function nutritionNum(v: unknown): number {
  const x = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN
  return Number.isFinite(x) && x > 0 ? x : 0
}

function parseServingGrams(servingSize: unknown): number {
  if (typeof servingSize !== 'string') return 0
  const text = servingSize.trim().toLowerCase()
  const match = text.match(/([\d.]+)\s*(g|gram|grams|ml|milliliter|milliliters)\b/)
  if (!match) return 0
  return nutritionNum(match[1])
}

function scaledPerServing(perServing: number, per100g: number, servingGrams: number): number {
  if (perServing > 0) return perServing
  if (per100g > 0 && servingGrams > 0) return (per100g * servingGrams) / 100
  return per100g
}

function sodiumMg(o: Record<string, unknown>, servingGrams: number): number {
  const explicitMg = nutritionNum(o['sodium_serving_mg'])
  if (explicitMg > 0) return explicitMg

  const sodiumServingG = nutritionNum(o['sodium_serving'])
  if (sodiumServingG > 0) return sodiumServingG * 1000

  const saltServingG = nutritionNum(o['salt_serving'])
  if (saltServingG > 0) return saltServingG * 393

  const sodium100g = nutritionNum(o['sodium_100g'])
  if (sodium100g > 0) {
    const grams = servingGrams > 0 ? (sodium100g * servingGrams) / 100 : sodium100g
    return grams * 1000
  }

  const salt100g = nutritionNum(o['salt_100g'])
  if (salt100g > 0) {
    const grams = servingGrams > 0 ? (salt100g * servingGrams) / 100 : salt100g
    return grams * 393
  }

  return 0
}

/** Unified per-serving nutrition from OFF nutriments or vision embed. */
export function extractNutritionFacts(scan: ScanResult): NutritionFacts {
  const n = scan.product.nutritionJson
  if (!n || typeof n !== 'object') return {}

  const o = n as Record<string, unknown>
  const out: NutritionFacts = {}
  const serving = typeof o.serving_size === 'string' ? o.serving_size.trim() : ''
  const servingGrams = parseServingGrams(serving)
  if (serving) out.servingSize = serving

  let calories = scaledPerServing(
    nutritionNum(o['energy-kcal_serving']),
    nutritionNum(o['energy-kcal_100g']),
    servingGrams
  )
  let sodium = sodiumMg(o, servingGrams)
  let fat = scaledPerServing(nutritionNum(o['fat_serving']), nutritionNum(o['fat_100g']), servingGrams)
  let protein = scaledPerServing(
    nutritionNum(o['proteins_serving']) || nutritionNum(o['protein_serving']),
    nutritionNum(o['proteins_100g']) || nutritionNum(o['protein_100g']),
    servingGrams
  )
  let carbs = scaledPerServing(
    nutritionNum(o['carbohydrates_serving']),
    nutritionNum(o['carbohydrates_100g']),
    servingGrams
  )
  let sugars = scaledPerServing(nutritionNum(o['sugars_serving']), nutritionNum(o['sugars_100g']), servingGrams)
  let fibre = scaledPerServing(nutritionNum(o['fiber_serving']), nutritionNum(o['fiber_100g']), servingGrams)

  const vision = o.fillr_vision
  if (vision && typeof vision === 'object') {
    const facts = (vision as { nutrition_facts?: Record<string, unknown> }).nutrition_facts
    if (facts && typeof facts === 'object') {
      const serving = typeof facts.serving_size === 'string' ? facts.serving_size.trim() : ''
      if (serving) out.servingSize = serving
      if (!calories) calories = nutritionNum(facts.calories)
      if (!sodium) sodium = nutritionNum(facts.sodium_mg)
      if (!fat) fat = nutritionNum(facts.fat_g)
      if (!protein) protein = nutritionNum(facts.protein_g)
      if (!carbs) carbs = nutritionNum(facts.carbohydrates_g)
      if (!sugars) sugars = nutritionNum(facts.sugars_g)
      if (!fibre) fibre = nutritionNum(facts.fibre_g)
    }
  }

  if (calories > 0) out.calories = Math.round(calories)
  if (sodium > 0) out.sodiumMg = Math.round(sodium)
  if (fat > 0) out.fatG = Math.round(fat * 10) / 10
  if (protein > 0) out.proteinG = Math.round(protein * 10) / 10
  if (carbs > 0) out.carbsG = Math.round(carbs * 10) / 10
  if (sugars > 0) out.sugarsG = Math.round(sugars * 10) / 10
  if (fibre > 0) out.fibreG = Math.round(fibre * 10) / 10

  return out
}

export function nutritionFactsHasData(facts: NutritionFacts): boolean {
  return Boolean(
    facts.calories ||
      facts.proteinG ||
      facts.fatG ||
      facts.carbsG ||
      facts.sugarsG ||
      facts.sodiumMg
  )
}
