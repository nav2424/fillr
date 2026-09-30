import assert from 'node:assert/strict'
import test from 'node:test'
import { buildUserAllergenConfig, detectAllergensEvidenceBased } from './index'

function detect(allergies: string[], ingredients: string, productName = 'Test product') {
  return detectAllergensEvidenceBased(
    {
      product_name: productName,
      ingredients_text: ingredients,
      ingredients_text_safety: ingredients,
      contains_text: '',
      may_contain_text: '',
      allergens_tags: [],
      traces_tags: [],
    },
    buildUserAllergenConfig(allergies)
  )
}

test('fat-free milk still matches a milk allergy', () => {
  const out = detect(['milk'], 'Fat-free milk, vitamin A palmitate, vitamin D3')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('free-range eggs beside milk do not wipe the milk match', () => {
  const out = detect(
    ['milk'],
    'Organic whole milk, free-range eggs, cane sugar, vanilla extract'
  )
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('a milk-free claim does not hide skim milk later in the same list', () => {
  const out = detect(['milk'], 'Cane sugar, milk-free chocolate chips, skim milk, cocoa butter')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('lactose-free dairy still matches milk', () => {
  const out = detect(['dairy'], 'Milk, vitamin D3, lactase enzyme. Lactose-free.')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('whey stays unsafe when the only free-claim is lactose-free', () => {
  const out = detect(['milk'], 'Whey protein isolate, cocoa. Lactose free.')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('gluten-free marketing does not wipe wheat flour', () => {
  const out = detect(
    ['wheat'],
    'Wheat flour, sugar, oil. Certified gluten-free facility nearby produces our GF line.'
  )
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'wheat'))
})

test('an explicit no-milk claim with no other dairy stays safe', () => {
  const out = detect(['milk'], 'Sugar, cocoa, no milk, sunflower lecithin')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.length, 0)
})

test('milk-free coating with no other dairy stays safe', () => {
  const out = detect(['milk'], 'Sugar, cocoa, milk-free chocolate coating')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.length, 0)
})

test('free-range eggs still match an egg allergy', () => {
  const out = detect(['eggs'], 'Free-range eggs, sugar, vanilla')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('egg-free coating stays safe for an egg allergy', () => {
  const out = detect(['eggs'], 'Canola oil, egg-free coating, vinegar, salt')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.length, 0)
})
