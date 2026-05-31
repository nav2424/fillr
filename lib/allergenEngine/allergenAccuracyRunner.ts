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

export function runAllergenAccuracyBenchmark(file = 'benchmarks/allergen_accuracy_cases.json'): {
  total: number
  passed: number
  failed: number
  failures: Array<{ id: string; error: string }>
} {
  const abs = path.join(process.cwd(), file)
  const cases = JSON.parse(fs.readFileSync(abs, 'utf8')) as Case[]
  const failures: Array<{ id: string; error: string }> = []

  for (const c of cases) {
    try {
      const user = buildUserAllergenConfig(c.allergies)
      const out = detectAllergensEvidenceBased({ product_name: c.product_name, ...c.input }, user)
      if (out.overall_status !== c.expect.overall_status) {
        throw new Error(`status expected ${c.expect.overall_status} got ${out.overall_status}`)
      }
      if (out.matched_allergens.length < c.expect.min_matches) {
        throw new Error(`min_matches expected ${c.expect.min_matches} got ${out.matched_allergens.length}`)
      }
      const got = new Set(out.matched_allergens.map((m) => m.allergen_id))
      for (const must of c.expect.must_match_allergen_ids) {
        if (!got.has(must)) throw new Error(`missing allergen id ${must}`)
      }
    } catch (e) {
      failures.push({
        id: c.id,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  const total = cases.length
  const failed = failures.length
  return { total, passed: total - failed, failed, failures }
}
