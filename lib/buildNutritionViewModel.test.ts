import test from 'node:test'
import assert from 'node:assert/strict'
import { buildNutritionViewModel, nutritionScanTags } from './buildNutritionViewModel'
import { extractNutritionFacts } from './extractNutritionFacts'
import type { ScanResult } from '../types'

function baseScan(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    product: {
      id: 'p1',
      name: 'Instant Oatmeal',
      brand: 'Quaker',
      barcode: 'v1',
      ingredientText: 'Whole grain rolled oats, Sugar, Salt, Natural flavor',
      source: 'test',
      nutritionJson: {
        'energy-kcal_serving': 160,
        proteins_serving: 4,
        carbohydrates_serving: 32,
        sugars_serving: 12,
        fat_serving: 2,
        sodium_serving_mg: 260,
      },
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
        whatItIs: 'Oats',
        whyItsUsed: 'Base ingredient',
        whatToKnow: 'Whole grain',
        ingredientRating: 'clean',
      },
      {
        name: 'Sugar',
        whatItIs: 'Sweetener',
        whyItsUsed: 'Adds sweetness',
        whatToKnow: 'Limit added sugar',
        ingredientRating: 'okay',
      },
      {
        name: 'Salt',
        whatItIs: 'Seasoning',
        whyItsUsed: 'Adds flavor',
        whatToKnow: 'Adds sodium',
        ingredientRating: 'okay',
      },
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

test('extractNutritionFacts converts Open Food Facts sodium grams to milligrams', () => {
  const servingScan = baseScan()
  servingScan.product.nutritionJson = { sodium_serving: 0.62 }
  assert.equal(extractNutritionFacts(servingScan).sodiumMg, 620)

  const per100gScan = baseScan()
  per100gScan.product.nutritionJson = { sodium_100g: 0.35 }
  assert.equal(extractNutritionFacts(per100gScan).sodiumMg, 350)

  const saltScan = baseScan()
  saltScan.product.nutritionJson = { salt_serving: 1 }
  assert.equal(extractNutritionFacts(saltScan).sodiumMg, 393)
})
