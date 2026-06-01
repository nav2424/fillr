import test from 'node:test'
import assert from 'node:assert/strict'

import type { IngredientExplanation, ScanResult } from '../types'
import { personalizeScanResult, refreshScanProfileSafety } from './personalizationEngine'

function ing(name: string): IngredientExplanation {
  return {
    name,
    whatItIs: '',
    whyItsUsed: '',
    whatToKnow: '',
    ingredientRating: 'clean',
  }
}

function storedSafeScan(ingredientText: string): ScanResult {
  const ingredients = ingredientText.split(',').map((s) => s.trim()).filter(Boolean)
  return {
    product: {
      id: 'prod_cached',
      barcode: '111',
      name: 'Cached product',
      brand: '',
      ingredientText,
      source: 'test',
      createdAt: '',
      updatedAt: '',
    },
    safetyStatus: 'SAFE',
    matchedAllergens: [],
    matchedSensitivities: [],
    smartSummary: '',
    ingredientBreakdown: ingredients.map(ing),
    insights: [],
    scoringFrozenAt: '2026-01-01T00:00:00.000Z',
  }
}

test('refreshScanProfileSafety detects a newly added peanut allergy on cached scans', () => {
  const profile = {
    allergies: ['peanuts'],
    sensitivities: [],
    preferences: [],
    goal: '',
    celiacStrictGluten: false,
  }
  const refreshed = refreshScanProfileSafety(
    storedSafeScan('Sugar, peanut butter, salt'),
    profile
  )
  const personalized = personalizeScanResult(refreshed, profile)

  assert.equal(personalized.safetyStatus, 'UNSAFE')
  assert.equal(personalized.matchedAllergens[0]?.allergenKey, 'peanuts')
})

test('refreshScanProfileSafety runs celiac detection when strict gluten is enabled after scan', () => {
  const profile = {
    allergies: [],
    sensitivities: [],
    preferences: [],
    goal: '',
    celiacStrictGluten: true,
  }
  const refreshed = refreshScanProfileSafety(
    storedSafeScan('Wheat flour, sugar, salt'),
    profile
  )
  const personalized = personalizeScanResult(refreshed, profile)

  assert.equal(personalized.celiac?.celiacSeverity, 'AVOID')
  assert.equal(personalized.safetyStatus, 'UNSAFE')
})
