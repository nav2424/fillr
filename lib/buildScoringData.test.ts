import test from 'node:test'
import assert from 'node:assert/strict'
import type { DietaryProfile, IngredientExplanation, ScanResult } from '../types'
import { buildScoringData, effectiveTierForScoringCounts } from './buildScoringData'
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
