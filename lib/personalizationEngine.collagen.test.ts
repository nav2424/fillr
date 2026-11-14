import test from 'node:test'
import assert from 'node:assert/strict'
import type { ScanResult } from '../types'
import { personalizeScanResult } from './personalizationEngine'

function scan(ingredientText: string): ScanResult {
  return {
    product: {
      id: 't',
      barcode: '850232005089',
      name: 'Collagen Peptides',
      brand: 'Vital Proteins',
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

test('vegan, vegetarian, and plant-based scans mark collagen peptides UNSAFE', () => {
  // Vital Proteins Collagen Peptides (850232005089): "Bovine Hide Collagen Peptides".
  // That line contains neither gelatin nor beef, so the old hard verdict stayed SAFE.
  for (const preferences of [['vegan'], ['vegetarian'], ['plant_based']]) {
    for (const ingredientText of [
      'Bovine Hide Collagen Peptides',
      'hydrolyzed collagen',
      'collagen peptides, citric acid',
      'marine collagen, water',
    ]) {
      const result = personalizeScanResult(scan(ingredientText), { ...profile, preferences })
      assert.equal(result.safetyStatus, 'UNSAFE', `${preferences[0]} / ${ingredientText}`)
    }
  }
})

test('collagen wording that is not an animal ingredient stays SAFE', () => {
  for (const ingredientText of [
    'vegan collagen (vitamin C, bamboo silica)',
    'plant-based collagen booster, vitamin C',
    'plant based collagen, silica',
    'vegetarian collagen, pea protein',
    'collagen-free vegetable broth, salt',
    'collagen free vegetable broth, salt',
    'non-collagen pea protein, water',
    'rolled oats, water, salt',
  ]) {
    const result = personalizeScanResult(scan(ingredientText), { ...profile, preferences: ['vegan'] })
    assert.equal(result.safetyStatus, 'SAFE', ingredientText)
  }
})

test('kosher scans stay SAFE for certified bovine collagen peptides', () => {
  const result = personalizeScanResult(scan('Bovine Hide Collagen Peptides'), {
    ...profile,
    preferences: ['kosher'],
  })
  assert.equal(result.safetyStatus, 'SAFE')
})

test('vegetarian collagen conflict does not flag dairy or honey', () => {
  const result = personalizeScanResult(scan('milk, honey'), {
    ...profile,
    preferences: ['vegetarian'],
  })
  assert.equal(result.safetyStatus, 'SAFE')
})
