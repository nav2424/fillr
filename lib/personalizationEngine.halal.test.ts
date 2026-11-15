import test from 'node:test'
import assert from 'node:assert/strict'

import { personalizeScanResult, type UserProfile } from './personalizationEngine'
import { buildProfileMatches } from './buildProfileMatches'
import type { ScanResult } from '../types'

function scan(ingredientText: string): ScanResult {
  return {
    product: {
      id: 't',
      barcode: 'x',
      name: 'Test',
      brand: '',
      ingredientText,
      source: 'off',
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

function profile(preferences: string[]): UserProfile {
  return { allergies: [], sensitivities: [], preferences, goal: '' }
}

function status(preferences: string[], ingredientText: string): ScanResult['safetyStatus'] {
  return personalizeScanResult(scan(ingredientText), profile(preferences)).safetyStatus
}

test('halal scans are UNSAFE when the label lists beverage alcohol', () => {
  // OFF 0688267081354 and 0052100041537 (Pure Vanilla Extract).
  const labels = [
    'vanilla bean extractives in water, alcohol',
    'VANILLA BEAN EXTRACTIVES, WATER, ALCOHOL.',
    'ethyl alcohol, water',
    'grain alcohol',
    'alcohol (35%)',
    '35% alcohol',
    'ethanol',
    'low-alcohol beverage',
    'pork fat',
    'wine',
  ]
  for (const label of labels) {
    assert.equal(status(['halal'], label), 'UNSAFE', label)
  }
})

test('halal scans stay SAFE for non-ethanol alcohol names and alcohol-free claims', () => {
  const labels = [
    'erythritol (sugar alcohol), water',
    'sugar alcohols',
    'sugar-alcohol',
    'benzyl alcohol, citric acid',
    'cetyl alcohol',
    'stearyl alcohol',
    'cetearyl alcohol',
    'polyvinyl alcohol',
    'isopropyl alcohol',
    'phenylethyl alcohol',
    'phenethyl alcohol',
    'alcohol-free vanilla flavor, water',
    'Alcohol-Free',
    'alcohol free syrup',
    'non-alcoholic flavor',
    'non alcoholic',
    'non-alcohol',
    'no alcohol added, water, sugar',
    'without alcohol',
    'water, sugar, vanilla',
  ]
  for (const label of labels) {
    assert.equal(status(['halal'], label), 'SAFE', label)
  }
})

test('beverage alcohol does not change vegan or kosher hard verdicts', () => {
  const label = 'vanilla bean extractives in water, alcohol'
  assert.equal(status(['vegan'], label), 'SAFE')
  assert.equal(status(['vegetarian'], label), 'SAFE')
  assert.equal(status(['plant_based'], label), 'SAFE')
  assert.equal(status(['kosher'], label), 'SAFE')
})

test('halal fit score flags ethanol and ignores benzyl alcohol and sugar alcohol', () => {
  const base = { allergies: [], sensitivities: [], avoiding: [], preferences: ['halal'], goal: '' }
  const ethanol = buildProfileMatches(base, ['vanilla bean extractives in water, alcohol'])
  assert.ok(ethanol.goalConflicts.includes('Halal'))
  assert.ok(ethanol.preferencePenalty >= 22)

  const split = buildProfileMatches(base, ['water', 'alcohol'])
  assert.ok(split.goalConflicts.includes('Halal'))

  const benzyl = buildProfileMatches(base, ['benzyl alcohol', 'citric acid'])
  assert.equal(benzyl.goalConflicts.includes('Halal'), false)
  assert.equal(benzyl.preferencePenalty, 0)

  const sugarAlcohol = buildProfileMatches(base, ['erythritol (sugar alcohol)'])
  assert.equal(sugarAlcohol.goalConflicts.includes('Halal'), false)

  const pork = buildProfileMatches(base, ['pork fat'])
  assert.ok(pork.goalConflicts.includes('Halal'))
})
