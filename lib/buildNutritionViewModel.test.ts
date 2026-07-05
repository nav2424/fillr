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
        whatItIs: 'Whole grain oats',
        whyItsUsed: 'Base grain',
        whatToKnow: 'A minimally processed grain',
        ingredientRating: 'clean',
      },
      {
        name: 'Sugar',
        whatItIs: 'Sweetener',
        whyItsUsed: 'Adds sweetness',
        whatToKnow: 'Contributes added sugar',
        ingredientRating: 'okay',
      },
      {
        name: 'Salt',
        whatItIs: 'Sodium chloride',
        whyItsUsed: 'Adds flavor',
        whatToKnow: 'Contributes sodium',
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

test('extractNutritionFacts converts OFF sodium grams to milligrams', () => {
  const facts = extractNutritionFacts(
    baseScan({
      product: {
        ...baseScan().product,
        nutritionJson: {
          serving_size: '40 g',
          sodium_serving: 0.35,
          sugars_serving: 8,
        },
      },
    })
  )

  assert.equal(facts.sodiumMg, 350)
  assert.equal(facts.sugarsG, 8)
})

test('extractNutritionFacts scales OFF 100g values when serving size is available', () => {
  const facts = extractNutritionFacts(
    baseScan({
      product: {
        ...baseScan().product,
        nutritionJson: {
          serving_size: '50 g',
          'energy-kcal_100g': 400,
          sodium_100g: 0.7,
          sugars_100g: 28,
          proteins_100g: 10,
        },
      },
    })
  )

  assert.equal(facts.calories, 200)
  assert.equal(facts.sodiumMg, 350)
  assert.equal(facts.sugarsG, 14)
  assert.equal(facts.proteinG, 5)
})
