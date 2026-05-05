import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ingredientExplanationFailsQualityGate,
  textMatchesIngredientGenericPattern,
} from './ingredientCopyQuality'

test('textMatchesIngredientGenericPattern catches cache filler', () => {
  assert.equal(textMatchesIngredientGenericPattern('This line on the label names a typical packaged-food ingredient.'), true)
})

test('ingredientExplanationFailsQualityGate rejects thin or template copy', () => {
  assert.equal(
    ingredientExplanationFailsQualityGate({
      name: 'X',
      whatItIs: 'short',
      whyItsUsed: '',
      whatToKnow: '',
      labelDecoder: '',
      headline: '',
    }),
    true
  )
  assert.equal(
    ingredientExplanationFailsQualityGate({
      name: 'Sugar',
      whatItIs:
        'Sucrose from cane or beets adds sweetness here and is digested like other simple sugars in your meal.',
      whyItsUsed: 'Sweetens and can help texture in baked goods.',
      whatToKnow: 'Portion matters for daily sugar totals.',
      labelDecoder: 'Table sugar is sucrose from sugar cane or sugar beets.',
      headline: 'Sweet crystals that balance flavor in this recipe.',
    }),
    false
  )
})
