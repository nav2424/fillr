import test from 'node:test'
import assert from 'node:assert/strict'
import { isTrustedSharedProductSource } from './sharedProductSourceTrust'

test('trusts only Open Food Facts shared cache sources', () => {
  assert.equal(isTrustedSharedProductSource('openfoodfacts'), true)
  assert.equal(isTrustedSharedProductSource('OpenFoodFacts'), true)
})

test('rejects user-provided shared cache sources even when combined with Open Food Facts', () => {
  assert.equal(isTrustedSharedProductSource('photo_ocr'), false)
  assert.equal(isTrustedSharedProductSource('manual_entry'), false)
  assert.equal(isTrustedSharedProductSource('openfoodfacts_backfilled'), false)
  assert.equal(isTrustedSharedProductSource('user_backfilled_openfoodfacts'), false)
})

test('rejects empty or unknown shared cache sources', () => {
  assert.equal(isTrustedSharedProductSource(''), false)
  assert.equal(isTrustedSharedProductSource(null), false)
  assert.equal(isTrustedSharedProductSource('partner_feed'), false)
})
