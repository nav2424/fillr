import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateFillrFit } from './fillrScoring'

test('allergy match always returns 0', () => {
  const result = calculateFillrFit({
    allergyMatches: ['peanuts'],
    ingredientCounts: {
      natural: 10,
      processed: 2,
      additive: 0,
      flagged: 0,
    },
    totalIngredients: 12,
  })
  assert.equal(result.score, 0)
  assert.equal(result.verdict, 'Unsafe')
  assert.equal(result.tier, 1)
})

test('celiac AVOID returns 0', () => {
  const result = calculateFillrFit({
    allergyMatches: [],
    celiacSeverity: 'AVOID',
    ingredientCounts: {
      natural: 8,
      processed: 3,
      additive: 1,
      flagged: 1,
    },
    totalIngredients: 13,
  })
  assert.equal(result.score, 0)
  assert.equal(result.tier, 1)
})

test('celiac CAUTION caps at 50', () => {
  const result = calculateFillrFit({
    allergyMatches: [],
    celiacSeverity: 'CAUTION',
    ingredientCounts: {
      natural: 15,
      processed: 2,
      additive: 0,
      flagged: 0,
    },
    totalIngredients: 17,
  })
  assert.ok(result.score <= 50)
  assert.equal(result.tier, 2)
})

test('sensitivity caps at 50', () => {
  const result = calculateFillrFit({
    allergyMatches: [],
    sensitivityMatches: ['MSG'],
    ingredientCounts: {
      natural: 12,
      processed: 2,
      additive: 0,
      flagged: 0,
    },
    totalIngredients: 14,
  })
  assert.ok(result.score <= 50)
  assert.equal(result.tier, 2)
})

test('clean product with matching goal scores high', () => {
  const result = calculateFillrFit({
    allergyMatches: [],
    celiacSeverity: 'SAFE',
    sensitivityMatches: [],
    avoidingMatches: [],
    goalMatches: ['high-protein'],
    goalConflicts: [],
    ingredientCounts: {
      natural: 14,
      processed: 1,
      additive: 0,
      flagged: 0,
    },
    totalIngredients: 15,
  })
  assert.ok(result.score >= 75)
  assert.equal(result.tier, 3)
})

test('multiple allergies still returns 0', () => {
  const result = calculateFillrFit({
    allergyMatches: ['peanuts', 'dairy', 'gluten'],
    ingredientCounts: {
      natural: 5,
      processed: 0,
      additive: 0,
      flagged: 0,
    },
    totalIngredients: 5,
  })
  assert.equal(result.score, 0)
})

test('celiac strict + ambiguous celiac-flagged ingredients penalizes and caps tier 2', () => {
  const base = {
    allergyMatches: [] as string[],
    celiacSeverity: 'SAFE' as const,
    celiacStrictGluten: true,
    celiacAmbiguousCount: 1,
    sensitivityMatches: [] as string[],
    avoidingMatches: [] as string[],
    goalMatches: [] as string[],
    goalConflicts: [] as string[],
    ingredientCounts: {
      natural: 15,
      processed: 2,
      additive: 0,
      flagged: 0,
    },
    totalIngredients: 17,
  }
  const withAmbiguous = calculateFillrFit(base)
  const without = calculateFillrFit({ ...base, celiacAmbiguousCount: 0, celiacStrictGluten: false })
  assert.ok(withAmbiguous.score < without.score)
  assert.ok(withAmbiguous.score <= 50)
  assert.equal(withAmbiguous.tier, 2)
  assert.match(withAmbiguous.reason, /unverified gluten source/i)
})

test('no_artificial_sweeteners scoring pref lowers score when sweeteners present', () => {
  const cleanPrefs = calculateFillrFit({
    allergyMatches: [],
    celiacSeverity: 'SAFE',
    sensitivityMatches: [],
    avoidingMatches: [],
    goalMatches: ['eat_cleaner'],
    goalConflicts: [],
    scoringPreferenceKeys: ['no_artificial_sweeteners'],
    sweetenerCount: 0,
    ingredientCounts: { natural: 12, processed: 2, additive: 0, flagged: 0 },
    totalIngredients: 14,
  })
  const withSweetener = calculateFillrFit({
    allergyMatches: [],
    celiacSeverity: 'SAFE',
    sensitivityMatches: [],
    avoidingMatches: [],
    goalMatches: ['eat_cleaner'],
    goalConflicts: [],
    scoringPreferenceKeys: ['no_artificial_sweeteners'],
    sweetenerCount: 1,
    ingredientCounts: { natural: 12, processed: 2, additive: 0, flagged: 0 },
    totalIngredients: 14,
  })
  assert.ok(withSweetener.score < cleanPrefs.score)
})

