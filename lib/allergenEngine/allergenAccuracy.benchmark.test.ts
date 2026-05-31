import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { detectAllergensEvidenceBased, buildUserAllergenConfig } from './index'

type Case = {
  id: string
  product_name?: string
  allergies: string[]
  input: {
    ingredients_text?: string
    ingredients_text_safety?: string
    contains_text?: string
    may_contain_text?: string
    allergens_tags?: string[]
    traces_tags?: string[]
  }
  expect: {
    overall_status: 'SAFE' | 'CONTAINS' | 'MAY_CONTAIN' | 'UNKNOWN'
    must_match_allergen_ids: string[]
    min_matches: number
  }
}

function loadCases(): Case[] {
  const file = path.join(process.cwd(), 'benchmarks', 'allergen_accuracy_cases.json')
  const raw = fs.readFileSync(file, 'utf8')
  const arr = JSON.parse(raw) as Case[]
  return arr
}

function ids(out: ReturnType<typeof detectAllergensEvidenceBased>): string[] {
  return out.matched_allergens.map((m) => m.allergen_id)
}

test('allergen accuracy benchmark cases', () => {
  const cases = loadCases()
  assert.ok(cases.length > 0)

  for (const c of cases) {
    const user = buildUserAllergenConfig(c.allergies)
    const out = detectAllergensEvidenceBased(
      {
        product_name: c.product_name,
        ...c.input,
      },
      user
    )

    try {
      assert.equal(out.overall_status, c.expect.overall_status)
      assert.ok(out.matched_allergens.length >= c.expect.min_matches)
      const got = new Set(ids(out))
      for (const must of c.expect.must_match_allergen_ids) {
        assert.ok(got.has(must), `missing expected allergen id ${must}`)
      }
    } catch (e) {
      // Attach useful debug context.
      const debug = {
        id: c.id,
        expect: c.expect,
        got: {
          overall_status: out.overall_status,
          matched: out.matched_allergens,
          scan_log: out.scan_log,
        },
      }
      console.error(JSON.stringify(debug, null, 2))
      throw e
    }
  }
})
