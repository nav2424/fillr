import test from 'node:test'
import assert from 'node:assert/strict'
import { buildUserAllergenConfig, detectAllergensEvidenceBased } from './index'

function detect(allergies: string[], ingredients: string) {
  return detectAllergensEvidenceBased(
    { ingredients_text: ingredients, ingredients_text_safety: ingredients },
    buildUserAllergenConfig(allergies)
  )
}

test('queso fresco is CONTAINS for milk allergy when milk and cheese are absent', () => {
  const out = detect(['milk'], 'wheat tortilla, queso fresco, pinto beans, rice, spices')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('paneer is CONTAINS for milk allergy', () => {
  const out = detect(['milk'], 'spinach, paneer, onion, spices')
  assert.equal(out.overall_status, 'CONTAINS')
})

test('halloumi is CONTAINS for milk allergy', () => {
  const out = detect(['milk'], 'halloumi, olive oil, mint')
  assert.equal(out.overall_status, 'CONTAINS')
})

test('burrata, gouda, brie, provolone, and cotija are CONTAINS for milk allergy', () => {
  for (const ingredients of [
    'burrata, tomato, basil',
    'aged gouda, crackers',
    'brie, pear',
    'provolone, salami',
    'corn, cotija, chili powder',
  ]) {
    const out = detect(['milk'], ingredients)
    assert.equal(out.overall_status, 'CONTAINS', ingredients)
  }
})

test('plant milk and peanut butter stay SAFE for a milk allergy', () => {
  assert.equal(detect(['milk'], 'oat milk, cocoa, sugar').overall_status, 'SAFE')
  assert.equal(detect(['milk'], 'peanut butter, cocoa, sugar').overall_status, 'SAFE')
})

test('queso fresco does not match a peanut allergy', () => {
  assert.equal(
    detect(['peanuts'], 'wheat tortilla, queso fresco, pinto beans').overall_status,
    'SAFE'
  )
})
