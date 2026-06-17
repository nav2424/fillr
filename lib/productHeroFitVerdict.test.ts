import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveProductHeroFitVerdict } from './productHeroFitVerdict'

test('resolveProductHeroFitVerdict keeps unsafe verdict ahead of positive nutrition label', () => {
  const verdict = resolveProductHeroFitVerdict({
    hasNutritionData: true,
    nutritionFit: 82,
    nutritionLabel: 'Great',
    fillrVerdict: 'Unsafe',
    fillrTier: 1,
    heroFitScore: 0,
    safetyStatus: 'UNSAFE',
    matchedAllergenCount: 1,
  })

  assert.equal(verdict, 'Unsafe')
})

test('resolveProductHeroFitVerdict can use nutrition label for safe products', () => {
  const verdict = resolveProductHeroFitVerdict({
    hasNutritionData: true,
    nutritionFit: 82,
    nutritionLabel: 'Great',
    fillrVerdict: 'Good fit',
    fillrTier: 2,
    heroFitScore: 75,
    safetyStatus: 'SAFE',
    matchedAllergenCount: 0,
  })

  assert.equal(verdict, 'Great')
})
