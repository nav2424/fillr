import test from 'node:test'
import assert from 'node:assert/strict'
import { hasMetaAppEventsConfig } from './metaAppEventsConfig'

test('hasMetaAppEventsConfig requires both Facebook app id and client token', () => {
  assert.equal(hasMetaAppEventsConfig('123', 'token'), true)
  assert.equal(hasMetaAppEventsConfig('', 'token'), false)
  assert.equal(hasMetaAppEventsConfig('123', ''), false)
  assert.equal(hasMetaAppEventsConfig('   ', 'token'), false)
  assert.equal(hasMetaAppEventsConfig('123', '   '), false)
  assert.equal(hasMetaAppEventsConfig(undefined, 'token'), false)
  assert.equal(hasMetaAppEventsConfig('123', undefined), false)
})
