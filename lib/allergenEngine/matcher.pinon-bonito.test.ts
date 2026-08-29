/**
 * Whole-word matching misses pine-nut and dried-skipjack names that do not
 * contain `pine nut` / `pistachio` / `fish` / `tuna` / `anchovy`.
 *
 * Run: npx tsx --test lib/allergenEngine/matcher.pinon-bonito.test.ts
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

test('French pignons de pin pesto is CONTAINS for tree nut allergy', () => {
  const out = detect(['tree_nuts'], "huile d'olive, basilic, pignons de pin, sel")
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('plural pignons still matches tree nut allergy', () => {
  const out = detect(['tree_nuts'], 'farine, pignons, sel')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('FDA pinon is CONTAINS for tree nut allergy (pine nut alias)', () => {
  const out = detect(['tree_nuts'], 'flour, sugar, pinon, butter, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('Spanish piñones / piñon normalize to pinon and match tree nuts', () => {
  const out = detect(['tree_nuts'], 'aceite de oliva, piñones, sal')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('pinyon nuts are CONTAINS for tree nut allergy', () => {
  const out = detect(['tree_nuts'], 'cornmeal, pinyon, honey, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('French pistaches plural is CONTAINS for tree nut allergy', () => {
  const out = detect(['tree_nuts'], 'sucre, pistaches, beurre de cacao, sel')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('peanuts stay SAFE on pignons-de-pin pesto', () => {
  const out = detect(['peanuts'], "huile d'olive, basilic, pignons de pin, sel")
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'), false)
})

test('bonito extract is CONTAINS for fish allergy (ramen / dashi)', () => {
  const out = detect(['fish'], 'soy sauce, sugar, bonito extract, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('katsuobushi furikake is CONTAINS for fish allergy', () => {
  const out = detect(['fish'], 'sesame, sugar, katsuobushi, nori, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('hyphenated katsuo-bushi is CONTAINS for fish allergy', () => {
  const out = detect(['fish'], 'soy sauce, katsuo-bushi, sugar')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('skipjack is CONTAINS for fish allergy', () => {
  const out = detect(['fish'], 'water, skipjack, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('vegan bonito does not flag fish allergy', () => {
  const out = detect(['fish'], 'soy sauce, vegan bonito flakes, sugar, salt')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'fish'), false)
})

test('tree nuts stay SAFE on bonito-only labels', () => {
  const out = detect(['tree_nuts'], 'soy sauce, sugar, bonito extract, salt')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.length, 0)
})
