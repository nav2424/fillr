import assert from 'node:assert/strict'
import test from 'node:test'
import { personalizeScanResult } from './personalizationEngine'
import type { ScanResult } from '../types'

function scanWithIngredients(ingredientText: string): ScanResult {
  return {
    product: {
      id: 'prod_gelatin',
      barcode: '0000000000000',
      name: 'Gummy candy',
      brand: 'Test',
      ingredientText,
      source: 'test',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    safetyStatus: 'SAFE',
    matchedAllergens: [],
    matchedSensitivities: [],
    smartSummary: '',
    ingredientBreakdown: [],
    insights: [],
  }
}

const halalProfile = {
  allergies: [] as string[],
  sensitivities: [] as string[],
  preferences: ['halal'],
  goal: '',
}

test('halal preference is UNSAFE when gelatin is the only animal ingredient', () => {
  const out = personalizeScanResult(
    scanWithIngredients('sugar, corn syrup, gelatin, citric acid, natural flavors'),
    halalProfile
  )
  assert.equal(out.safetyStatus, 'UNSAFE')
})

test('halal preference is UNSAFE for British gelatine and for pepsin', () => {
  assert.equal(
    personalizeScanResult(
      scanWithIngredients('glucose syrup, gelatine, citric acid'),
      halalProfile
    ).safetyStatus,
    'UNSAFE'
  )
  assert.equal(
    personalizeScanResult(
      scanWithIngredients('milk, salt, pepsin, cultures'),
      halalProfile
    ).safetyStatus,
    'UNSAFE'
  )
})

test('halal preference stays SAFE when the list has no pork, gelatin, or alcohol', () => {
  const out = personalizeScanResult(
    scanWithIngredients('sugar, corn syrup, pectin, citric acid, agar'),
    halalProfile
  )
  assert.equal(out.safetyStatus, 'SAFE')
})

test('pork still makes a halal scan UNSAFE', () => {
  const out = personalizeScanResult(
    scanWithIngredients('pork, salt, spices'),
    halalProfile
  )
  assert.equal(out.safetyStatus, 'UNSAFE')
})
