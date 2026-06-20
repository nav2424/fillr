import test from 'node:test'
import assert from 'node:assert/strict'
import { buildNutritionViewModel, nutritionScanTags } from './buildNutritionViewModel'
import type { IngredientExplanation } from '../types'
import type { ScanResult } from '../types'

function ing(name: string, ingredientRating: IngredientExplanation['ingredientRating']): IngredientExplanation {
  return {
    name,
    whatItIs: '',
    whyItsUsed: '',
    whatToKnow: '',
    ingredientRating,
  }
}

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
      ing('Whole grain rolled oats', 'clean'),
      ing('Sugar', 'okay'),
      ing('Salt', 'okay'),
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

test('Open Food Facts sodium gram fields are converted to milligrams', () => {
  const scan = baseScan({
    product: {
      ...baseScan().product,
      nutritionJson: {
        'energy-kcal_serving': 220,
        sodium_serving: 0.48,
      },
    },
  })
  const model = buildNutritionViewModel({
    scan,
    scoringData: scan.scoringData ?? null,
    goalKey: 'lower_sodium',
    nutritionTargets: { maxSodiumMg: 400 },
  })
  const sodium = model.macros.find((m) => m.key === 'sodium')
  assert.equal(sodium?.value, 480)
  assert.equal(sodium?.display, '480mg')
  assert.equal(nutritionScanTags(scan).highSodium, true)
})

test('Open Food Facts 100g sodium fallback is labeled and converted', () => {
  const scan = baseScan({
    product: {
      ...baseScan().product,
      nutritionJson: {
        'energy-kcal_100g': 500,
        sodium_100g: 0.72,
      },
    },
  })
  const model = buildNutritionViewModel({
    scan,
    scoringData: scan.scoringData ?? null,
  })
  const sodium = model.macros.find((m) => m.key === 'sodium')
  assert.equal(model.servingLabel, 'Per 100 g')
  assert.equal(sodium?.value, 720)
  assert.equal(sodium?.display, '720mg')
})
