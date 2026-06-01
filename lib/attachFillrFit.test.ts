import test from 'node:test'
import assert from 'node:assert/strict'

import type { DietaryProfile, IngredientExplanation, ScanResult } from '../types'
import { attachFillrFitToScanResult, getFillrScoringProfileHash } from './attachFillrFit'

function ing(name: string): IngredientExplanation {
  return {
    name,
    whatItIs: '',
    whyItsUsed: '',
    whatToKnow: '',
    ingredientRating: 'clean',
  }
}

function scan(): ScanResult {
  return {
    product: {
      id: 'prod_test',
      barcode: '123',
      name: 'Simple snack',
      brand: '',
      ingredientText: 'Oats, honey, salt',
      source: 'test',
      createdAt: '',
      updatedAt: '',
    },
    safetyStatus: 'SAFE',
    matchedAllergens: [],
    matchedSensitivities: [],
    smartSummary: '',
    ingredientBreakdown: [ing('Oats'), ing('Honey'), ing('Salt')],
    insights: [],
  }
}

const emptyProfile: DietaryProfile = {
  allergies: [],
  sensitivities: [],
  avoiding: [],
  preferences: [],
  goal: '',
  celiacStrictGluten: false,
}

test('attachFillrFitToScanResult computes live scoring without throwing', () => {
  const scored = attachFillrFitToScanResult(scan(), emptyProfile)

  assert.ok(scored.fillrFit)
  assert.ok(scored.scoringData)
  assert.ok(scored.processedRating)
  assert.equal(scored.scoringProfileHash, getFillrScoringProfileHash(emptyProfile))
})
