import test from 'node:test'
import assert from 'node:assert/strict'
import { detectProductPatterns } from './productPatternDetection'

test('detects sugars, emulsifiers, modified oils, protein isolates, and fibers', () => {
  const out = detectProductPatterns([
    'Sugar',
    'Glucose-fructose syrup',
    'Soy lecithin',
    'PGPR',
    'Modified palm oil',
    'Pea protein isolate',
    'Jerusalem artichoke fiber',
  ])

  assert.equal(out.sugarCount, 2)
  assert.equal(out.hasStackedSugars, true)
  assert.equal(out.hasEmulsifiers, true)
  assert.equal(out.hasModifiedOils, true)
  assert.equal(out.hasProteinIsolates, true)
  assert.equal(out.hasFiberAdditives, true)
  assert.equal(out.likelyUltraProcessed, true)
  assert.ok(out.productPatternSummary.length >= 2)
})

test('stays conservative for simple whole-food list', () => {
  const out = detectProductPatterns(['Water', 'Roasted peanuts', 'Sea salt'])
  assert.equal(out.sugarCount, 0)
  assert.equal(out.hasStackedSugars, false)
  assert.equal(out.hasEmulsifiers, false)
  assert.equal(out.hasModifiedOils, false)
  assert.equal(out.hasProteinIsolates, false)
  assert.equal(out.hasFiberAdditives, false)
})

