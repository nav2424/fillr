import test from 'node:test'
import assert from 'node:assert/strict'
import { ingredientExplanationFailsQualityGate } from './ingredientCopyQuality'
import {
  createAwaitingDecodeAnalysisItem,
  createAwaitingDecodeIngredientExplanation,
  createOfflineOrTimeoutIngredientExplanation,
} from './ingredientDecodePlaceholder'

test('awaiting-decode placeholders fail quality gate until repaired', () => {
  assert.equal(ingredientExplanationFailsQualityGate(createAwaitingDecodeIngredientExplanation('Maple syrup')), true)
})

test('createAwaitingDecodeAnalysisItem is invalid for full-list validation', () => {
  const item = createAwaitingDecodeAnalysisItem('Guar gum')
  assert.ok(!item.headline?.trim())
  assert.ok(!item.whatItIs?.trim())
})

test('offline/timeout hydration copy is explicit unavailable fallback, not real intelligence', () => {
  const item = createOfflineOrTimeoutIngredientExplanation('Guar gum')
  assert.equal(item.ingredientDecodeStatus, 'unavailable')
  assert.equal(ingredientExplanationFailsQualityGate(item), true)
})
