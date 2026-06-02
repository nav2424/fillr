import test from 'node:test'
import assert from 'node:assert/strict'
import { barcodeLookupCandidates } from './openFoodFactsFetch'

test('barcodeLookupCandidates adds leading zero for 12-digit UPC-A', () => {
  assert.deepEqual(barcodeLookupCandidates('049000050103'), ['049000050103', '0049000050103'])
})

test('barcodeLookupCandidates keeps 13-digit EAN unchanged', () => {
  assert.deepEqual(barcodeLookupCandidates('0049000050103'), ['0049000050103', '049000050103'])
})
