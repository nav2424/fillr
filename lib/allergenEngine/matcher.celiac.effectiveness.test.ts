/**
 * Celiac mode effectiveness: realistic label scenarios + specificity checks.
 *
 * Run: npx tsx --test lib/allergenEngine/matcher.celiac.effectiveness.test.ts
 * Or:  npm test (includes this file)
 *
 * These tests document expected behavior of runCeliacCheck + getCeliacSeverity.
 * They are not medical validation — they measure rule coverage vs common label patterns.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { getCeliacSeverity, runCeliacCheck } from './matcher'

type ExpectedSeverity = 'SAFE' | 'CAUTION' | 'AVOID'

type Scenario = {
  id: string
  ingredients: string[]
  fullText?: string
  expect: ExpectedSeverity
  /** Expect at least one of these signal types among matches (when expect !== SAFE) */
  expectAnySignal?: Array<
    'EXPLICIT_GRAIN' | 'BARLEY_MALT' | 'AMBIGUOUS_MALT' | 'ALLERGEN_SECTION' | 'MAY_CONTAIN' | 'OATS' | 'CERTIFIED_GF'
  >
}

function severityFor(
  ingredients: string[],
  fullText = ''
): { severity: ExpectedSeverity; signals: string[] } {
  const matches = runCeliacCheck(ingredients, fullText)
  return {
    severity: getCeliacSeverity(matches),
    signals: [...new Set(matches.map((m) => m.signalType))],
  }
}

/** Core scenarios: should catch real gluten sources (recall-oriented). */
const SHOULD_FLAG_AVOID: Scenario[] = [
  {
    id: 'enriched-wheat-flour-snack',
    ingredients: ['Enriched wheat flour', 'sugar', 'high fructose corn syrup', 'palm oil'],
    expect: 'AVOID',
    expectAnySignal: ['EXPLICIT_GRAIN'],
  },
  {
    id: 'rye-flour',
    ingredients: ['rye flour', 'water', 'salt'],
    expect: 'AVOID',
    expectAnySignal: ['EXPLICIT_GRAIN'],
  },
  {
    id: 'barley-malt-extract',
    ingredients: ['barley malt extract', 'water'],
    expect: 'AVOID',
    expectAnySignal: ['BARLEY_MALT'],
  },
  {
    id: 'malt-vinegar',
    ingredients: ['distilled malt vinegar', 'salt'],
    expect: 'AVOID',
    expectAnySignal: ['BARLEY_MALT'],
  },
  {
    id: 'semolina-pasta',
    ingredients: ['semolina', 'water'],
    expect: 'AVOID',
    expectAnySignal: ['EXPLICIT_GRAIN'],
  },
  {
    id: 'spelt',
    ingredients: ['whole spelt flour'],
    expect: 'AVOID',
    expectAnySignal: ['EXPLICIT_GRAIN'],
  },
  {
    id: 'hydrolyzed-wheat',
    ingredients: ['hydrolyzed wheat protein', 'salt'],
    expect: 'AVOID',
    expectAnySignal: ['EXPLICIT_GRAIN'],
  },
  {
    id: 'contains-gluten-in-ancillary-text',
    ingredients: ['sugar', 'cocoa powder'],
    fullText: 'contains gluten',
    expect: 'AVOID',
    expectAnySignal: ['ALLERGEN_SECTION'],
  },
  {
    id: 'contains-wheat-in-ancillary-text',
    ingredients: ['rice starch', 'salt'],
    fullText: 'contains wheat',
    expect: 'AVOID',
    expectAnySignal: ['ALLERGEN_SECTION'],
  },
]

/** Should stay clear — common non-gluten staples (specificity). */
const SHOULD_STAY_SAFE: Scenario[] = [
  {
    id: 'rice-corn-tapioca',
    ingredients: ['rice flour', 'corn starch', 'tapioca starch', 'salt'],
    expect: 'SAFE',
  },
  {
    id: 'maltodextrin',
    ingredients: ['maltodextrin', 'salt'],
    expect: 'SAFE',
  },
  {
    id: 'buckwheat-flour',
    ingredients: ['buckwheat flour', 'water'],
    expect: 'SAFE',
  },
  {
    id: 'wheatgrass-powder',
    ingredients: ['wheatgrass powder', 'rice flour'],
    expect: 'SAFE',
  },
  {
    id: 'potato-tapioca',
    ingredients: ['potato starch', 'tapioca syrup', 'salt'],
    expect: 'SAFE',
  },
  {
    id: 'quinoa-millet',
    ingredients: ['quinoa', 'millet', 'sunflower oil'],
    expect: 'SAFE',
  },
]

