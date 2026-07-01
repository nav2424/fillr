import test from 'node:test'
import assert from 'node:assert/strict'
import { buildNutritionViewModel, nutritionScanTags } from './buildNutritionViewModel'
import type { ScanResult } from '../types'

function baseScan(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    product: {
      id: 'p1',
      name: 'Instant Oatmeal',
      brand: 'Quaker',
      barcode: 'v1',
      ingredientText: 'Whole grain rolled oats, Sugar, Salt, Natural flavor',
      nutritionJson: {
        'energy-kcal_serving': 160,
        proteins_serving: 4,
        carbohydrates_serving: 32,
        sugars_serving: 12,
        fat_serving: 2,
        sodium_serving_mg: 260,
      },
      source: 'openfoodfacts',
      createdAt: '',
      updatedAt: '',
    },
    safetyStatus: 'SAFE',
    matchedAllergens: [],
    matchedSensitivities: [],
    smartSummary: '',
    ingredientBreakdown: [
      {
        name: 'Whole grain rolled oats',
        whatItIs: '',
        whyItsUsed: '',
        whatToKnow: '',
        ingredientRating: 'clean',
      },
      { name: 'Sugar', whatItIs: '', whyItsUsed: '', whatToKnow: '', ingredientRating: 'okay' },
      { name: 'Salt', whatItIs: '', whyItsUsed: '', whatToKnow: '', ingredientRating: 'okay' },
    ],
    insights: [],
    scoringData: {
      productCategory: 'breakfast_grain',
      sugarScore: 8,
    },
    ...overrides,
  }
}

test('buildNutritionViewModel builds macro rows and dual lens scores', () => {
  const model = buildNutritionViewModel({
    scan: baseScan(),
    scoringData: baseScan().scoringData ?? null,
    goalKey: 'less_sugar',
    nutritionTargets: { maxSugarG: 8 },
  })
  assert.equal(model.hasData, true)
  assert.equal(model.macros.some((m) => m.key === 'sugars'), true)
  assert.equal(model.callouts.some((c) => /sugar/i.test(c)), true)
  assert.ok(model.lensScores.ingredientQuality > 0)
  assert.ok(model.lensScores.nutritionFit > 0)
  assert.match(model.categoryContext?.line ?? '', /instant oatmeal/i)
})

test('nutritionScanTags for history filters', () => {
  const tags = nutritionScanTags(baseScan())
  assert.equal(tags.highSugar, true)
  assert.equal(tags.highSodium, false)
})
