import assert from 'node:assert/strict'
import test from 'node:test'
import {
  flattenVisionIngredients,
  normalizeVisionProductIdentification,
  visionContainsAllergenText,
  visionIngredientsText,
  visionMeetsConfidenceThreshold,
  visionMayContainAllergenText,
  visionNutritionToProductJson,
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

test('vision confidence gate requires a clear product identification', () => {
  const confident = normalizeVisionProductIdentification({
    product_name: 'Chips',
    brand: "Lay's",
    confidence: 0.72,
  })
  const ambiguous = normalizeVisionProductIdentification({
    product_name: 'Chips',
    brand: "Lay's",
    confidence: 0.42,
  })

  assert.equal(visionMeetsConfidenceThreshold(confident), true)
  assert.equal(visionMeetsConfidenceThreshold(ambiguous), false)
})

test('vision nutrition converts to product nutrition keys used by scoring', () => {
  const id = normalizeVisionProductIdentification({
    product_name: 'Protein Bar',
    brand: 'Example',
    confidence: 0.91,
    nutrition_facts: {
      serving_size: '60 g',
      calories: 210,
      protein_g: 18,
      sodium_mg: 240,
    },
  })!

  assert.deepEqual(visionNutritionToProductJson(id), {
    serving_size: '60 g',
    'energy-kcal_serving': 210,
    proteins_serving: 18,
    sodium_serving_mg: 240,
  })
})
