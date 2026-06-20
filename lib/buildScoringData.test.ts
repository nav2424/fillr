import test from 'node:test'
import assert from 'node:assert/strict'
import type { DietaryProfile, IngredientExplanation, ScanResult } from '../types'
import { buildScoringData, detectProductCategoryFromSignals, effectiveTierForScoringCounts } from './buildScoringData'
import { calculateFillrFit } from './fillrScoring'
import { calculateProcessedRating } from './processedRating'

const emptyProfile: DietaryProfile = {
  allergies: [],
  sensitivities: [],
  avoiding: [],
  preferences: [],
  goal: '',
  celiacStrictGluten: false,
}

const minimalScan: ScanResult = {
  product: {
    id: 't',
    barcode: 'x',
    name: 'Test',
    brand: '',
    ingredientText: '',
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

function ing(name: string, rating: IngredientExplanation['ingredientRating']): IngredientExplanation {
  return {
    name,
    whatItIs: '',
    whyItsUsed: '',
    whatToKnow: '',
    ingredientRating: rating,
  }
}

test('effectiveTier bumps misrated clean MSG / maltodextrin to concerning', () => {
  assert.equal(effectiveTierForScoringCounts(ing('Monosodium glutamate', 'clean')), 'concerning')
  assert.equal(effectiveTierForScoringCounts(ing('Corn modextrin', 'clean')), 'concerning')
  assert.equal(effectiveTierForScoringCounts(ing('Salt', 'clean')), 'clean')
})

test('effectiveTier bumps misrated clean modified potato starch to okay', () => {
  assert.equal(effectiveTierForScoringCounts(ing('Modified potato starch', 'clean')), 'okay')
})

test('processed rating drops when many clean lines are industrial by name', () => {
  const list: IngredientExplanation[] = [
    ing('Corn', 'clean'),
    ing('Maltodextrin', 'clean'),
    ing('Monosodium glutamate', 'clean'),
    ing('Disodium inosinate', 'clean'),
    ing('Disodium guanylate', 'clean'),
    ing('Artificial color', 'clean'),
    ing('Dextrose', 'clean'),
    ing('Cheddar cheese', 'clean'),
    ing('Salt', 'clean'),
    ing('Whey', 'clean'),
  ]
  const naiveHigh = calculateProcessedRating({
    ingredientCounts: { natural: 10, processed: 0, additive: 0, flagged: 0 },
    totalIngredients: 10,
  })
  const data = buildScoringData(minimalScan, list, emptyProfile)
  const fixed = calculateProcessedRating(data)
  assert.ok(naiveHigh && naiveHigh.score >= 85)
  assert.ok(fixed && fixed.score < naiveHigh!.score)
  assert.ok(fixed && fixed.score < 75, `expected materially lower processing score, got ${fixed?.score}`)
})

test('ingredient-level sensitivity flags are always included in sensitivity matches', () => {
  const scan: ScanResult = {
    ...minimalScan,
    matchedSensitivities: [],
  }
  const list: IngredientExplanation[] = [
    {
      ...ing('Dark chocolate', 'concerning'),
      personalFlag: 'sensitivity',
      flagDriver: 'sensitivity',
    },
    ing('Cocoa butter', 'clean'),
  ]
  const data = buildScoringData(scan, list, emptyProfile)
  assert.ok(
    (data.sensitivityMatches ?? []).some((m) => /dark chocolate/i.test(m)),
    `expected ingredient-flagged sensitivity in matches, got: ${JSON.stringify(data.sensitivityMatches ?? [])}`
  )
})

test('caramel color ingredient does not classify product as candy', () => {
  const category = detectProductCategoryFromSignals(
    'Quaker Instant Oatmeal Maple and Brown Sugar Family Size',
    ['whole grain oats', 'sugar', 'natural flavor', 'caramel color', 'salt']
  )
  assert.equal(category, 'breakfast_grain')
})

test('instant oatmeal scores in healthy breakfast range not candy range', () => {
  const scan: ScanResult = {
    ...minimalScan,
    product: {
      ...minimalScan.product,
      name: 'Instant Oatmeal Maple & Brown Sugar — Family Size',
      brand: 'Quaker',
      ingredientText:
        'Whole grain oats, sugar, salt, natural flavor, caramel color, maple and brown sugar flavor',
      nutritionJson: {
        'energy-kcal_serving': 160,
        proteins_serving: 4,
        sugars_serving: 12,
        fiber_serving: 3,
      },
    },
  }
  const list: IngredientExplanation[] = [
    ing('Whole grain oats', 'clean'),
    ing('Sugar', 'okay'),
    ing('Salt', 'clean'),
    ing('Natural flavor', 'okay'),
    ing('Caramel color', 'concerning'),
    ing('Maple and brown sugar flavor', 'okay'),
  ]
  const data = buildScoringData(scan, list, emptyProfile)
  const fit = calculateFillrFit(data)
  assert.equal(data.productCategory, 'breakfast_grain')
  assert.ok(fit.score >= 65 && fit.score <= 88, `expected breakfast score ~70-80, got ${fit.score}`)
})

test('buildScoringData converts Open Food Facts sodium grams to milligrams', () => {
  const scan: ScanResult = {
    ...minimalScan,
    product: {
      ...minimalScan.product,
      nutritionJson: {
        sodium_serving: 0.62,
      },
    },
  }
  const data = buildScoringData(scan, [ing('Salt', 'okay')], emptyProfile)
  assert.equal(data.sodiumMgPerServing, 620)
})

test('poutine chips are salty snack not whole food even with three collapsed lines', () => {
  const category = detectProductCategoryFromSignals(
    "President's Choice World of Flavours Poutine Chips potatoes vegetable oil seasoning blend",
    ['potatoes', 'vegetable oil', 'poutine seasoning blend']
  )
  assert.equal(category, 'salty_snack')
})

test('poutine chips score in occasional-snack range not whole-food range', () => {
  const scan: ScanResult = {
    ...minimalScan,
    product: {
      ...minimalScan.product,
      name: "President's Choice World of Flavours Poutine Chips",
      ingredientText:
        'Potatoes, Vegetable oil (canola, sunflower and/or corn oil), Salt, Maltodextrin, Cheese powder, Buttermilk powder, Whey powder, Onion powder, Garlic powder, Yeast extract, Natural flavours, Spice extracts, Lactic acid, Citric acid',
      nutritionJson: {
        fillr_vision: {
          nutrition_facts: {
            serving_size: '20 chips (about 40 g)',
            calories: 220,
            fat_g: 14,
            saturated_fat_g: 1.5,
            carbohydrates_g: 22,
            fibre_g: 2,
            sugars_g: 1,
            protein_g: 3,
            sodium_mg: 350,
          },
        },
      },
    },
  }
  const list: IngredientExplanation[] = [
    ing('Potatoes', 'clean'),
    ing('Vegetable oil (canola, sunflower and/or corn oil)', 'okay'),
    ing('Salt', 'okay'),
    ing('Maltodextrin', 'clean'),
    ing('Cheese powder', 'okay'),
    ing('Buttermilk powder', 'okay'),
    ing('Whey powder', 'okay'),
    ing('Onion powder', 'clean'),
    ing('Garlic powder', 'clean'),
    ing('Yeast extract', 'clean'),
    ing('Natural flavours', 'okay'),
    ing('Spice extracts', 'okay'),
    ing('Lactic acid', 'okay'),
    ing('Citric acid', 'okay'),
  ]
  const data = buildScoringData(scan, list, emptyProfile)
  const fit = calculateFillrFit(data)
  assert.equal(data.productCategory, 'salty_snack')
  assert.ok(fit.score >= 28 && fit.score <= 48, `expected occasional-snack score, got ${fit.score}`)
})
