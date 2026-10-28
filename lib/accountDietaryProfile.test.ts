import test from 'node:test'
import assert from 'node:assert/strict'
import {
  clearAccountDietaryProfile,
  dietarySnapshotFromUserState,
  isAccountDietarySnapshotBlank,
  loadAccountDietaryProfile,
  restoredDietaryFields,
  saveAccountDietaryProfile,
} from './accountDietaryProfile'

function memoryStore() {
  const values = new Map<string, string>()
  return {
    values,
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: async (key: string) => {
      values.delete(key)
    },
  }
}

const milkProfile = dietarySnapshotFromUserState({
  allergies: ['milk'],
  sensitivities: ['lactose'],
  preferences: ['less_processed'],
  goal: 'eat_cleaner',
  celiacStrictGluten: false,
  nutritionTargets: {},
})

test('sign-out snapshot restores the same account allergy list and not another account', async () => {
  const store = memoryStore()
  await saveAccountDietaryProfile('user-a', milkProfile, store)
  await saveAccountDietaryProfile(
    'user-b',
    dietarySnapshotFromUserState({ allergies: ['peanuts'], goal: '' }),
    store
  )

  const wiped = dietarySnapshotFromUserState({
    allergies: [],
    sensitivities: [],
    preferences: [],
    goal: '',
    celiacStrictGluten: false,
    nutritionTargets: {},
  })
  assert.equal(isAccountDietarySnapshotBlank(wiped), true)

  const restored = restoredDietaryFields(wiped, await loadAccountDietaryProfile('user-a', store))
  assert.deepEqual(restored?.allergies, ['milk'])
  assert.deepEqual(restored?.sensitivities, ['lactose'])
  assert.equal(restored?.goal, 'eat_cleaner')

  const other = restoredDietaryFields(wiped, await loadAccountDietaryProfile('user-b', store))
  assert.deepEqual(other?.allergies, ['peanuts'])
  assert.notDeepEqual(other?.allergies, ['milk'])
})

test('a live allergy list is not replaced by the last sign-out snapshot', async () => {
  const store = memoryStore()
  await saveAccountDietaryProfile('user-a', milkProfile, store)
  const live = dietarySnapshotFromUserState({ allergies: ['peanuts'], goal: 'eat_cleaner' })
  assert.equal(restoredDietaryFields(live, await loadAccountDietaryProfile('user-a', store)), null)
})

test('an intentional empty sign-out snapshot does not resurrect an older allergy list', async () => {
  const store = memoryStore()
  await saveAccountDietaryProfile('user-a', milkProfile, store)
  const cleared = dietarySnapshotFromUserState({ allergies: [], goal: '' })
  await saveAccountDietaryProfile('user-a', cleared, store)
  const wiped = dietarySnapshotFromUserState({ allergies: [], goal: '' })
  assert.equal(restoredDietaryFields(wiped, await loadAccountDietaryProfile('user-a', store)), null)
})

test('account deletion removes only that account snapshot', async () => {
  const store = memoryStore()
  await saveAccountDietaryProfile('user-a', milkProfile, store)
  await saveAccountDietaryProfile(
    'user-b',
    dietarySnapshotFromUserState({ allergies: ['soy'], goal: '' }),
    store
  )
  await clearAccountDietaryProfile('user-a', store)
  assert.equal(await loadAccountDietaryProfile('user-a', store), null)
  assert.deepEqual((await loadAccountDietaryProfile('user-b', store))?.allergies, ['soy'])
})
