import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFormulaConcerns, formulaConcernHeadline } from './buildFormulaConcerns'

test('detects seed oils and preservatives on snack label', () => {
  const concerns = buildFormulaConcerns([
    'Sweet potato',
    'Expeller pressed canola oil',
    'Sea salt',
    'Potassium sorbate',
    'Sunflower lecithin',
  ])
  const ids = concerns.map((c) => c.id)
  assert.ok(ids.includes('seed_oils'))
  assert.ok(ids.includes('preservatives'))
  assert.ok(ids.includes('emulsifiers'))
  const seed = concerns.find((c) => c.id === 'seed_oils')
  assert.ok(seed?.ingredients.some((n) => /canola/i.test(n)))
})

test('splits compound oil ingredients without trailing and', () => {
  const concerns = buildFormulaConcerns(['Expeller pressed canola oil and safflower oil'])
  const seed = concerns.find((c) => c.id === 'seed_oils')
  assert.deepEqual(seed?.ingredients, ['Expeller pressed canola oil', 'Safflower oil'])
  assert.ok(!seed?.ingredients.some((n) => /\band\b/i.test(n)))
})

test('extracts oils from parenthetical vegetable oil lists', () => {
  const concerns = buildFormulaConcerns(['Vegetable oil (canola, sunflower and/or corn oil)'])
  const seed = concerns.find((c) => c.id === 'seed_oils')
  assert.ok(seed?.ingredients.some((n) => /canola/i.test(n)))
  assert.ok(seed?.ingredients.some((n) => /sunflower/i.test(n)))
  assert.ok(seed?.ingredients.some((n) => /corn/i.test(n)))
})

test('never surfaces trailing and on compound oil line', () => {
  const concerns = buildFormulaConcerns(['Expeller pressed canola oil and safflower oil'])
  const seed = concerns.find((c) => c.id === 'seed_oils')
  assert.ok(seed?.ingredients.every((n) => !/\b(?:and|or)\s*$/i.test(n)))
})

test('headline summarizes top concerns', () => {
  const concerns = buildFormulaConcerns(['Canola oil', 'Potassium sorbate', 'Red 40'])
  assert.match(formulaConcernHeadline(concerns) ?? '', /contains/i)
})
