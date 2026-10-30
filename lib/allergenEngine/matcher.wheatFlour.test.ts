import test from 'node:test'
import assert from 'node:assert/strict'
import { buildUserAllergenConfig, detectAllergensEvidenceBased } from './index'

function wheatStatus(ingredients: string): string {
  const out = detectAllergensEvidenceBased(
    { ingredients_text: ingredients, ingredients_text_safety: ingredients },
    buildUserAllergenConfig(['wheat'])
  )
  return out.overall_status
}

test('semolina stays wheat when rice flour is also listed', () => {
  assert.equal(wheatStatus('semolina, rice flour, salt'), 'CONTAINS')
})

test('durum stays wheat when corn flour is also listed', () => {
  assert.equal(wheatStatus('durum, corn flour, water'), 'CONTAINS')
})

test('enriched flour stays wheat when rice flour is also listed', () => {
  assert.equal(wheatStatus('enriched flour, rice flour, sugar, palm oil'), 'CONTAINS')
})

test('all-purpose flour stays wheat beside almond flour', () => {
  assert.equal(wheatStatus('almond flour, all-purpose flour, sugar, butter'), 'CONTAINS')
})

test('bread flour stays wheat beside oat flour', () => {
  assert.equal(wheatStatus('bread flour, oat flour, water, salt'), 'CONTAINS')
})

test('wheat flour names still match with no other flour', () => {
  assert.equal(wheatStatus('semolina, water'), 'CONTAINS')
  assert.equal(wheatStatus('enriched flour, sugar, palm oil'), 'CONTAINS')
})

test('non-wheat flours alone stay safe for a wheat allergy', () => {
  assert.equal(wheatStatus('rice flour, salt'), 'SAFE')
  assert.equal(wheatStatus('almond flour, sugar'), 'SAFE')
  assert.equal(wheatStatus('buckwheat flour, water'), 'SAFE')
  assert.equal(wheatStatus('soy flour, salt'), 'SAFE')
  assert.equal(
    wheatStatus('long grain rice flour enriched with iron, niacin, thiamine and folic acid'),
    'SAFE'
  )
})

test('soy flour still matches soy and not wheat', () => {
  const out = detectAllergensEvidenceBased(
    { ingredients_text: 'soy flour, salt', ingredients_text_safety: 'soy flour, salt' },
    buildUserAllergenConfig(['soy', 'wheat'])
  )
  assert.equal(out.overall_status, 'CONTAINS')
  assert.deepEqual(
    out.matched_allergens.map((m) => m.allergen_id),
    ['soy']
  )
})
