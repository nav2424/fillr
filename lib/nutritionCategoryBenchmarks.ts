import type { ProductCategory } from './fillrScoring'

export type CategoryNutritionBenchmark = {
  label: string
  medianSugarG?: number
  medianSodiumMg?: number
  medianCalories?: number
  medianProteinG?: number
}

export const CATEGORY_NUTRITION_BENCHMARKS: Partial<Record<ProductCategory, CategoryNutritionBenchmark>> = {
  breakfast_grain: { label: 'instant oatmeal', medianSugarG: 6, medianSodiumMg: 150, medianCalories: 160, medianProteinG: 5 },
  salty_snack: { label: 'salty snacks', medianSodiumMg: 170, medianCalories: 150, medianProteinG: 2, medianSugarG: 1 },
  candy: { label: 'candy', medianSugarG: 20, medianSodiumMg: 80, medianCalories: 200 },
  protein_bar: { label: 'protein bars', medianProteinG: 15, medianSugarG: 8, medianCalories: 200, medianSodiumMg: 180 },
  drink: { label: 'drinks', medianSugarG: 24, medianSodiumMg: 50, medianCalories: 120 },
  dairy: { label: 'dairy', medianSugarG: 12, medianSodiumMg: 120, medianCalories: 150, medianProteinG: 8 },
  clean_snack: { label: 'clean snacks', medianSugarG: 5, medianSodiumMg: 140, medianCalories: 140, medianProteinG: 4 },
  generic_packaged: { label: 'packaged foods', medianSugarG: 8, medianSodiumMg: 400, medianCalories: 200, medianProteinG: 5 },
}

export type CategoryNutritionInsight = {
  line: string
  categoryLabel: string
}

export function buildCategoryNutritionInsight(
  category: ProductCategory | undefined,
  facts: { sugarsG?: number; sodiumMg?: number; calories?: number; proteinG?: number }
): CategoryNutritionInsight | null {
  const bench = CATEGORY_NUTRITION_BENCHMARKS[category ?? 'generic_packaged']
  if (!bench) return null

  const bits: string[] = []

  if (facts.sugarsG != null && bench.medianSugarG != null) {
    const diff = facts.sugarsG - bench.medianSugarG
    if (diff >= 4) {
      bits.push(`sweeter than typical (${facts.sugarsG}g vs ~${bench.medianSugarG}g)`)
    } else if (diff <= -3) {
      bits.push(`lower sugar than typical for ${bench.label}`)
    }
  }

  if (facts.sodiumMg != null && bench.medianSodiumMg != null && facts.sodiumMg >= bench.medianSodiumMg + 80) {
    bits.push(`sodium is high (${facts.sodiumMg}mg vs ~${bench.medianSodiumMg}mg typical)`)
  }

  if (facts.proteinG != null && bench.medianProteinG != null && facts.proteinG >= bench.medianProteinG + 5) {
    bits.push(`strong protein for ${bench.label}`)
  } else if (facts.proteinG != null && bench.medianProteinG != null && facts.proteinG <= bench.medianProteinG - 4) {
    bits.push(`light on protein for ${bench.label}`)
  }

  if (bits.length === 0) return null

  return {
    categoryLabel: bench.label,
    line: `For ${bench.label}, this is ${bits[0]}.`,
  }
}