test('no profile uses pure quality scoring', () => {
  const cleanResult = calculateFillrFit({
    allergyMatches: [],
    celiacSeverity: 'SAFE',
    sensitivityMatches: [],
    avoidingMatches: [],
    goalMatches: [],
    goalConflicts: [],
    ingredientCounts: {
      natural: 15,
      processed: 2,
      additive: 0,
      flagged: 0,
    },
    totalIngredients: 17,
  })
  assert.ok(cleanResult.score > 70)

  const badResult = calculateFillrFit({
    allergyMatches: [],
    celiacSeverity: 'SAFE',
    sensitivityMatches: [],
    avoidingMatches: [],
    goalMatches: [],
    goalConflicts: [],
    ingredientCounts: {
      natural: 3,
      processed: 5,
      additive: 8,
      flagged: 4,
    },
    totalIngredients: 20,
  })
  assert.ok(badResult.score < 40)
})

test('cleaner xylitol gum scores as better within gum category, not near zero', () => {
  const result = calculateFillrFit({
    allergyMatches: [],
    celiacSeverity: 'SAFE',
    sensitivityMatches: [],
    avoidingMatches: [],
    goalMatches: [],
    goalConflicts: [],
    productCategory: 'gum',
    labelHaystack: 'PUR Gum xylitol gum base gum arabic natural flavors carnauba wax',
    sweetenerCount: 0,
    industrialSweetenerCount: 0,
    hydrogenatedOilCount: 0,
    ingredientCounts: {
      natural: 0,
      processed: 2,
      additive: 5,
      flagged: 0,
    },
    totalIngredients: 7,
  })
  assert.ok(result.score >= 55 && result.score <= 65, `expected cleaner gum range, got ${result.score}`)
  assert.match(result.reason, /chewing gum/i)
})

test('gum with artificial sweeteners is not lifted into cleaner gum range', () => {
  const result = calculateFillrFit({
    allergyMatches: [],
    celiacSeverity: 'SAFE',
    sensitivityMatches: [],
    avoidingMatches: [],
    goalMatches: [],
    goalConflicts: [],
    productCategory: 'gum',
    labelHaystack: 'chewing gum gum base sorbitol aspartame acesulfame potassium artificial flavor',
    sweetenerCount: 2,
    industrialSweetenerCount: 0,
    hydrogenatedOilCount: 0,
    ingredientCounts: {
      natural: 0,
      processed: 2,
      additive: 5,
      flagged: 0,
    },
    totalIngredients: 7,
  })
  assert.ok(result.score < 55, `expected artificial-sweetener gum below cleaner range, got ${result.score}`)
})

test('same product scores differently for different user preferences', () => {
  const base = {
    allergyMatches: [] as string[],
    celiacSeverity: 'SAFE' as const,
    sensitivityMatches: [] as string[],
    avoidingMatches: [] as string[],
    goalMatches: [] as string[],
    goalConflicts: [] as string[],
    productCategory: 'clean_snack' as const,
    labelHaystack: 'oats dates sugar cocoa protein',
    sugarScore: 12,
    ingredientCounts: { natural: 3, processed: 2, additive: 0, flagged: 0 },
    totalIngredients: 5,
  }
  const general = calculateFillrFit(base)
  const lowSugar = calculateFillrFit({
    ...base,
    scoringPreferenceKeys: ['low_sugar'],
  })
  assert.ok(lowSugar.score < general.score, `expected low sugar user lower than general user`)
})

test('category ceiling is respected even with cleaner ingredients', () => {
  const candy = calculateFillrFit({
    allergyMatches: [],
    celiacSeverity: 'SAFE',
    sensitivityMatches: [],
    avoidingMatches: [],
    goalMatches: [],
    goalConflicts: [],
    productCategory: 'candy',
    labelHaystack: 'organic cane sugar cocoa butter cocoa',
    ingredientCounts: { natural: 4, processed: 0, additive: 0, flagged: 0 },
    totalIngredients: 4,
  })
  assert.ok(candy.score <= 50, `expected candy ceiling <= 50, got ${candy.score}`)
})

test('risk overrides category floor for allergens', () => {
  const result = calculateFillrFit({
    allergyMatches: ['peanuts'],
    productCategory: 'whole_food',
    labelHaystack: 'peanuts',
    ingredientCounts: { natural: 1, processed: 0, additive: 0, flagged: 0 },
    totalIngredients: 1,
  })
  assert.equal(result.score, 0)
  assert.equal(result.verdict, 'Unsafe')
})

test('severe ingredient overrides category floor without allergy', () => {
  const result = calculateFillrFit({
    allergyMatches: [],
    celiacSeverity: 'SAFE',
    sensitivityMatches: [],
    avoidingMatches: [],
    goalMatches: [],
    goalConflicts: [],
    productCategory: 'clean_snack',
    hydrogenatedOilCount: 1,
    ingredientCounts: { natural: 4, processed: 1, additive: 0, flagged: 0 },
    totalIngredients: 5,
  })
  assert.ok(result.score <= 35, `expected severe additive cap <= 35, got ${result.score}`)
})
