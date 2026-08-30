/**
 * `eggnog` was listed as an egg anti-match (false friend), so section-wide
 * anti-matching skipped the synonym `egg` whenever eggnog appeared — including
 * labels that list egg itself. Word boundaries already prevent `egg` matching
 * inside `eggnog`; eggnog is a real egg product and must be a synonym.
 *
 * Run: npx tsx --test lib/allergenEngine/matcher.eggnog.test.ts
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { detectAllergensEvidenceBased, buildUserAllergenConfig } from './index'

function detect(allergies: string[], ingredients_text: string, contains_text?: string) {
  return detectAllergensEvidenceBased(
    { ingredients_text, contains_text },
    buildUserAllergenConfig(allergies)
  )
}

test('eggnog as a compound ingredient is CONTAINS for egg allergy', () => {
  const out = detect(['egg'], 'wheat flour, sugar, butter, eggnog, nutmeg, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('explicit egg is not wiped when eggnog also appears in the section', () => {
  const out = detect(['egg'], 'egg, sugar, vanilla, eggnog flavor')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('Contains: Eggnog is CONTAINS for egg allergy', () => {
  const out = detect(['egg'], 'sugar, milk, cream, nutmeg', 'Eggnog')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('Canadian French lait de poule is CONTAINS for egg allergy', () => {
  const out = detect(['egg'], 'lait, crème, sucre, lait de poule, muscade')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('eggplant alone still does not match egg', () => {
  const out = detect(['egg'], 'eggplant, salt, spices')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.length, 0)
})

test('milk-only labels stay SAFE for egg allergy', () => {
  const out = detect(['egg'], 'milk, cream, sugar, nutmeg, salt')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.length, 0)
})
