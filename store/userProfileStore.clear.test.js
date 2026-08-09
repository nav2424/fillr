/**
 * Ensures account wipe removes the AsyncStorage dietary profile used by scan personalization.
 */
const { mock } = require('node:test')
const assert = require('node:assert/strict')
const test = require('node:test')
const Module = require('module')
const path = require('path')

const STORAGE_KEY = 'fillr-user-profile-v1'
const mem = new Map()

const asyncStorageMock = {
  getItem: async (key) => (mem.has(key) ? mem.get(key) : null),
  setItem: async (key, value) => {
    mem.set(key, String(value))
  },
  removeItem: async (key) => {
    mem.delete(key)
  },
}

const asyncStorageResolved = path.join(
  path.dirname(require.resolve('../package.json')),
  'node_modules',
  '@react-native-async-storage',
  'async-storage'
)

const originalLoad = Module._load
Module._load = function patchedLoad(request, parent, isMain) {
  if (
    request === '@react-native-async-storage/async-storage' ||
    (typeof request === 'string' && request.includes('@react-native-async-storage/async-storage'))
  ) {
    return { default: asyncStorageMock, ...asyncStorageMock }
  }
  return originalLoad(request, parent, isMain)
}

// Fresh require after mock is installed.
const storePath = require.resolve('./userProfileStore.js')
delete require.cache[storePath]
const { saveUserProfile, getUserProfile, getUserProfileOrNull, clearUserProfile } = require('./userProfileStore.js')

test('clearUserProfile removes dietary profile so the next account cannot inherit it', async () => {
  mem.clear()
  await saveUserProfile({
    allergies: ['peanuts', 'dairy'],
    sensitivities: ['lactose'],
    avoiding: [],
    preferences: ['vegan'],
    goal: 'gut_health',
    celiacStrictGluten: true,
  })

  const before = await getUserProfileOrNull()
  assert.ok(before)
  assert.deepEqual(before.allergies, ['peanuts', 'dairy'])
  assert.equal(before.celiacStrictGluten, true)
  assert.equal(mem.has(STORAGE_KEY), true)

  await clearUserProfile()

  assert.equal(mem.has(STORAGE_KEY), false)
  assert.equal(await getUserProfileOrNull(), null)

  const after = await getUserProfile()
  assert.deepEqual(after.allergies, [])
  assert.equal(after.celiacStrictGluten, false)
})

test('clearUserProfile is idempotent when no profile exists', async () => {
  mem.clear()
  await clearUserProfile()
  assert.equal(await getUserProfileOrNull(), null)
})

// Keep mock available for the process; restore loader for cleanliness.
Module._load = originalLoad
void mock
void asyncStorageResolved
