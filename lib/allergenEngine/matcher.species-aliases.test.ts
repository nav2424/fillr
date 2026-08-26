/**
 * Whole-word matching misses commercial species / regional names that do not
 * contain the dictionary's generic allergen word (`fish`, `sesame`).
 *
 * Run: npx tsx --test lib/allergenEngine/matcher.species-aliases.test.ts
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

test('sea bass is CONTAINS for fish allergy (no whole word "fish")', () => {
  const out = detect(['fish'], 'water, sea bass, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('catfish is CONTAINS for fish allergy (compound hides \\bfish\\b)', () => {
  const out = detect(['fish'], 'catfish, vegetable oil, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('swordfish is CONTAINS for fish allergy', () => {
  const out = detect(['fish'], 'swordfish, olive oil, lemon')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('whitefish is CONTAINS for fish allergy', () => {
  const out = detect(['fish'], 'smoked whitefish, mayonnaise, dill')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('til (sesame seed) is CONTAINS for sesame allergy', () => {
  const out = detect(['sesame'], 'sugar, til, ghee')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'sesame'))
})

test('til oil is CONTAINS for sesame allergy', () => {
  const out = detect(['sesame'], 'chickpea flour, til oil, chili')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'sesame'))
})

test('lentils do not false-positive as sesame via til', () => {
  const out = detect(['sesame'], 'red lentils, water, salt')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.length, 0)
})

test('shellfish does not false-positive as fish via compound *fish names', () => {
  const out = detect(['fish'], 'shrimp, crab, salt')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.length, 0)
})
