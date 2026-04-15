import test from 'node:test'
import assert from 'node:assert/strict'
import { lookupIngredientAmbiguity } from './ingredientAmbiguity'

test('cocoa butter — plant fat, not dairy butter', () => {
  const a = lookupIngredientAmbiguity('cocoa butter')
  assert.equal(a?.category, 'dairy')
  assert.equal(a?.confidence, 'high')
})

test('coconut aminos — not soy', () => {
  const a = lookupIngredientAmbiguity('coconut aminos')
  assert.equal(a?.category, 'soy')
})

test('modified starch — gluten gray message', () => {
  const a = lookupIngredientAmbiguity('modified food starch')
  assert.equal(a?.category, 'gluten')
  assert.match(a?.message ?? '', /verify with manufacturer/i)
})

test('unknown line — no ambiguity', () => {
  assert.equal(lookupIngredientAmbiguity('water'), null)
})
