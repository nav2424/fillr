import test from 'node:test'
import assert from 'node:assert/strict'
import { personalizeScanResult } from './personalizationEngine'
import { buildProfileMatches } from './buildProfileMatches'
import type { ScanResult } from '../types'

function scan(ingredientText: string): ScanResult {
  return {
    product: {
      id: 'p1',
      barcode: '000000000000',
      name: 'Canned fish',
      brand: 'Test',
      ingredientText,
      source: 'test',
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

function status(preferences: string[], ingredientText: string) {
  return personalizeScanResult(scan(ingredientText), {
    allergies: [],
    sensitivities: [],
    preferences,
    goal: '',
  }).safetyStatus
}

const FINFISH_LABELS = [
  'tuna, water, salt',
  'light tuna, water, vegetable broth, salt',
  'smoked salmon, salt',
  'cod, water, salt',
  'sardines, olive oil, salt',
  'trout, salt',
  'tilapia, water',
  'pollock, salt',
  'mackerel, oil',
  'herring, salt',
  'haddock, water',
  'halibut, salt',
  'bonito, salt',
  'albacore, water, salt',
]

test('vegan, vegetarian, and plant-based scans are UNSAFE for finfish labeled by species', () => {
  for (const label of FINFISH_LABELS) {
    assert.equal(status(['vegan'], label), 'UNSAFE', label)
    assert.equal(status(['vegetarian'], label), 'UNSAFE', label)
    assert.equal(status(['plant_based'], label), 'UNSAFE', label)
    const fit = buildProfileMatches(
      { allergies: [], sensitivities: [], avoiding: [], preferences: ['vegan'], goal: '' },
      label.split(',').map((part) => part.trim())
    )
    assert.ok(fit.goalConflicts.includes('Vegan'), label)
  }
})

test('kosher and halal scans stay SAFE for finfish', () => {
  assert.equal(status(['kosher'], 'tuna, water, salt'), 'SAFE')
  assert.equal(status(['halal'], 'salmon, salt'), 'SAFE')
  assert.equal(status(['kosher'], 'albacore, water, salt'), 'SAFE')
})

test('vegan scans stay SAFE for plants that only share letters with fish names', () => {
  assert.equal(status(['vegan'], 'gooseberry, sugar, water'), 'SAFE')
  assert.equal(status(['vegan'], 'rice, salt'), 'SAFE')
})

test('vegan scans still flag fish named as fish, and dairy beside tuna', () => {
  assert.equal(status(['vegan'], 'fish, water, salt'), 'UNSAFE')
  assert.equal(status(['vegan'], 'swordfish, salt'), 'UNSAFE')
  assert.equal(status(['vegan'], 'tuna, whole milk, salt'), 'UNSAFE')
})
