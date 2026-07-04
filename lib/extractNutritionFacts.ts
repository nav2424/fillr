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

function sodiumMgFromSaltG(saltG: number): number {
  return saltG > 0 ? saltG * 393.4 : 0
}

/** Unified per-serving nutrition from OFF nutriments or vision embed. */
export function extractNutritionFacts(scan: ScanResult): NutritionFacts {
  const n = scan.product.nutritionJson
  if (!n || typeof n !== 'object') return {}

  const o = n as Record<string, unknown>
  const out: NutritionFacts = {}

  const servingSize = typeof o.serving_size === 'string' ? o.serving_size.trim() : ''
  if (servingSize) out.servingSize = servingSize

  const caloriesServing = nutritionNum(o['energy-kcal_serving'])
  const fatServing = nutritionNum(o['fat_serving'])
  const proteinServing = nutritionNum(o['proteins_serving'])
  const carbsServing = nutritionNum(o['carbohydrates_serving'])
  const sugarsServing = nutritionNum(o['sugars_serving'])
  const fibreServing = nutritionNum(o['fiber_serving'])
  const hasServingNutrition = Boolean(
    caloriesServing ||
      fatServing ||
      proteinServing ||
      carbsServing ||
      sugarsServing ||
      fibreServing ||
      nutritionNum(o['sodium_serving_mg']) ||
      nutritionNum(o['sodium_serving']) ||
      nutritionNum(o['salt_serving'])
  )

  let usedPer100gFallback = false
  let calories = caloriesServing
  let fat = fatServing
  let protein = proteinServing
  let carbs = carbsServing
  let sugars = sugarsServing
  let fibre = fibreServing
  if (!calories) {
    calories = nutritionNum(o['energy-kcal_100g'])
    if (calories) usedPer100gFallback = true
  }
  if (!fat) {
    fat = nutritionNum(o['fat_100g'])
    if (fat) usedPer100gFallback = true
  }
  if (!protein) {
    protein = nutritionNum(o['proteins_100g'])
    if (protein) usedPer100gFallback = true
  }
  if (!carbs) {
    carbs = nutritionNum(o['carbohydrates_100g'])
    if (carbs) usedPer100gFallback = true
  }
  if (!sugars) {
    sugars = nutritionNum(o['sugars_100g'])
    if (sugars) usedPer100gFallback = true
  }
  if (!fibre) {
    fibre = nutritionNum(o['fiber_100g'])
    if (fibre) usedPer100gFallback = true
  }

  let sodium =
    nutritionNum(o['sodium_serving_mg']) ||
    nutritionNum(o['sodium_serving']) * 1000 ||
    sodiumMgFromSaltG(nutritionNum(o['salt_serving']))
  if (!sodium) {
    sodium =
      nutritionNum(o['sodium_100g']) * 1000 ||
      sodiumMgFromSaltG(nutritionNum(o['salt_100g']))
    if (sodium) usedPer100gFallback = true
  }

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

  if (!out.servingSize && usedPer100gFallback && !hasServingNutrition) out.servingSize = '100 g'
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
