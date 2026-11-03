import test from 'node:test'
import assert from 'node:assert/strict'
import { buildUserAllergenConfig, detectAllergensEvidenceBased } from './index'

function statusFor(allergy: string, ingredients: string): string {
  const out = detectAllergensEvidenceBased(
    {
      product_name: 'Test product',
      ingredients_text: ingredients,
      ingredients_text_safety: ingredients,
    },
    buildUserAllergenConfig([allergy])
  )
  return out.overall_status
}

test('plural (s) crumbs are not allergen evidence', () => {
  const labels = [
    'sugar, natural flavor(s), salt',
    'sugar, emulsifier(s), citric acid',
    'sugar, color (s), salt',
    'sugar, spice(s), salt, garlic',
    'sugar, preservative(s), water',
  ]
  for (const allergy of ['milk', 'eggs', 'wheat', 'peanuts', 'fish', 'shellfish', 'sesame']) {
    for (const label of labels) {
      assert.equal(statusFor(allergy, label), 'SAFE', `${allergy} :: ${label}`)
    }
  }
})

test('bicarbonate (sodium) is not milk or sulfites', () => {
  const label = 'wheat flour, bicarbonate (sodium), sugar, salt'
  assert.equal(statusFor('milk', label), 'SAFE')
  assert.equal(statusFor('sulfites', label), 'SAFE')
  assert.equal(statusFor('wheat', label), 'CONTAINS')
})

test('citrate (sodium) and carbonate (sodium) are not milk', () => {
  assert.equal(statusFor('milk', 'sugar, citrate (sodium), citric acid'), 'SAFE')
  assert.equal(statusFor('milk', 'sugar, carbonate (sodium), cocoa'), 'SAFE')
  assert.equal(statusFor('sulfites', 'sugar, citrate (sodium), citric acid'), 'SAFE')
})

test('lecithin (soy) is soy, not wheat', () => {
  const label = 'sugar, cocoa butter, lecithin (soy), vanilla'
  assert.equal(statusFor('soy', label), 'CONTAINS')
  assert.equal(statusFor('wheat', label), 'SAFE')
  assert.equal(statusFor('milk', label), 'SAFE')
})

test('real parenthetical allergens still match', () => {
  assert.equal(statusFor('milk', 'chocolate (milk), sugar'), 'CONTAINS')
  assert.equal(statusFor('milk', 'protein (sodium caseinate), cocoa, sugar'), 'CONTAINS')
  assert.equal(statusFor('milk', 'protein (caseinate), cocoa, sugar'), 'CONTAINS')
  assert.equal(statusFor('soy', 'emulsifier (soy lecithin), sugar'), 'CONTAINS')
  assert.equal(statusFor('wheat', 'starch (wheat), sugar'), 'CONTAINS')
  assert.equal(statusFor('wheat', 'tamari (soy sauce), rice, salt'), 'CONTAINS')
  assert.equal(statusFor('milk', 'whole milk, natural flavor(s)'), 'CONTAINS')
  assert.equal(statusFor('tree_nuts', 'roasted almonds, sugar'), 'CONTAINS')
  assert.equal(statusFor('sulfites', 'dried apricots, sodium metabisulfite, rice flour'), 'CONTAINS')
})

test('coconut milk stays safe for a milk allergy', () => {
  assert.equal(statusFor('milk', 'coconut milk, sugar, salt'), 'SAFE')
})
