import test from 'node:test'
import assert from 'node:assert/strict'
import {
  alignIngredientMatchScore,
  assignLabelsToAiItemsGreedy,
  scoreLabelToAiItem,
} from './ingredientLabelAiMerge'

test('alignIngredientMatchScore prefers exact and strong token overlap', () => {
  assert.ok(alignIngredientMatchScore('Maple syrup', 'Maple syrup') > 9000)
  assert.ok(
    alignIngredientMatchScore('Gluten-free oat flour', 'Oat flour') >
      alignIngredientMatchScore('Sugar', 'Coconut sugar')
  )
})

test('assignLabelsToAiItemsGreedy pairs rows without stealing short names', () => {
  const labels = ['Sugar', 'Coconut sugar', 'Maple syrup']
  const ai = [
    { name: 'Sucrose', ingredient_name: 'Sugar' },
    { name: 'Coconut palm sugar', ingredient_name: 'Coconut sugar' },
    { name: 'Maple syrup' },
  ]
  const m = assignLabelsToAiItemsGreedy(labels, ai)
  assert.equal(m.get(0), 0)
  assert.equal(m.get(1), 1)
  assert.equal(m.get(2), 2)
})

test('scoreLabelToAiItem uses ingredient_name when name differs', () => {
  const s = scoreLabelToAiItem('Fairtrade dark chocolate', {
    name: 'Dark chocolate',
    ingredient_name: 'Fairtrade dark chocolate (54% cocoa)',
  })
  assert.ok(s >= 1180)
})
