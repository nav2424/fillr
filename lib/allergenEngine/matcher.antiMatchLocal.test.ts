import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildUserAllergenConfig, detectAllergensEvidenceBased } from './index'

function detect(allergies: string[], ingredientsText: string) {
  return detectAllergensEvidenceBased(
    {
      product_name: 'Test Product',
      ingredients_text: ingredientsText,
      contains_text: '',
      may_contain_text: '',
    },
    buildUserAllergenConfig(allergies)
  )
}

test('egg + eggplant still CONTAINS egg (anti-match is term-local)', () => {
  const out = detect(['egg'], 'egg, eggplant, salt, spices')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('eggplant alone does not match egg', () => {
  const out = detect(['egg'], 'eggplant, salt, spices')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.length, 0)
})

test('dairy milk + soy milk still CONTAINS milk', () => {
  const out = detect(['milk'], 'organic milk, soy milk, cane sugar')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('soy milk alone does not match milk', () => {
  const out = detect(['milk'], 'soy milk, cane sugar, salt')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.length, 0)
})

test('butter + peanut butter still CONTAINS milk', () => {
  const out = detect(['milk'], 'butter, peanut butter, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('peanut butter alone does not match milk', () => {
  const out = detect(['milk'], 'peanut butter, salt')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.length, 0)
})

test('cream + coconut cream still CONTAINS milk', () => {
  const out = detect(['milk'], 'cream, coconut cream, sugar')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('semolina + rice flour still CONTAINS wheat', () => {
  const out = detect(['wheat'], 'semolina, rice flour, water')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'wheat'))
})

test('enriched flour + almond flour still CONTAINS wheat', () => {
  const out = detect(['wheat'], 'enriched flour, almond flour, sugar')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'wheat'))
})

test('rice flour alone does not match wheat via flour heuristics', () => {
  const out = detect(['wheat'], 'rice flour, water, salt')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.length, 0)
})
