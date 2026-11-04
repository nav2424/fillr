import test from 'node:test'
import assert from 'node:assert/strict'
import { detectAllergensEvidenceBased, buildUserAllergenConfig } from './index'

function milkStatus(ingredients: string): string {
  const out = detectAllergensEvidenceBased(
    { ingredients_text: ingredients, ingredients_text_safety: ingredients },
    buildUserAllergenConfig(['milk'])
  )
  return out.overall_status
}

test('coconut milk powder is not dairy milk', () => {
  assert.equal(milkStatus('coconut milk powder, sugar, salt'), 'SAFE')
  assert.equal(milkStatus('organic coconut milk powder, cane sugar'), 'SAFE')
  assert.equal(milkStatus('coconut-milk powder, tapioca starch'), 'SAFE')
})

test('other plant milk powders and solids are not dairy milk', () => {
  assert.equal(milkStatus('soy milk powder, sunflower oil, salt'), 'SAFE')
  assert.equal(milkStatus('oat milk powder, sugar'), 'SAFE')
  assert.equal(milkStatus('almond milk powder, cocoa, salt'), 'SAFE')
  assert.equal(milkStatus('rice milk powder, cane sugar'), 'SAFE')
  assert.equal(milkStatus('coconut milk solids, sugar'), 'SAFE')
  assert.equal(milkStatus('coconut milk protein, salt'), 'SAFE')
})

test('plant milk named only in parentheses is not dairy milk', () => {
  assert.equal(milkStatus('creamer (coconut milk powder), cane sugar, salt'), 'SAFE')
  assert.equal(milkStatus('powdered creamer (oat milk powder), sugar'), 'SAFE')
})

test('real milk powder still contains milk beside a plant milk powder', () => {
  assert.equal(milkStatus('skim milk powder, sugar, salt'), 'CONTAINS')
  assert.equal(milkStatus('whole milk powder, cocoa, salt'), 'CONTAINS')
  assert.equal(milkStatus('coconut milk powder, skim milk powder, sugar'), 'CONTAINS')
  assert.equal(milkStatus('soy milk powder, whey, cane sugar'), 'CONTAINS')
  assert.equal(milkStatus('buttermilk powder, salt'), 'CONTAINS')
  assert.equal(milkStatus('creamer (coconut milk powder, whey), sugar'), 'CONTAINS')
})

test('plain coconut milk stays safe and whole milk stays unsafe', () => {
  assert.equal(milkStatus('coconut milk, cane sugar, salt'), 'SAFE')
  assert.equal(milkStatus('whole milk, sugar, pectin'), 'CONTAINS')
})

test('almond milk powder still matches a tree-nut allergy', () => {
  const out = detectAllergensEvidenceBased(
    {
      ingredients_text: 'almond milk powder, cocoa, salt',
      ingredients_text_safety: 'almond milk powder, cocoa, salt',
    },
    buildUserAllergenConfig(['tree_nuts'])
  )
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})
