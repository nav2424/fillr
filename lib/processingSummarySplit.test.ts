import test from 'node:test'
import assert from 'node:assert/strict'
import type { IngredientExplanation } from '../types'
import { splitProcessingSummary } from './processingSummarySplit'

function ing(name: string, rating: IngredientExplanation['ingredientRating']): IngredientExplanation {
  return {
    name,
    whatItIs: '',
    whyItsUsed: '',
    whatToKnow: '',
    ingredientRating: rating,
  }
}

test('sorbic acid rated okay is grouped with real concerns', () => {
  const { concerns, fine } = splitProcessingSummary([ing('Sorbic acid', 'okay'), ing('Water', 'clean')])
  assert.equal(concerns.length, 1)
  assert.equal(concerns[0].name, 'Sorbic acid')
  assert.equal(fine.length, 1)
})

test('potassium sorbate rated okay is grouped with real concerns', () => {
  const { concerns } = splitProcessingSummary([ing('Potassium sorbate', 'okay')])
  assert.equal(concerns.length, 1)
})
