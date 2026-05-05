import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateProcessedRating } from './processedRating'

test('returns null when no ingredients', () => {
  assert.equal(
    calculateProcessedRating({
      ingredientCounts: { natural: 0, processed: 0, additive: 0, flagged: 0 },
      totalIngredients: 0,
    }),
    null
  )
})

test('all clean ingredients scores high', () => {
  const r = calculateProcessedRating({
    ingredientCounts: { natural: 12, processed: 0, additive: 0, flagged: 0 },
    totalIngredients: 12,
  })
  assert.ok(r && r.score >= 88)
  assert.match(r!.verdict, /Minimal|Lightly/i)
})

test('all flagged lines scores low', () => {
  const r = calculateProcessedRating({
    ingredientCounts: { natural: 0, processed: 0, additive: 0, flagged: 10 },
    totalIngredients: 10,
  })
  assert.ok(r && r.score <= 35)
  assert.match(r!.verdict, /Heavy|Ultra/i)
})

test('independent of allergyMatches (not in input — always formulation-only)', () => {
  const r = calculateProcessedRating({
    ingredientCounts: { natural: 8, processed: 2, additive: 0, flagged: 0 },
    totalIngredients: 10,
    eNumberCount: 0,
  })
  assert.ok(r && r.score >= 60)
})

test('E-number bump lowers score vs same tier mix without E codes', () => {
  const base = calculateProcessedRating({
    ingredientCounts: { natural: 6, processed: 4, additive: 0, flagged: 0 },
    totalIngredients: 10,
    eNumberCount: 0,
  })
  const withE = calculateProcessedRating({
    ingredientCounts: { natural: 6, processed: 4, additive: 0, flagged: 0 },
    totalIngredients: 10,
    eNumberCount: 6,
  })
  assert.ok(base && withE)
  assert.ok(withE!.score < base!.score)
})

test('chelator on label lowers processed score and switches to label-aware copy', () => {
  const without = calculateProcessedRating({
    ingredientCounts: { natural: 7, processed: 2, additive: 2, flagged: 0 },
    totalIngredients: 11,
    labelHaystack: 'water vinegar salt sugar canola oil',
  })
  const withChel = calculateProcessedRating({
    ingredientCounts: { natural: 7, processed: 2, additive: 2, flagged: 0 },
    totalIngredients: 11,
    labelHaystack:
      'water calcium disodium edta canola oil modified corn starch modified potato starch sorbic acid vinegar salt',
  })
  assert.ok(without && withChel)
  assert.ok(withChel!.score < without!.score)
  assert.match(withChel!.reason, /EDTA/i)
})

test('cleaner xylitol gum is processed but not treated like worst-case ultra processed food', () => {
  const r = calculateProcessedRating({
    productCategory: 'gum',
    labelHaystack: 'PUR Gum xylitol gum base gum arabic natural flavors carnauba wax',
    sweetenerCount: 0,
    industrialSweetenerCount: 0,
    hydrogenatedOilCount: 0,
    ingredientCounts: { natural: 0, processed: 2, additive: 5, flagged: 0 },
    totalIngredients: 7,
  })
  assert.ok(r)
  assert.ok(r!.score >= 50 && r!.score <= 65, `expected cleaner gum processing range, got ${r!.score}`)
  assert.match(r!.reason, /chewing gum/i)
})
