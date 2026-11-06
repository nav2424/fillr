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

test('vegan and plant-based scans stay SAFE for plant butters and milks', () => {
  const labels = [
    'cocoa butter, cane sugar, cocoa mass, vanilla',
    'coconut milk, water, guar gum',
    'peanut butter, salt',
    'shea butter, sunflower oil',
    'oat milk, water, salt',
    'almond milk powder, sugar',
    'coconut-milk powder, salt',
    'coconut cream, sugar',
    'creamed coconut, sugar',
    'cream of tartar, sugar, egg-free',
    'butternut squash, olive oil, salt',
    'butter beans, salt, olive oil',
    'soy milk, cane sugar',
    'graham flour, sugar, molasses',
    'hamburger buns (wheat flour, water, sugar, yeast), ketchup',
  ]
  for (const preferences of [['vegan'], ['plant_based']]) {
    for (const label of labels) {
      assert.equal(status(preferences, label), 'SAFE', `${preferences[0]}: ${label}`)
    }
  }
})

test('vegan and plant-based scans are UNSAFE for animal foods the old pattern missed', () => {
  const labels = [
    'bacon, salt, sugar',
    'ham, water, salt',
    'turkey breast, water, salt',
    'shrimp, salt',
    'prawns, water, salt',
    'oysters, water',
    'ghee, salt',
    'buttermilk, salt',
    'butter, sugar',
    'whole milk, cocoa butter, sugar',
    'peanut butter, whey protein',
    'honey',
  ]
  for (const preferences of [['vegan'], ['plant_based']]) {
    for (const label of labels) {
      assert.equal(status(preferences, label), 'UNSAFE', `${preferences[0]}: ${label}`)
    }
  }
})

test('vegetarian scans flag meat and shellfish and still allow dairy', () => {
  assert.equal(status(['vegetarian'], 'bacon, salt'), 'UNSAFE')
  assert.equal(status(['vegetarian'], 'shrimp, salt'), 'UNSAFE')
  assert.equal(status(['vegetarian'], 'prawns, salt'), 'UNSAFE')
  assert.equal(status(['vegetarian'], 'turkey, water, salt'), 'UNSAFE')
  assert.equal(status(['vegetarian'], 'whole milk, sugar'), 'SAFE')
  assert.equal(status(['vegetarian'], 'ghee, salt'), 'SAFE')
  assert.equal(status(['vegetarian'], 'honey'), 'SAFE')
})

test('kosher scans flag prawns and other shellfish that are not shrimp, crab, or lobster', () => {
  assert.equal(status(['kosher'], 'prawns, salt, water'), 'UNSAFE')
  assert.equal(status(['kosher'], 'oysters, water'), 'UNSAFE')
  assert.equal(status(['kosher'], 'squid, salt'), 'UNSAFE')
  assert.equal(status(['kosher'], 'cocoa butter, sugar, vanilla'), 'SAFE')
  assert.equal(status(['kosher'], 'shrimp, salt'), 'UNSAFE')
})

test('profile fit score follows the same vegan exceptions and hits', () => {
  const base = { allergies: [], sensitivities: [], avoiding: [], preferences: ['vegan'], goal: '' }
  const cocoa = buildProfileMatches(base, ['cocoa butter', 'cane sugar'])
  assert.equal(cocoa.goalConflicts.includes('Vegan'), false)
  const bacon = buildProfileMatches(base, ['bacon', 'salt'])
  assert.ok(bacon.goalConflicts.includes('Vegan'))
  assert.ok(bacon.preferencePenalty >= 25)
  const milk = buildProfileMatches(base, ['cocoa butter', 'whole milk'])
  assert.ok(milk.goalConflicts.includes('Vegan'))
})
