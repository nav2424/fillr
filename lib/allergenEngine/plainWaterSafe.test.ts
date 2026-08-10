import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildUserAllergenConfig,
  detectAllergensEvidenceBased,
  isLikelyBottledWaterName,
  isPlainWaterProduct,
} from './index'

test('isPlainWaterProduct matches water-named foods that are not bottled water', () => {
  assert.equal(isPlainWaterProduct('Water Chestnuts'), true)
  assert.equal(isPlainWaterProduct('Barley Water'), true)
  assert.equal(isPlainWaterProduct('Almond Water'), true)
  assert.equal(isPlainWaterProduct('Evian Natural Spring Water'), true)
  assert.equal(isPlainWaterProduct('Vitamin Water XXX'), false)
  assert.equal(isPlainWaterProduct('Coconut Water'), false)
})

test('isLikelyBottledWaterName rejects water-named foods', () => {
  assert.equal(isLikelyBottledWaterName('Water Chestnuts'), false)
  assert.equal(isLikelyBottledWaterName('Barley Water'), false)
  assert.equal(isLikelyBottledWaterName('Almond Water'), false)
  assert.equal(isLikelyBottledWaterName('Tonic Water'), false)
  assert.equal(isLikelyBottledWaterName('Rose Water'), false)
  assert.equal(isLikelyBottledWaterName('Evian Natural Spring Water'), true)
  assert.equal(isLikelyBottledWaterName('Dasani'), true)
  assert.equal(isLikelyBottledWaterName('Water'), true)
  assert.equal(isLikelyBottledWaterName('Water 500ml'), true)
})

test('water-named products with real ingredients still match allergens (no false SAFE)', () => {
  const user = buildUserAllergenConfig(['milk', 'wheat'])
  const waterChestnuts = detectAllergensEvidenceBased(
    {
      product_name: 'Water Chestnuts',
      ingredients_text: 'Water chestnuts, water, citric acid, sodium metabisulfite',
      ingredients_text_safety: 'Water chestnuts, water, citric acid, sodium metabisulfite',
      contains_text: '',
      may_contain_text: '',
      allergens_tags: ['en:sulphur-dioxide-and-sulphites'],
      traces_tags: [],
    },
    buildUserAllergenConfig(['sulfites'])
  )
  assert.notEqual(waterChestnuts.overall_status, 'SAFE')
  assert.ok(waterChestnuts.matched_allergens.some((m) => m.allergen_id === 'sulfites'))

  const barleyWater = detectAllergensEvidenceBased(
    {
      product_name: 'Barley Water',
      ingredients_text: 'Water, barley, sugar, citric acid',
      ingredients_text_safety: 'Water, barley, sugar, citric acid',
      contains_text: 'Contains: Wheat',
      may_contain_text: '',
      allergens_tags: [],
      traces_tags: [],
    },
    user
  )
  assert.notEqual(barleyWater.overall_status, 'SAFE')
  assert.ok(barleyWater.matched_allergens.some((m) => m.allergen_id === 'wheat'))

  const almondWater = detectAllergensEvidenceBased(
    {
      product_name: 'Almond Water',
      ingredients_text: 'Water, almonds, cane sugar',
      ingredients_text_safety: 'Water, almonds, cane sugar',
      contains_text: '',
      may_contain_text: '',
      allergens_tags: ['en:nuts'],
      traces_tags: [],
    },
    buildUserAllergenConfig(['tree_nuts'])
  )
  assert.notEqual(almondWater.overall_status, 'SAFE')
  assert.ok(almondWater.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('true bottled water with no formula still short-circuits to SAFE', () => {
  const user = buildUserAllergenConfig(['milk', 'peanuts'])
  const empty = detectAllergensEvidenceBased(
    {
      product_name: 'Evian Natural Spring Water',
      ingredients_text: '',
      contains_text: '',
      may_contain_text: '',
      allergens_tags: [],
      traces_tags: [],
    },
    user
  )
  assert.equal(empty.overall_status, 'SAFE')
  assert.equal(empty.matched_allergens.length, 0)

  const waterOnly = detectAllergensEvidenceBased(
    {
      product_name: 'Dasani',
      ingredients_text: 'Water',
      contains_text: '',
      may_contain_text: '',
      allergens_tags: [],
      traces_tags: [],
    },
    user
  )
  assert.equal(waterOnly.overall_status, 'SAFE')
  assert.equal(waterOnly.matched_allergens.length, 0)
})

test('water-named foods with empty OFF ingredients are UNKNOWN, not SAFE', () => {
  const user = buildUserAllergenConfig(['sulfites', 'wheat', 'tree_nuts'])
  for (const name of ['Water Chestnuts', 'Barley Water', 'Almond Water', 'Tonic Water']) {
    const result = detectAllergensEvidenceBased(
      {
        product_name: name,
        ingredients_text: '',
        contains_text: '',
        may_contain_text: '',
        allergens_tags: [],
        traces_tags: [],
      },
      user
    )
    assert.equal(result.overall_status, 'UNKNOWN', `${name} should be UNKNOWN with empty label`)
    assert.equal(result.matched_allergens.length, 0)
  }
})

test('ingredients-only-water does not ignore Contains / allergen tags', () => {
  const user = buildUserAllergenConfig(['milk'])
  const withContains = detectAllergensEvidenceBased(
    {
      product_name: 'Mystery Drink',
      ingredients_text: 'Water',
      contains_text: 'Contains: Milk',
      may_contain_text: '',
      allergens_tags: [],
      traces_tags: [],
    },
    user
  )
  assert.notEqual(withContains.overall_status, 'SAFE')
  assert.ok(withContains.matched_allergens.some((m) => m.allergen_id === 'milk'))
})
