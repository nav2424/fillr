import test from 'node:test'
import assert from 'node:assert/strict'

import { buildUserAllergenConfig, detectAllergensEvidenceBased } from './allergenEngine'
import { personalizeScanResult } from './personalizationEngine'
import type { ScanResult } from '../types'

function scanCustomAllergen(allergies: string[], ingredients: string): ScanResult {
  const output = detectAllergensEvidenceBased(
    {
      product_name: 'Fruit spread',
      ingredients_text: ingredients,
      ingredients_text_safety: ingredients,
    },
    buildUserAllergenConfig(allergies)
  )
  const base: ScanResult = {
    product: {
      id: 'prod_custom',
      barcode: '111111111111',
      name: 'Fruit spread',
      brand: 'Test',
      ingredientText: ingredients,
      ingredientTextSafetyHaystack: ingredients,
      source: 'test',
      createdAt: '',
      updatedAt: '',
    },
    safetyStatus: output.overall_status === 'CONTAINS' ? 'UNSAFE' : 'SAFE',
    matchedAllergens: output.matched_allergens.map((m) => ({
      allergenKey: m.allergen_id,
      allergenName: m.allergen_name,
      matchedIngredient: m.match_text,
      explanation: 'matched',
    })),
    matchedSensitivities: [],
    smartSummary: '',
    ingredientBreakdown: [],
    insights: [],
  }
  return personalizeScanResult(base, {
    allergies,
    sensitivities: [],
    preferences: [],
    goal: '',
  })
}

test('custom kiwi allergy stays UNSAFE when the label says kiwi', () => {
  const result = scanCustomAllergen(['kiwi'], 'sugar, kiwi puree, citric acid')
  assert.equal(result.safetyStatus, 'UNSAFE')
  assert.equal(result.matchedAllergens.length, 1)
  assert.match(result.matchedAllergens[0].matchedIngredient.toLowerCase(), /kiwi/)
})

test('custom corn allergy stays UNSAFE when the label says corn', () => {
  const result = scanCustomAllergen(['corn'], 'corn, sunflower oil, salt')
  assert.equal(result.safetyStatus, 'UNSAFE')
  assert.equal(result.matchedAllergens.length, 1)
})

test('underscored custom key matches the spaced label phrase', () => {
  const result = scanCustomAllergen(['passion_fruit'], 'sugar, passion fruit puree, water')
  assert.equal(result.safetyStatus, 'UNSAFE')
  assert.match(result.matchedAllergens[0].matchedIngredient.toLowerCase(), /passion fruit/)
})

test('builtin milk allergy is unchanged', () => {
  const result = scanCustomAllergen(['milk'], 'whole milk, sugar, pectin')
  assert.equal(result.safetyStatus, 'UNSAFE')
  assert.equal(result.matchedAllergens[0].allergenKey, 'milk')
})

test('custom allergy does not flag an unrelated ingredient list', () => {
  const result = scanCustomAllergen(['kiwi'], 'sugar, water, citric acid')
  assert.equal(result.safetyStatus, 'SAFE')
  assert.equal(result.matchedAllergens.length, 0)
})

test('milk-only profile does not inherit a kiwi hit', () => {
  const result = scanCustomAllergen(['milk'], 'sugar, kiwi puree, citric acid')
  assert.equal(result.safetyStatus, 'SAFE')
  assert.equal(result.matchedAllergens.length, 0)
})
