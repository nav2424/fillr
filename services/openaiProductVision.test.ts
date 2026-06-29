import assert from 'node:assert/strict'
import test from 'node:test'
import {
  flattenVisionIngredients,
  normalizeVisionProductIdentification,
  visionMeetsConfidenceThreshold,
  visionContainsAllergenText,
  visionIngredientsText,
  visionMayContainAllergenText,
  visionNutritionToProductJson,
  VISION_CONFIDENCE_THRESHOLD,
} from '../lib/visionProductParse'

test('normalizeVisionProductIdentification parses valid payload', () => {
  const out = normalizeVisionProductIdentification({
    product_name: 'Granola Bars',
    brand: 'Nature Valley',
    variant: 'Peanut Butter',
    confidence: 0.82,
    ingredients: ['Oats', 'Peanuts', 'Sugar'],
    nutrition_facts: { calories: 190, protein_g: 4 },
    allergens: ['Peanuts'],
    may_contain_allergens: ['Tree nuts'],
    country_variant: 'US',
  })
  assert.ok(out)
  assert.equal(out!.product_name, 'Granola Bars')
  assert.equal(out!.ingredients.length, 3)
  assert.equal(out!.confidence, 0.82)
  assert.deepEqual(out!.may_contain_allergens, ['Tree nuts'])
})

test('flattenVisionIngredients expands seasoning blend blobs', () => {
  const flat = flattenVisionIngredients([
    'Potatoes',
    'Vegetable oil (canola, sunflower and/or corn oil)',
    'Poutine seasoning blend containing: Salt, Maltodextrin, Cheese powder, Whey powder',
  ])
  assert.ok(flat.length >= 5)
  assert.equal(flat[0], 'Potatoes')
  assert.ok(flat.some((x) => /cheese powder/i.test(x)))
})

test('vision allergen helpers format contains and may contain lines', () => {
  const id = normalizeVisionProductIdentification({
    product_name: 'Chips',
    brand: "Lay's",
    variant: 'Poutine',
    confidence: 0.9,
    ingredients: ['Potatoes', 'Salt'],
    nutrition_facts: {},
    allergens: ['Milk ingredients'],
    may_contain_allergens: ['Soy', 'Wheat'],
    country_variant: 'Canada',
  })!
  assert.match(visionContainsAllergenText(id), /Contains: Milk ingredients/)
  assert.match(visionMayContainAllergenText(id), /May contain: Soy, Wheat/)
  assert.ok(visionIngredientsText(id).includes('Potatoes'))
})

test('normalizeVisionProductIdentification returns null for invalid payload', () => {
  assert.equal(normalizeVisionProductIdentification(null), null)
})

test('vision confidence gate uses the shared threshold', () => {
  const low = normalizeVisionProductIdentification({ confidence: VISION_CONFIDENCE_THRESHOLD - 0.01 })
  const high = normalizeVisionProductIdentification({ confidence: VISION_CONFIDENCE_THRESHOLD })
  assert.equal(visionMeetsConfidenceThreshold(low), false)
  assert.equal(visionMeetsConfidenceThreshold(high), true)
})

test('visionNutritionToProductJson maps per-serving facts for scoring', () => {
  const id = normalizeVisionProductIdentification({
    confidence: 0.9,
    nutrition_facts: {
      serving_size: '40 g',
      calories: 220,
      fat_g: 14,
      carbohydrates_g: 22,
      sugars_g: 1,
      protein_g: 3,
      sodium_mg: 350,
    },
  })!
  assert.deepEqual(visionNutritionToProductJson(id), {
    serving_size: '40 g',
    'energy-kcal_serving': 220,
    fat_serving: 14,
    carbohydrates_serving: 22,
    sugars_serving: 1,
    proteins_serving: 3,
    sodium_serving_mg: 350,
  })
})
