import test from 'node:test'
import assert from 'node:assert/strict'
import {
  INGREDIENT_SOURCE_PREFERENCE_MARGIN,
  isLearnedIngredientSource,
  resolveProductUpsertIngredient,
  scoreIngredientSource,
} from './productIngredientSource'

const recent = new Date().toISOString()

const ocrLabel =
  'Ingredients: roasted almonds, rolled oats, honey, sea salt. Contains: Almonds.'
const shortOff = 'oats, honey, sea salt'
const richerOff =
  'Ingredients: roasted almonds, rolled oats, honey, sea salt, sunflower oil, brown sugar, natural flavor, mixed tocopherols. Contains: Almonds.'

test('learned OCR/manual/backfill sources are detected', () => {
  assert.equal(isLearnedIngredientSource('photo_ocr'), true)
  assert.equal(isLearnedIngredientSource('manual_entry'), true)
  assert.equal(isLearnedIngredientSource('openfoodfacts_backfilled'), true)
  assert.equal(isLearnedIngredientSource('openfoodfacts'), false)
  assert.equal(isLearnedIngredientSource(null), false)
})

test('preserves OCR backfill when OFF text is weaker and missing Contains evidence', () => {
  const resolved = resolveProductUpsertIngredient({
    offIngredientText: shortOff,
    offUpdatedAt: recent,
    existingIngredientText: ocrLabel,
    existingSource: 'photo_ocr',
    existingUpdatedAt: recent,
  })
  assert.equal(resolved.source, 'photo_ocr')
  assert.equal(resolved.ingredientText, ocrLabel)
  assert.match(resolved.ingredientText ?? '', /Contains:\s*Almonds/i)
  assert.ok(
    scoreIngredientSource(ocrLabel, 'photo_ocr', recent) >=
      scoreIngredientSource(shortOff, 'openfoodfacts', recent)
  )
})

test('preserves openfoodfacts_backfilled and manual_entry the same way', () => {
  for (const source of ['openfoodfacts_backfilled', 'manual_entry'] as const) {
    const resolved = resolveProductUpsertIngredient({
      offIngredientText: shortOff,
      existingIngredientText: ocrLabel,
      existingSource: source,
      existingUpdatedAt: recent,
    })
    assert.equal(resolved.source, source)
    assert.equal(resolved.ingredientText, ocrLabel)
  }
})

test('does not preserve a previous OFF row — later OFF upserts may refresh it', () => {
  const resolved = resolveProductUpsertIngredient({
    offIngredientText: shortOff,
    existingIngredientText: ocrLabel,
    existingSource: 'openfoodfacts',
    existingUpdatedAt: recent,
  })
  assert.equal(resolved.source, 'openfoodfacts')
  assert.equal(resolved.ingredientText, shortOff)
})

test('replaces learned text only when OFF is clearly better', () => {
  const longOff = `${richerOff}, ${'wheat flour, sugar, palm oil, cocoa, soy lecithin, vanilla, '.repeat(12)}`
  const thinOcr = 'Ingredients: sugar, salt'
  const offScore = scoreIngredientSource(longOff, 'openfoodfacts', recent)
  const ocrScore = scoreIngredientSource(thinOcr, 'photo_ocr', recent)
  assert.ok(
    offScore >= ocrScore + INGREDIENT_SOURCE_PREFERENCE_MARGIN,
    `expected OFF ${offScore} to beat OCR ${ocrScore} by ${INGREDIENT_SOURCE_PREFERENCE_MARGIN}`
  )
  const resolved = resolveProductUpsertIngredient({
    offIngredientText: longOff,
    offUpdatedAt: recent,
    existingIngredientText: thinOcr,
    existingSource: 'photo_ocr',
    existingUpdatedAt: recent,
  })
  assert.equal(resolved.source, 'openfoodfacts')
  assert.equal(resolved.ingredientText, longOff.trim())
})

test('keeps learned text when OFF is not clearly better, even if the lists are similar', () => {
  const same = 'roasted almonds, rolled oats, honey, sea salt, sunflower oil, brown sugar'
  const offScore = scoreIngredientSource(same, 'openfoodfacts', recent)
  const ocrScore = scoreIngredientSource(same, 'photo_ocr', recent)
  assert.ok(
    offScore < ocrScore + INGREDIENT_SOURCE_PREFERENCE_MARGIN,
    `OFF ${offScore} should not beat OCR ${ocrScore} by ${INGREDIENT_SOURCE_PREFERENCE_MARGIN}`
  )
  const resolved = resolveProductUpsertIngredient({
    offIngredientText: same,
    offUpdatedAt: recent,
    existingIngredientText: `${same}. Contains: Almonds.`,
    existingSource: 'photo_ocr',
    existingUpdatedAt: recent,
  })
  assert.equal(resolved.source, 'photo_ocr')
  assert.match(resolved.ingredientText ?? '', /Contains:\s*Almonds/i)
})

test('empty existing cache uses OFF text', () => {
  const resolved = resolveProductUpsertIngredient({
    offIngredientText: shortOff,
    existingIngredientText: null,
    existingSource: 'photo_ocr',
  })
  assert.equal(resolved.source, 'openfoodfacts')
  assert.equal(resolved.ingredientText, shortOff)
})
