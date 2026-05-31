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

test('barcode strips facility cross-contact and bare allergen tokens', () => {
  const raw =
    'Sugar, cocoa, salt. Possible cross-contamination: made in the same facility as products containing wheat, milk, and eggs.'
  const result = parseIngredientListFromPlain(raw, 'barcode')
  assert.ok(!result.some((s) => /^(wheat|milk|eggs?)$/i.test(s.trim())))
  assert.ok(result.some((s) => /sugar/i.test(s)))
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

test('OCR drops importer / satisfaction / phone tail after ingredients', () => {
  const raw = [
    'Ingredients: Canola oil, Salt, Tea.',
    'Importé par : hain-celestial canada Ulg. toronto',
    'Inc. hain if you are not completely satisfied',
    'Please cal',
    'Veuillez composer le: 800-913-663',
  ].join(' ')
  const result = parseIngredientListFromPlain(raw, 'ocr')
  assert.ok(result.some((s) => /canola/i.test(s)))
  assert.ok(result.some((s) => /^salt$/i.test(s)))
  assert.ok(result.some((s) => /^tea$/i.test(s)))
  assert.ok(!result.some((s) => /hain|satisfied|800|importé|veuillez|toronto|please/i.test(s)))
})

test('comma-only bilingual (EN block then FR duplicate) drops French tail', () => {
  const raw = [
    'water',
    'Defatted soy flour',
    'Calcium propionate',
    'Sodium stearoyl2lactylate',
    'Sorbic acid',
    'Vegetable monoglycerides',
    'Farine de soya dégraissée',
    'Propionate de calcium',
  ].join(', ')
  const result = parseIngredientListFromPlain(`Ingredients: ${raw}`, 'barcode')
  assert.ok(result.length <= 6, `expected FR tail removed, got ${result.length}: ${result.join(' | ')}`)
  assert.ok(!result.some((s) => /farine de soya/i.test(s)))
  assert.ok(!result.some((s) => /propionate de calcium/i.test(s)))
  assert.ok(result.some((s) => /stearoyl-2-lactylate/i.test(s)))
})

test('OCR mustard-style label: missing commas, bullets, fused FR header still yields many ingredients', () => {
  const raw = [
    'Vinegar',
    'Water Sugars (sugar, honey, brown sugar) Mustard seed Salt',
    '• Spices Turmeric Citric acid',
    'Paprika. Contains: Mustard.',
    '4Ingrédients : Vinaigre Eau Sucres (sucre,',
    'Graines de moutardeSel',
    'Contient: M',
  ].join('\n')
  const result = parseIngredientListFromPlain(raw, 'ocr')
  assert.ok(result.length >= 8, `expected many tokens, got ${result.length}: ${result.join(' | ')}`)
  assert.ok(result.some((s) => /vinegar/i.test(s)))
  assert.ok(result.some((s) => /mustard|moutarde/i.test(s)))
  assert.ok(result.some((s) => /paprika/i.test(s)))
})

test('barcode drops minor-ingredient sub-list header (2% or less) as its own token', () => {
  const raw =
    'Enriched flour, water, sugar, contains 2% and less of each of the following, milk derivative, salt'
  const result = parseIngredientListFromPlain(`Ingredients: ${raw}`, 'barcode')
  assert.ok(!result.some((s) => /2%\s*and\s*less|each\s+of\s+the\s+following/i.test(s)))
  assert.ok(result.some((s) => /milk derivative/i.test(s)))
  assert.ok(result.some((s) => /enriched flour/i.test(s)))
})

test('barcode strips minor-ingredient preamble when it shares a comma segment with the first item', () => {
  const raw = 'Water, contains 2% or less of: whey protein, salt'
  const result = parseIngredientListFromPlain(`Ingredients: ${raw}`, 'barcode')
  assert.ok(!result.some((s) => /^contains\s+2%/i.test(s)))
  assert.ok(result.some((s) => /^whey protein$/i.test(s)))
  assert.ok(result.some((s) => /^salt$/i.test(s)))
})

test('barcode parser drops pasteurized UHT packaging tail after ingredients', () => {
  const raw =
    'Ingrédients: Lait, Crème, Carraghénine, Phosphate disodique, Mono- et diglycérides, Citrate de sodium. Ingredients: Milk, Cream, Carrageenan, Disodium phosphate, Mono- and diglycerides, Sodium citrate. PASTEURISÉ UHT / UHT PASTEURIZED GARDER AU RÉFRIGÉRATEUR / KEEP REFRIGERATED'
  const result = parseIngredientListFromPlain(raw, 'barcode')
  assert.deepEqual(result, [
    'Milk',
    'Cream',
    'Carrageenan',
    'Disodium phosphate',
    'Mono- and diglycerides',
    'Sodium citrate',
  ])
  assert.ok(!result.some((s) => /pasteur|uht|refrigerated|réfrigérateur/i.test(s)))
})
