import test from 'node:test'
import assert from 'node:assert/strict'
import { parseIngredientListFromPlain } from './ingredientTextParsing'
import { shouldTranslateFrenchOnlyIngredientLabel } from '../services/ocrLabelTranslation'

test('OCR with no ingredients header — full blob parses', () => {
  const raw = 'Sugar, enriched flour, palm oil, salt, natural flavors'
  const result = parseIngredientListFromPlain(raw, 'ocr')
  assert.ok(result.some((s) => /sugar/i.test(s)))
  assert.ok(result.some((s) => /palm oil/i.test(s)))
  assert.equal(result.length, 5)
})

test('OCR misread header lngredients is stripped', () => {
  const raw = 'lngredients: Sugar, flour, water, salt'
  const result = parseIngredientListFromPlain(raw, 'ocr')
  assert.ok(result.some((s) => /sugar/i.test(s)))
  assert.ok(!result.some((s) => /lngredients/i.test(s)))
})

test('OCR strips BB / expiry style fragment', () => {
  const raw = 'Sugar, salt, BB: 2026/03/15, water'
  const result = parseIngredientListFromPlain(raw, 'ocr')
  assert.ok(!result.some((s) => /bb\s*:/i.test(s)))
  assert.equal(result.length, 3)
})

test('OCR strips may contain clause', () => {
  const raw = 'Sugar, flour, salt. May contain peanuts.'
  const result = parseIngredientListFromPlain(raw, 'ocr')
  assert.ok(!result.some((s) => /peanuts/i.test(s)))
  assert.equal(result.length, 3)
})

test('OCR bilingual EN + FR still dedupes', () => {
  const raw =
    'Ingredients: Sugar, salt, water. Ingrédients: Sucre, sel, eau.'
  const result = parseIngredientListFromPlain(raw, 'ocr')
  assert.equal(result.length, 3)
})

test('FR-only heuristic detects without English markers', () => {
  const raw = 'Ingrédients: Sucre, farine, huile de palme'
  assert.equal(shouldTranslateFrenchOnlyIngredientLabel(raw), true)
})

test('Bilingual label does not force French-only translation', () => {
  const raw = 'Ingredients: sugar. Ingrédients: sucre.'
  assert.equal(shouldTranslateFrenchOnlyIngredientLabel(raw), false)
})
