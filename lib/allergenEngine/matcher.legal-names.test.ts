/**
 * Whole-word matching misses legal / commercial names that do not contain
 * the dictionary's generic allergen word (`peanut`, `milk` / `cheese`).
 *
 * Run: npx tsx --test lib/allergenEngine/matcher.legal-names.test.ts
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { detectAllergensEvidenceBased, buildUserAllergenConfig } from './index'

function detect(allergies: string[], ingredients_text: string) {
  return detectAllergensEvidenceBased(
    { ingredients_text },
    buildUserAllergenConfig(allergies)
  )
}

test('Contains: Groundnuts is CONTAINS for peanut allergy (UK/EU legal name)', () => {
  const out = detect(['peanuts'], 'sugar, cocoa butter, salt. Contains: Groundnuts')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('groundnuts in the ingredient list is CONTAINS for peanut allergy', () => {
  const out = detect(['peanuts'], 'groundnuts, vegetable oil, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('ground nut oil is CONTAINS for peanut allergy', () => {
  const out = detect(['peanuts'], 'chickpea flour, ground nut oil, chili')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('singular groundnut still matches peanut allergy', () => {
  const out = detect(['peanuts'], 'groundnut oil, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('tree nuts stay SAFE on peanut-only groundnuts (not a tree nut)', () => {
  const out = detect(['tree_nuts'], 'sugar, groundnuts, salt')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'), false)
})

test('bare feta is CONTAINS for milk allergy (no word milk/cheese)', () => {
  const out = detect(['milk'], 'spinach, feta, olive oil, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('feta does not false-positive as peanuts', () => {
  const out = detect(['peanuts'], 'spinach, feta, olive oil, salt')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.length, 0)
})
