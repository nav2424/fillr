import test from 'node:test'
import assert from 'node:assert/strict'
import type { FillrScoringDataSnapshot } from '../types'
import { buildScoreExplainability } from './buildScoreExplainability'

test('top contributors include sensitivity cap when matches present', () => {
  const scoringData: FillrScoringDataSnapshot = {
    sensitivityMatches: ['Caffeine'],
    ingredientCounts: { natural: 10, processed: 2, additive: 1, flagged: 0 },
    eNumberCount: 0,
    genericFunctionalTermCount: 0,
    industrialSweetenerCount: 0,
    hydrogenatedOilCount: 0,
    sweetenerCount: 0,
    sugarScore: 0,
  }
  const { contributors } = buildScoreExplainability({ scoringData, ingredients: [], goalKey: '' })
  assert.ok(
    contributors.some(
      (c) => c.label === 'sensitivity match' && c.capMaxScore === 50 && c.delta === 0,
    ),
  )
})
