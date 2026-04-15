import test from 'node:test'
import assert from 'node:assert/strict'
import { getCeliacSeverity, runCeliacCheck } from './matcher'

function runAllergenCheck(
  ingredients: string[],
  profile: { celiacStrictGluten: boolean },
  fullText = ''
): { celiac?: unknown } {
  if (!profile.celiacStrictGluten) return {}
  const matches = runCeliacCheck(ingredients, fullText)
  return {
    celiac: {
      celiacModeEnabled: true,
      matchedGlutenSignals: matches,
      celiacSeverity: getCeliacSeverity(matches),
    },
  }
}

test('rice flour + salt -> SAFE', () => {
  const result = runCeliacCheck(['rice flour', 'salt'], '')
  assert.equal(getCeliacSeverity(result), 'SAFE')
})

test('wheat flour -> AVOID', () => {
  const result = runCeliacCheck(['wheat flour', 'sugar'], '')
  assert.equal(getCeliacSeverity(result), 'AVOID')
  assert.equal(result[0]?.signalType, 'EXPLICIT_GRAIN')
})

test('barley malt extract -> AVOID', () => {
  const result = runCeliacCheck(['barley malt extract'], '')
  assert.equal(getCeliacSeverity(result), 'AVOID')
  assert.equal(result[0]?.signalType, 'BARLEY_MALT')
})

test('malt extract (ambiguous) -> CAUTION', () => {
  const result = runCeliacCheck(['malt extract'], '')
  assert.equal(getCeliacSeverity(result), 'CAUTION')
  assert.equal(result[0]?.signalType, 'AMBIGUOUS_MALT')
})

test('maltodextrin -> not flagged as malt', () => {
  const result = runCeliacCheck(['maltodextrin'], '')
  const maltMatch = result.find((m) => m.signalType === 'AMBIGUOUS_MALT')
  assert.equal(maltMatch, undefined)
})

test('maltol (flavor compound) -> not flagged as malt', () => {
  const result = runCeliacCheck(['maltol'], '')
  const maltMatch = result.find((m) => m.signalType === 'AMBIGUOUS_MALT')
  assert.equal(maltMatch, undefined)
  assert.equal(getCeliacSeverity(result), 'SAFE')
})

test('gluten-free oats -> CAUTION with note', () => {
  const result = runCeliacCheck(['gluten-free oats'], '')
  assert.equal(getCeliacSeverity(result), 'CAUTION')
})

test('plain oats -> CAUTION', () => {
  const result = runCeliacCheck(['oats', 'honey'], '')
  assert.equal(getCeliacSeverity(result), 'CAUTION')
  assert.equal(result[0]?.signalType, 'OATS')
})

test('may contain wheat -> CAUTION', () => {
  const result = runCeliacCheck(['rice', 'sugar'], 'may contain wheat')
  assert.equal(getCeliacSeverity(result), 'CAUTION')
  assert.equal(result[0]?.signalType, 'MAY_CONTAIN')
})

test('gluten-free label, no gluten ingredients -> SAFE', () => {
  const result = runCeliacCheck(
    ['rice flour', 'certified gluten-free oats', 'sugar', 'salt'],
    'certified gluten-free'
  )
  assert.equal(getCeliacSeverity(result), 'SAFE')
})

test('celiac OFF -> existing behavior unchanged', () => {
  const result = runAllergenCheck(['wheat flour'], { celiacStrictGluten: false })
  assert.equal(result.celiac, undefined)
})

test('wheat in parentheses on same line as glucose syrup -> AVOID', () => {
  const text = 'glucose syrup (wheat), sugar, salt'
  const ingredients = text.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
  const result = runCeliacCheck(ingredients, text)
  assert.equal(getCeliacSeverity(result), 'AVOID')
})
