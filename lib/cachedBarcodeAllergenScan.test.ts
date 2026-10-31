import test from 'node:test'
import assert from 'node:assert/strict'
import { buildUserAllergenConfig } from './allergenEngine'
import { detectAllergensForCachedBarcodeScan } from './cachedBarcodeAllergenScan'

const LEARNED_GRANOLA =
  'Ingredients: rolled oats, honey, roasted almonds, salt. Contains: almonds.'
const SPARSE_OFF = 'oats, honey, salt'

test('learned label allergen is not hidden by a shorter OFF ingredient field', () => {
  const out = detectAllergensForCachedBarcodeScan(
    {
      productName: 'Honey Granola',
      cachedIngredientText: LEARNED_GRANOLA,
      offSafetyText: SPARSE_OFF,
      allergensTags: [],
      tracesTags: [],
    },
    buildUserAllergenConfig(['tree_nuts'])
  )
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
  assert.match(out.scan_log.ingredients_text_used, /almonds/i)
})

test('allergen that exists only on the OFF ingredient text is still detected', () => {
  const out = detectAllergensForCachedBarcodeScan(
    {
      productName: 'Vegetable Soup',
      cachedIngredientText: 'Ingredients: water, carrots, celery, salt, oil, spices.',
      offSafetyText: 'water, carrots, celery, milk, salt',
      allergensTags: [],
    },
    buildUserAllergenConfig(['milk'])
  )
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
  assert.match(out.scan_log.ingredients_text_used, /carrots/i)
  assert.doesNotMatch(out.scan_log.ingredients_text_used, /\bmilk\b/i)
})

test('OFF allergen tag still flags when neither ingredient text names it', () => {
  const out = detectAllergensForCachedBarcodeScan(
    {
      productName: 'Cereal Bar',
      cachedIngredientText: 'Ingredients: oats, honey, salt, oil, spices.',
      offSafetyText: SPARSE_OFF,
      allergensTags: ['en:milk'],
    },
    buildUserAllergenConfig(['milk'])
  )
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('peanut butter on the OFF field does not flag a milk allergy', () => {
  const out = detectAllergensForCachedBarcodeScan(
    {
      productName: 'Oat Bites',
      cachedIngredientText: 'Ingredients: oats, honey, salt, oil, spices.',
      offSafetyText: 'peanut butter, salt',
    },
    buildUserAllergenConfig(['milk'])
  )
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.length, 0)
})
