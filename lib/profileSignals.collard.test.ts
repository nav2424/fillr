import test from 'node:test'
import assert from 'node:assert/strict'

import { buildProfileMatches } from './buildProfileMatches'
import { personalizeScanResult } from './personalizationEngine'
import type { ScanResult } from '../types'

const HARD_PREFS = ['vegan', 'vegetarian', 'plant_based', 'halal', 'kosher'] as const

function scan(ingredientText: string): ScanResult {
  return {
    product: {
      id: 'collard',
      barcode: '0041443102111',
      name: 'Collard Greens',
      brand: '',
      ingredientText,
      ingredientTextSafetyHaystack: ingredientText,
      source: 'test',
      createdAt: '',
      updatedAt: '',
    },
    safetyStatus: 'SAFE',
    matchedAllergens: [],
    matchedSensitivities: [],
    smartSummary: '',
    ingredientBreakdown: [],
    insights: [],
  }
}

function statusFor(pref: string, ingredientText: string) {
  return personalizeScanResult(scan(ingredientText), {
    allergies: [],
    sensitivities: [],
    preferences: [pref],
    goal: '',
  }).safetyStatus
}

test('collard greens stay SAFE for hard diet profiles', () => {
  const labels = ['Collard Greens, Water.', 'COLLARD GREENS, WATER, SALT.', 'collard greens']
  for (const pref of HARD_PREFS) {
    for (const label of labels) {
      assert.equal(statusFor(pref, label), 'SAFE', `${pref} ${label}`)
    }
  }
})

test('lard and lardons stay UNSAFE for hard diet profiles', () => {
  const labels = ['lard, salt', 'rendered pork lard', 'lardons, salt']
  for (const pref of HARD_PREFS) {
    for (const label of labels) {
      assert.equal(statusFor(pref, label), 'UNSAFE', `${pref} ${label}`)
    }
  }
})

test('collard greens do not count as a lard conflict in profile scoring', () => {
  for (const pref of HARD_PREFS) {
    const matches = buildProfileMatches(
      {
        allergies: [],
        sensitivities: [],
        avoiding: [],
        preferences: [pref],
        goal: '',
      },
      ['Collard Greens', 'Water']
    )
    assert.deepEqual(matches.goalConflicts, [], pref)
  }

  const lard = buildProfileMatches(
    {
      allergies: [],
      sensitivities: [],
      avoiding: [],
      preferences: ['halal'],
      goal: '',
    },
    ['lard', 'salt']
  )
  assert.ok(lard.goalConflicts.includes('Halal'))
})
