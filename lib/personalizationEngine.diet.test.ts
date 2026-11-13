import test from 'node:test'
import assert from 'node:assert/strict'
import type { ScanResult } from '../types'
import { personalizeScanResult } from './personalizationEngine'

function scan(ingredientText: string): ScanResult {
  return {
    product: {
      id: 't',
      barcode: 'x',
      name: 'Test',
      brand: '',
      ingredientText,
      source: 'off',
      createdAt: '',
      updatedAt: '',
    },
    safetyStatus: 'UNKNOWN',
    matchedAllergens: [],
    matchedSensitivities: [],
    smartSummary: '',
    ingredientBreakdown: [],
    insights: [],
  }
}

const profile = {
  allergies: [] as string[],
  sensitivities: [] as string[],
  preferences: [] as string[],
  goal: '',
}

test('vegan and plant-based scans mark turkey meat UNSAFE', () => {
  for (const preferences of [['vegan'], ['plant_based']]) {
    for (const ingredientText of [
      'turkey, water, salt',
      'smoked turkey breast',
      'ground turkey, salt',
      'turkey tail mushroom, smoked turkey',
      'marinated in turkey broth',
    ]) {
      const result = personalizeScanResult(scan(ingredientText), { ...profile, preferences })
      assert.equal(result.safetyStatus, 'UNSAFE', `${preferences[0]} / ${ingredientText}`)
    }
  }
})

test('vegan stays SAFE for turkey tail mushroom and Turkish delight', () => {
  for (const ingredientText of [
    'turkey tail mushroom, vegetable cellulose',
    'Turkish delight, sugar, cornstarch',
    'rolled oats, water, salt',
    'olives, water, salt. Product of Turkey',
    'olives, water, salt. Made in Turkey',
    'olives, water, salt. Imported from Turkey',
  ]) {
    const result = personalizeScanResult(scan(ingredientText), { ...profile, preferences: ['vegan'] })
    assert.equal(result.safetyStatus, 'SAFE', ingredientText)
  }
})

test('vegetarian turkey conflict still marks the scan UNSAFE', () => {
  const result = personalizeScanResult(scan('turkey, water, salt'), {
    ...profile,
    preferences: ['vegetarian'],
  })
  assert.equal(result.safetyStatus, 'UNSAFE')
})
