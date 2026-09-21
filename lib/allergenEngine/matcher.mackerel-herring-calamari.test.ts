/**
 * Whole-word matching misses canned/frozen seafood names that do not
 * contain `fish`, `tuna`, `salmon`, `squid`, `shrimp`, or `crab`.
 *
 * Run: npx tsx --test lib/allergenEngine/matcher.mackerel-herring-calamari.test.ts
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

test('canned mackerel is CONTAINS for fish allergy', () => {
  const out = detect(['fish'], 'mackerel, olive oil, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('plural mackerels still matches fish allergy', () => {
  const out = detect(['fish'], 'water, mackerels, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('pickled herring is CONTAINS for fish allergy', () => {
  const out = detect(['fish'], 'herring, vinegar, onion, salt, sugar')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('plural herrings still matches fish allergy', () => {
  const out = detect(['fish'], 'herrings, water, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('French maquereau is CONTAINS for fish allergy', () => {
  const out = detect(['fish'], 'maquereau, huile d olive, sel')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('French hareng is CONTAINS for fish allergy', () => {
  const out = detect(['fish'], 'hareng, vinaigre, oignon, sel')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('eel teriyaki is CONTAINS for fish allergy', () => {
  const out = detect(['fish'], 'eel, soy sauce, sugar, mirin')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('mahi mahi is CONTAINS for fish allergy', () => {
  const out = detect(['fish'], 'mahi-mahi, lemon, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('breaded calamari is CONTAINS for shellfish allergy', () => {
  const out = detect(['shellfish'], 'calamari, wheat flour, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'shellfish'))
})

test('French calmar is CONTAINS for shellfish allergy', () => {
  const out = detect(['shellfish'], 'calmar, farine de blé, sel')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'shellfish'))
})

test('krill oil is CONTAINS for shellfish allergy', () => {
  const out = detect(['shellfish'], 'krill oil, gelatin, glycerin')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'shellfish'))
})

test('langostino tails are CONTAINS for shellfish allergy', () => {
  const out = detect(['shellfish'], 'langostino, water, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'shellfish'))
})

test('mackerel does not flag shellfish allergy', () => {
  const out = detect(['shellfish'], 'mackerel, olive oil, salt')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'shellfish'), false)
})

test('calamari does not flag fish allergy', () => {
  const out = detect(['fish'], 'calamari, wheat flour, salt')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'fish'), false)
})

test('vegan mackerel does not flag fish allergy', () => {
  const out = detect(['fish'], 'water, vegan mackerel, salt')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'fish'), false)
})

test('vegan calamari does not flag shellfish allergy', () => {
  const out = detect(['shellfish'], 'konjac, vegan calamari, salt')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'shellfish'), false)
})

test('existing tuna still matches fish allergy', () => {
  const out = detect(['fish'], 'tuna, water, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})
