import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeIngredientName } from './ingredientNameNormalization'

test('normalizes sugar variants to sugar', () => {
  assert.equal(normalizeIngredientName('sugar'), 'sugar')
  assert.equal(normalizeIngredientName('Cane Sugar'), 'sugar')
  assert.equal(normalizeIngredientName('golden sugar'), 'sugar')
  assert.equal(normalizeIngredientName('brown sugar'), 'sugar')
})

test('normalizes salt variants to salt', () => {
  assert.equal(normalizeIngredientName('sea salt'), 'salt')
  assert.equal(normalizeIngredientName('salt'), 'salt')
  assert.equal(normalizeIngredientName('sodium chloride'), 'salt')
})

test('normalizes soy lecithin variants', () => {
  assert.equal(normalizeIngredientName('soy lecithin'), 'soy lecithin')
  assert.equal(normalizeIngredientName('lecithin from soy'), 'soy lecithin')
  assert.equal(normalizeIngredientName('Lecithin (Soy)'), 'soy lecithin')
  assert.equal(normalizeIngredientName('lecithin from soybeans'), 'soy lecithin')
})

test('normalizes natural flavour variants', () => {
  assert.equal(normalizeIngredientName('natural flavour'), 'natural flavor')
  assert.equal(normalizeIngredientName('natural flavor'), 'natural flavor')
  assert.equal(normalizeIngredientName('natural flavouring'), 'natural flavor')
})

test('normalizes glucose-fructose and hfcs family to one key', () => {
  assert.equal(normalizeIngredientName('glucose-fructose'), 'high fructose corn syrup')
  assert.equal(normalizeIngredientName('glucose fructose syrup'), 'high fructose corn syrup')
  assert.equal(normalizeIngredientName('high fructose corn syrup'), 'high fructose corn syrup')
})

test('keeps unknown ingredients readable and normalized', () => {
  assert.equal(normalizeIngredientName('  Cocoa Extract  '), 'cocoa extract')
})

