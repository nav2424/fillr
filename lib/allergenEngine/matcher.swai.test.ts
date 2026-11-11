import test from 'node:test'
import assert from 'node:assert/strict'
import { buildUserAllergenConfig, detectAllergensEvidenceBased } from './index'

function detect(allergies: string[], ingredients: string) {
  return detectAllergensEvidenceBased(
    {
      product_name: 'Frozen fillets',
      ingredients_text: ingredients,
      ingredients_text_safety: ingredients,
      allergens_tags: [],
      traces_tags: [],
    },
    buildUserAllergenConfig(allergies)
  )
}

test('Great Value swai fillets are CONTAINS for fish allergy', () => {
  const out = detect(
    ['fish'],
    'Swai (pangasianodon hypophthalmus), sodium tripolyphosphate (added to retain moisture).'
  )
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('basa and pangasius are CONTAINS for fish allergy', () => {
  for (const ingredients of ['basa, water, salt', 'pangasius, salt']) {
    const out = detect(['fish'], ingredients)
    assert.equal(out.overall_status, 'CONTAINS', ingredients)
  }
})

test('swai does not flag shellfish allergy', () => {
  const out = detect(
    ['shellfish'],
    'Swai (pangasianodon hypophthalmus), sodium tripolyphosphate (added to retain moisture).'
  )
  assert.equal(out.overall_status, 'SAFE')
})

test('rice and salt stay SAFE for fish allergy', () => {
  const out = detect(['fish'], 'rice, salt')
  assert.equal(out.overall_status, 'SAFE')
})
