import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateFillrFit } from './fillrScoring'

test('allergy match always returns 0', () => {
  const result = calculateFillrFit({
    allergyMatches: ['peanuts'],
    ingredientCounts: {
      natural: 10,
      processed: 2,
      additive: 0,
      flagged: 0,
    },
    totalIngredients: 12,
  })
  assert.equal(result.score, 0)
  assert.equal(result.verdict, 'Unsafe')
  assert.equal(result.tier, 1)
})

test('celiac AVOID returns 0', () => {
  const result = calculateFillrFit({
    allergyMatches: [],
    celiacSeverity: 'AVOID',
    ingredientCounts: {
      natural: 8,
      processed: 3,
      additive: 1,
      flagged: 1,
    },
    totalIngredients: 13,
  })
  assert.equal(result.score, 0)
  assert.equal(result.tier, 1)
})

test('celiac CAUTION caps at 50', () => {
  const result = calculateFillrFit({
    allergyMatches: [],
    celiacSeverity: 'CAUTION',
    ingredientCounts: {
      natural: 15,
      processed: 2,
      additive: 0,
      flagged: 0,
    },
    totalIngredients: 17,
  })
  assert.ok(result.score <= 50)
  assert.equal(result.tier, 2)
})

test('sensitivity caps at 50', () => {
  const result = calculateFillrFit({
    allergyMatches: [],
    sensitivityMatches: ['MSG'],
    ingredientCounts: {
      natural: 12,
      processed: 2,
      additive: 0,
      flagged: 0,
    },
    totalIngredients: 14,
  })
  assert.ok(result.score <= 50)
  assert.equal(result.tier, 2)
})

test('clean product with matching goal scores high', () => {
  const result = calculateFillrFit({
    allergyMatches: [],
    celiacSeverity: 'SAFE',
    sensitivityMatches: [],
    avoidingMatches: [],
    goalMatches: ['high-protein'],
    goalConflicts: [],
    ingredientCounts: {
      natural: 14,
      processed: 1,
      additive: 0,
      flagged: 0,
    },
    totalIngredients: 15,
  })
  assert.ok(result.score >= 75)
  assert.equal(result.tier, 3)
})

test('multiple allergies still returns 0', () => {
  const result = calculateFillrFit({
    allergyMatches: ['peanuts', 'dairy', 'gluten'],
    ingredientCounts: {
      natural: 5,
      processed: 0,
      additive: 0,
      flagged: 0,
    },
    totalIngredients: 5,
  })
  assert.equal(result.score, 0)
})

test('no profile uses pure quality scoring', () => {
  const cleanResult = calculateFillrFit({
    allergyMatches: [],
    celiacSeverity: 'SAFE',
    sensitivityMatches: [],
    avoidingMatches: [],
    goalMatches: [],
    goalConflicts: [],
    ingredientCounts: {
      natural: 15,
      processed: 2,
      additive: 0,
      flagged: 0,
    },
    totalIngredients: 17,
  })
  assert.ok(cleanResult.score > 70)

  const badResult = calculateFillrFit({
    allergyMatches: [],
    celiacSeverity: 'SAFE',
    sensitivityMatches: [],
    avoidingMatches: [],
    goalMatches: [],
    goalConflicts: [],
    ingredientCounts: {
      natural: 3,
      processed: 5,
      additive: 8,
      flagged: 4,
    },
    totalIngredients: 20,
  })
  assert.ok(badResult.score < 40)
})
