import test from 'node:test'
import assert from 'node:assert/strict'
import type { ScanResult } from '../types'
import { personalizeScanResult } from './personalizationEngine'

function scanWithIngredients(ingredientText: string): ScanResult {
  return {
    product: {
      id: 'p1',
      barcode: '123',
      name: 'Peanut Butter',
      brand: 'Test',
      ingredientText,
      source: 'off',
      createdAt: '',
      updatedAt: '',
    },
    safetyStatus: 'SAFE',
    matchedAllergens: [],
    matchedSensitivities: [],
    smartSummary: '',
    ingredientBreakdown: [],
    insights: [],
    fillrFit: {
      score: 82,
      verdict: 'Great fit',
      verdictColor: '#16a34a',
      progressColor: '#22c55e',
      reason: 'Old profile score',
      tier: 3,
    },
    scoringFrozenAt: '2026-01-01T00:00:00.000Z',
  }
}

test('personalizeScanResult reruns allergen detection for saved scans after profile changes', () => {
  const personalized = personalizeScanResult(scanWithIngredients('Roasted peanuts, salt'), {
    allergies: ['peanuts'],
    sensitivities: [],
    preferences: [],
    goal: '',
  })

  assert.equal(personalized.safetyStatus, 'UNSAFE')
  assert.equal(personalized.matchedAllergens.length, 1)
  assert.equal(personalized.matchedAllergens[0].allergenKey, 'peanuts')
  assert.equal(personalized.fillrFit, undefined)
  assert.equal(personalized.scoringFrozenAt, undefined)
})

test('personalizeScanResult reruns celiac detection for saved scans after celiac mode is enabled', () => {
  const personalized = personalizeScanResult(scanWithIngredients('Wheat flour, water, salt'), {
    allergies: [],
    sensitivities: [],
    preferences: [],
    goal: '',
    celiacStrictGluten: true,
  })

  assert.equal(personalized.safetyStatus, 'UNSAFE')
  assert.equal(personalized.celiac?.celiacModeEnabled, true)
  assert.equal(personalized.celiac?.celiacSeverity, 'AVOID')
})
