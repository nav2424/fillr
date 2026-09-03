/**
 * Whole-word matching misses German tree-nut legal names and compounds that do
 * not contain English/French dictionary words (hazelnut, almond, noisette).
 *
 * OCR never translates German labels (only French-only lists). PR #67 covered
 * German milk/egg/wheat/soy/peanut/fish/sesame/shellfish; tree-nut names
 * (Haselnuss, Mandel, Walnuss, Schalenfrüchte) were left out.
 *
 * Run: npx tsx --test lib/allergenEngine/matcher.german-tree-nuts.test.ts
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

test('Haselnüsse is CONTAINS for tree-nut allergy (German hazelnut plural)', () => {
  const out = detect(['tree_nuts'], 'Zucker, Palmöl, Haselnüsse 13%, Kakao')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('Haselnusskerne is CONTAINS for tree-nut allergy (compound hides haselnuss)', () => {
  const out = detect(['tree_nuts'], 'Kakao, Haselnusskerne, Zucker')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('Mandeln is CONTAINS for tree-nut allergy (German almond plural)', () => {
  const out = detect(['tree_nuts'], 'Weizenmehl, Zucker, Mandeln, Salz')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('Mandelmehl is CONTAINS for tree-nut allergy (almond flour compound)', () => {
  const out = detect(['tree_nuts'], 'Mandelmehl, Wasser, Salz')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('Walnüsse is CONTAINS for tree-nut allergy', () => {
  const out = detect(['tree_nuts'], 'Öl, Walnüsse, Salz')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('Cashewkerne is CONTAINS for tree-nut allergy (compound hides cashew)', () => {
  const out = detect(['tree_nuts'], 'Cashewkerne, Salz')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('Pistazien is CONTAINS for tree-nut allergy', () => {
  const out = detect(['tree_nuts'], 'Zucker, Pistazien, Salz')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('Enthält: Schalenfrüchte is CONTAINS for tree-nut allergy (EU legal umbrella)', () => {
  const out = detect(['tree_nuts'], 'Zucker, Kakao. Enthält: Schalenfrüchte')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('Contains: Nüsse is CONTAINS for tree-nut allergy', () => {
  const out = detect(['tree_nuts'], 'Zucker, Kakao. Contains: Nüsse')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('peanut-only Erdnuss stays SAFE for tree-nut allergy', () => {
  const out = detect(['tree_nuts'], 'Mais, Pflanzenöl, Salz, Erdnuss')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'), false)
})

test('Kokosnuss stays SAFE for tree-nut allergy (coconut is not a tree nut)', () => {
  const out = detect(['tree_nuts'], 'Wasser, Zucker, Kokosnuss')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'), false)
})

test('Muskatnuss stays SAFE for tree-nut allergy (nutmeg is not a tree nut)', () => {
  const out = detect(['tree_nuts'], 'Pfeffer, Muskatnuss, Salz')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'), false)
})

test('English hazelnuts still match and milk-only Haselnüsse stays SAFE', () => {
  const nuts = detect(['tree_nuts'], 'sugar, hazelnuts, cocoa')
  assert.equal(nuts.overall_status, 'CONTAINS')
  const milkOnHazelnut = detect(['milk'], 'Zucker, Haselnüsse, Kakao')
  assert.equal(milkOnHazelnut.overall_status, 'SAFE')
  assert.equal(milkOnHazelnut.matched_allergens.length, 0)
})
