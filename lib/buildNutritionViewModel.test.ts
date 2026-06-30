import test from 'node:test'
import assert from 'node:assert/strict'
import { buildNutritionViewModel, nutritionScanTags } from './buildNutritionViewModel'
import { extractNutritionFacts } from './extractNutritionFacts'
import type { IngredientRating, ScanResult } from '../types'

function ingredient(name: string, ingredientRating: IngredientRating) {
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
      source: 'test',
      createdAt: '',
      updatedAt: '',
    },
    safetyStatus: 'SAFE',
    matchedAllergens: [],
    matchedSensitivities: [],
    smartSummary: '',
    ingredientBreakdown: [
      ingredient('Whole grain rolled oats', 'clean'),
      ingredient('Sugar', 'okay'),
      ingredient('Salt', 'okay'),
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
  const facts = extractNutritionFacts(
    baseScan({
      product: {
        ...baseScan().product,
        nutritionJson: {
          sodium_serving: 0.62,
          sodium_100g: 1.2,
        },
      },
    })
  )

  assert.equal(facts.sodiumMg, 620)
})

test('extractNutritionFacts converts Open Food Facts per-100g sodium grams when serving is missing', () => {
  const facts = extractNutritionFacts(
    baseScan({
      product: {
        ...baseScan().product,
        nutritionJson: {
          sodium_100g: 0.8,
        },
      },
    })
  )

  assert.equal(facts.sodiumMg, 800)
})
