import test from 'node:test'
import assert from 'node:assert/strict'

import type { ScanResult } from '../types'
import { personalizeScanResult } from './personalizationEngine'

const baseScan: ScanResult = {
  product: {
    id: 'prod_test',
    barcode: '123',
    name: 'Test crackers',
    brand: 'Fillr Test',
    ingredientText: 'wheat flour, milk powder, salt',
    source: 'test',
    createdAt: '',
    updatedAt: '',
  },
  safetyStatus: 'UNSAFE',
  matchedAllergens: [
    {
      allergenKey: 'milk',
      allergenName: 'Milk',
      matchedIngredient: 'milk powder',
      explanation: 'Contains milk.',
      severity: 'CONTAINS',
    },
    {
      allergenKey: 'wheat',
      allergenName: 'Wheat',
      matchedIngredient: 'wheat flour',
      explanation: 'Contains wheat.',
      severity: 'CONTAINS',
    },
  ],
  matchedSensitivities: [],
  smartSummary: '',
  ingredientBreakdown: [],
  insights: [],
}

test('personalization keeps allergen matches when profile uses saved preset slugs', () => {
  const dairy = personalizeScanResult(baseScan, {
    allergies: ['dairy'],
    sensitivities: [],
    preferences: [],
    goal: '',
  })

  assert.equal(dairy.safetyStatus, 'UNSAFE')
  assert.deepEqual(dairy.matchedAllergens.map((a) => a.allergenKey), ['milk'])

  const gluten = personalizeScanResult(baseScan, {
    allergies: ['gluten'],
    sensitivities: [],
    preferences: [],
    goal: '',
  })

  assert.equal(gluten.safetyStatus, 'UNSAFE')
  assert.deepEqual(gluten.matchedAllergens.map((a) => a.allergenKey), ['wheat'])
}
