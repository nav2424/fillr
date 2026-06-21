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

/** Unified per-serving nutrition from OFF nutriments or vision embed. */
export function extractNutritionFacts(scan: ScanResult): NutritionFacts {
  const n = scan.product.nutritionJson
  if (!n || typeof n !== 'object') return {}

  const o = n as Record<string, unknown>
  const out: NutritionFacts = {}

  let calories = nutritionNum(o['energy-kcal_serving']) || nutritionNum(o['energy-kcal_100g'])
  let sodium =
    nutritionNum(o['sodium_serving_mg']) ||
    nutritionNum(o['sodium_serving']) * 1000 ||
    nutritionNum(o['sodium_100g']) * 1000
  let fat = nutritionNum(o['fat_serving']) || nutritionNum(o['fat_100g'])
  let protein = nutritionNum(o['proteins_serving']) || nutritionNum(o['proteins_100g'])
  let carbs = nutritionNum(o['carbohydrates_serving']) || nutritionNum(o['carbohydrates_100g'])
  let sugars = nutritionNum(o['sugars_serving']) || nutritionNum(o['sugars_100g'])
  let fibre = nutritionNum(o['fiber_serving']) || nutritionNum(o['fiber_100g'])

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
