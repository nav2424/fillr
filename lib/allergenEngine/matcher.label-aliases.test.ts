import test from 'node:test'
import assert from 'node:assert/strict'
import { detectAllergensEvidenceBased, buildUserAllergenConfig } from './index'

function detect(allergies: string[], ingredients: string) {
  return detectAllergensEvidenceBased(
    { ingredients_text: ingredients },
    buildUserAllergenConfig(allergies)
  )
}

function ids(out: ReturnType<typeof detect>): string[] {
  return out.matched_allergens.map((m) => m.allergen_id)
}

test('soy allergy: tamari (wheat-free soy sauce) is CONTAINS, not SAFE', () => {
  const out = detect(['soy'], 'water, tamari, ginger, garlic')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(ids(out).includes('soy'))
})

test('soy allergy: shoyu is CONTAINS, not SAFE', () => {
  const out = detect(['soy'], 'water, shoyu, sugar, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(ids(out).includes('soy'))
})

test('soy allergy: natto is CONTAINS, not SAFE', () => {
  const out = detect(['soy'], 'natto, rice, mustard')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(ids(out).includes('soy'))
})

test('wheat allergy: tamari-only formula stays SAFE (wheat-free soy sauce)', () => {
  const out = detect(['wheat'], 'water, tamari, ginger, garlic')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(ids(out).includes('wheat'), false)
})

test('egg allergy: mayo is CONTAINS, not SAFE', () => {
  const out = detect(['eggs'], 'relish, mayo, mustard, sugar')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(ids(out).includes('eggs'))
})

test('egg allergy: meringue powder is CONTAINS, not SAFE', () => {
  const out = detect(['eggs'], 'sugar, meringue powder, cornstarch')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(ids(out).includes('eggs'))
})

test('milk allergy: Canadian yogourt is CONTAINS, not SAFE', () => {
  const out = detect(['milk'], 'yogourt, strawberries, sugar')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(ids(out).includes('milk'))
})

test('milk allergy: French yaourt is CONTAINS, not SAFE', () => {
  const out = detect(['dairy'], 'sucre, yaourt, fraise')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(ids(out).includes('milk'))
})

test('wheat allergy: seitan without the word wheat/gluten is CONTAINS, not SAFE', () => {
  const out = detect(['wheat'], 'seitan, water, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(ids(out).includes('wheat'))
})
