/**
 * Whole-word matching misses commercial / legal names that do not contain
 * the dictionary's generic allergen word (`hazelnut`, `pine nut`, `fish` / `anchovy`).
 *
 * Run: npx tsx --test lib/allergenEngine/matcher.hidden-label-names.test.ts
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

test('Contains: Filberts is CONTAINS for tree nut allergy (FDA hazelnut name)', () => {
  const out = detect(['tree_nuts'], 'sugar, cocoa butter, salt. Contains: Filberts')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('filberts in the ingredient list is CONTAINS for tree nut allergy', () => {
  const out = detect(['tree_nuts'], 'filberts, sugar, cocoa, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('singular filbert still matches tree nut allergy', () => {
  const out = detect(['tree_nuts'], 'filbert paste, sugar, cocoa')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('UK cobnuts are CONTAINS for tree nut allergy', () => {
  const out = detect(['tree_nuts'], 'sugar, cobnuts, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('pignoli pesto is CONTAINS for tree nut allergy (Italian pine nuts)', () => {
  const out = detect(['tree_nuts'], 'basil, olive oil, pignoli, garlic, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('peanuts stay SAFE on filbert-only hazelnut paste', () => {
  const out = detect(['peanuts'], 'sugar, filberts, cocoa, salt')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'), false)
})

test('worcestershire sauce is CONTAINS for fish allergy (hidden anchovy)', () => {
  const out = detect(['fish'], 'tomato puree, worcestershire sauce, sugar, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('bare Worcestershire in a marinade is CONTAINS for fish allergy', () => {
  const out = detect(['fish'], 'soy sauce, worcestershire, garlic, sugar')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('Worcester sauce is CONTAINS for fish allergy', () => {
  const out = detect(['fish'], 'tomato, worcester sauce, vinegar, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('vegan worcestershire does not flag fish allergy', () => {
  const out = detect(['fish'], 'tomato puree, vegan worcestershire sauce, sugar, salt')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'fish'), false)
})

test('tree nuts stay SAFE on worcestershire-only labels', () => {
  const out = detect(['tree_nuts'], 'tomato puree, worcestershire sauce, sugar, salt')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.length, 0)
})
