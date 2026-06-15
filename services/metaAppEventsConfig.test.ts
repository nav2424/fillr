import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hasMetaAppEventsConfig } from './metaAppEventsConfig'

test('hasMetaAppEventsConfig requires app id and client token', () => {
  assert.equal(hasMetaAppEventsConfig({}), false)
  assert.equal(hasMetaAppEventsConfig({ EXPO_PUBLIC_FACEBOOK_APP_ID: '123' }), false)
  assert.equal(
    hasMetaAppEventsConfig({ EXPO_PUBLIC_FACEBOOK_CLIENT_TOKEN: 'token' }),
    false,
  )
  assert.equal(
    hasMetaAppEventsConfig({
      EXPO_PUBLIC_FACEBOOK_APP_ID: '   ',
      EXPO_PUBLIC_FACEBOOK_CLIENT_TOKEN: 'token',
    }),
    false,
  )
  assert.equal(
    hasMetaAppEventsConfig({
      EXPO_PUBLIC_FACEBOOK_APP_ID: '123',
      EXPO_PUBLIC_FACEBOOK_CLIENT_TOKEN: ' token ',
    }),
    true,
  )
})
