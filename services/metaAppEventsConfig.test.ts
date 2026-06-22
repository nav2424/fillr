import test from 'node:test'
import assert from 'node:assert/strict'
import { isMetaAppEventsConfigured } from './metaAppEventsConfig'

test('Meta App Events config is disabled when both Facebook values are missing', () => {
  assert.equal(isMetaAppEventsConfigured({}), false)
})

test('Meta App Events config is disabled when only the app id is present', () => {
  assert.equal(
    isMetaAppEventsConfigured({
      EXPO_PUBLIC_FACEBOOK_APP_ID: '123456789',
    }),
    false,
  )
})

test('Meta App Events config is disabled when only the client token is present', () => {
  assert.equal(
    isMetaAppEventsConfigured({
      EXPO_PUBLIC_FACEBOOK_CLIENT_TOKEN: 'token',
    }),
    false,
  )
})

test('Meta App Events config treats whitespace-only values as missing', () => {
  assert.equal(
    isMetaAppEventsConfigured({
      EXPO_PUBLIC_FACEBOOK_APP_ID: '  ',
      EXPO_PUBLIC_FACEBOOK_CLIENT_TOKEN: '\t',
    }),
    false,
  )
})

test('Meta App Events config is enabled when both Facebook values are present', () => {
  assert.equal(
    isMetaAppEventsConfigured({
      EXPO_PUBLIC_FACEBOOK_APP_ID: '123456789',
      EXPO_PUBLIC_FACEBOOK_CLIENT_TOKEN: 'token',
    }),
    true,
  )
})
