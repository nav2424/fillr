'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { applyDeterministicRatings } = require('./ingredientMatcher.js')

test('HFCS is always concerning', () => {
  const result = applyDeterministicRatings([{ name: 'High Fructose Corn Syrup', rating: 'clean' }])
  assert.equal(result[0].rating, 'concerning')
  assert.equal(result[0].ratingSource, 'deterministic')
})

test('Yellow 5 is always avoid', () => {
  const result = applyDeterministicRatings([{ name: 'Yellow 5', rating: 'clean' }])
  assert.equal(result[0].rating, 'avoid')
})

test('Roasted peanuts are always clean', () => {
  const result = applyDeterministicRatings([{ name: 'Roasted peanuts', rating: 'avoid' }])
  assert.equal(result[0].rating, 'clean')
})

test('Unknown ingredient keeps AI rating', () => {
  const result = applyDeterministicRatings([
    { name: 'Proprietary enzyme blend', rating: 'okay' },
  ])
  assert.equal(result[0].rating, 'okay')
  assert.equal(result[0].ratingSource, 'ai')
})

test('Carrageenan is concerning', () => {
  const result = applyDeterministicRatings([{ name: 'Carrageenan', rating: 'clean' }])
  assert.equal(result[0].rating, 'concerning')
})

test('Polysorbate 60 is concerning', () => {
  const result = applyDeterministicRatings([{ name: 'Polysorbate 60', rating: 'clean' }])
  assert.equal(result[0].rating, 'concerning')
})

test('FD&C Yellow #5 normalizes to match yellow 5 avoid list', () => {
  const result = applyDeterministicRatings([{ name: 'FD&C Yellow #5', rating: 'clean' }])
  assert.equal(result[0].rating, 'avoid')
})

test('Glucose-fructose syrup is concerning (HFCS family)', () => {
  const result = applyDeterministicRatings([{ name: 'Glucose-fructose syrup', rating: 'clean' }])
  assert.equal(result[0].rating, 'concerning')
})

test('Calcium disodium EDTA is concerning', () => {
  const result = applyDeterministicRatings([{ name: 'Calcium disodium EDTA', rating: 'clean' }])
  assert.equal(result[0].rating, 'concerning')
})

test('Sorbic acid is concerning', () => {
  const result = applyDeterministicRatings([{ name: 'Sorbic acid', rating: 'clean' }])
  assert.equal(result[0].rating, 'concerning')
})

test('Modified potato starch is concerning', () => {
  const result = applyDeterministicRatings([{ name: 'Modified potato starch', rating: 'clean' }])
  assert.equal(result[0].rating, 'concerning')
})