/** Ambiguous or cross-contact — expect CAUTION. */
const SHOULD_CAUTION: Scenario[] = [
  {
    id: 'malt-extract-ambiguous',
    ingredients: ['malt extract', 'sugar'],
    expect: 'CAUTION',
    expectAnySignal: ['AMBIGUOUS_MALT'],
  },
  {
    id: 'plain-rolled-oats',
    ingredients: ['rolled oats', 'honey', 'salt'],
    expect: 'CAUTION',
    expectAnySignal: ['OATS'],
  },
  {
    id: 'may-contain-wheat',
    ingredients: ['sugar', 'cocoa butter'],
    fullText: 'may contain wheat',
    expect: 'CAUTION',
    expectAnySignal: ['MAY_CONTAIN'],
  },
  {
    id: 'facility-wheat',
    ingredients: ['corn syrup'],
    fullText: 'processed in a facility that also processes wheat',
    expect: 'CAUTION',
    expectAnySignal: ['MAY_CONTAIN'],
  },
  {
    id: 'oat-milk-not-gf-certified-line',
    ingredients: ['oat base (water, oats)', 'salt'],
    expect: 'CAUTION',
    expectAnySignal: ['OATS'],
  },
]

/**
 * Documented limitations: rules do not model every edge case.
 * If behavior changes, update this list intentionally.
 */
const KNOWN_LIMITATIONS: Scenario[] = [
  {
    id: 'wheat-dextrin-not-listed',
    ingredients: ['dextrin'],
    expect: 'SAFE',
    // Wheat dextrin can be GF in some regions; we do not infer source from "dextrin" alone.
  },
  {
    id: 'brewers-yeast-with-malt',
    ingredients: ['brewers yeast', 'barley malt'],
    expect: 'AVOID',
    expectAnySignal: ['BARLEY_MALT'],
  },
  {
    id: 'brewers-yeast-alone',
    ingredients: ['brewers yeast'],
    expect: 'SAFE',
    // Not modeled; user should read label / brand.
  },
]

const ALL_SCENARIOS: Scenario[] = [
  ...SHOULD_FLAG_AVOID,
  ...SHOULD_STAY_SAFE,
  ...SHOULD_CAUTION,
  ...KNOWN_LIMITATIONS,
]

for (const s of ALL_SCENARIOS) {
  test(`celiac: ${s.id}`, () => {
    const { severity, signals } = severityFor(s.ingredients, s.fullText ?? '')
    assert.equal(
      severity,
      s.expect,
      `${s.id}: got ${severity} signals=[${signals.join(',')}] for ingredients=${JSON.stringify(s.ingredients)} fullText=${JSON.stringify(s.fullText ?? '')}`
    )
    if (s.expectAnySignal?.length) {
      const hit = s.expectAnySignal.some((t) => signals.includes(t))
      assert.ok(
        hit,
        `${s.id}: expected one of [${s.expectAnySignal.join(', ')}] but got [${signals.join(', ')}]`
      )
    }
    if (s.expect === 'SAFE') {
      assert.ok(
        !signals.some((x) => x === 'EXPLICIT_GRAIN' || x === 'BARLEY_MALT' || x === 'ALLERGEN_SECTION'),
        `${s.id}: SAFE should not include hard AVOID-level grain signals; got ${signals.join(',')}`
      )
    }
  })
}

test('celiac effectiveness: suite size (recall + specificity + caution + limits)', () => {
  assert.ok(SHOULD_FLAG_AVOID.length >= 8, 'enough AVOID coverage')
  assert.ok(SHOULD_STAY_SAFE.length >= 5, 'enough SAFE / specificity coverage')
  assert.ok(SHOULD_CAUTION.length >= 4, 'enough CAUTION coverage')
  assert.equal(
    ALL_SCENARIOS.length,
    SHOULD_FLAG_AVOID.length + SHOULD_STAY_SAFE.length + SHOULD_CAUTION.length + KNOWN_LIMITATIONS.length
  )
})
