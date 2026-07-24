import test from 'node:test'
import assert from 'node:assert/strict'
import { extractNutritionFacts } from './extractNutritionFacts'
import type { ScanResult } from '../types'

function scanWithNutrition(nutritionJson: Record<string, unknown>): ScanResult {
  return {
    product: {
      id: 'p1',
      barcode: '000',
      name: 'Test Chips',
      brand: 'Test',
      ingredientText: 'Potatoes, oil, salt',
      nutritionJson,
      source: 'openfoodfacts',
      createdAt: '',
      updatedAt: '',
    },
    safetyStatus: 'SAFE',
    matchedAllergens: [],
    matchedSensitivities: [],
    smartSummary: '',
    ingredientBreakdown: [],
    insights: [],
  }
}

test('extractNutritionFacts converts OFF sodium_serving grams to milligrams', () => {
  const facts = extractNutritionFacts(
    scanWithNutrition({
      sodium_serving: 0.45,
    })
  )
  assert.equal(facts.sodiumMg, 450)
})

test('extractNutritionFacts converts OFF sodium_100g grams to milligrams', () => {
  const facts = extractNutritionFacts(
    scanWithNutrition({
      sodium_100g: 0.8,
    })
  )
  assert.equal(facts.sodiumMg, 800)
})

test('extractNutritionFacts prefers explicit milligram fields when present', () => {
  const facts = extractNutritionFacts(
    scanWithNutrition({
      sodium_serving_mg: 260,
      sodium_serving: 0.45,
      sodium_100g: 0.8,
    })
  )
  assert.equal(facts.sodiumMg, 260)
})
