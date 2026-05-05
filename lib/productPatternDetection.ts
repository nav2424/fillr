export type ProductPatternDetection = {
  sugarCount: number
  sugarSources: string[]
  hasStackedSugars: boolean
  hasEmulsifiers: boolean
  emulsifiers: string[]
  hasModifiedOils: boolean
  modifiedOils: string[]
  hasProteinIsolates: boolean
  proteinIsolates: string[]
  hasFiberAdditives: boolean
  fiberAdditives: string[]
  likelyUltraProcessed: boolean
  productPatternSummary: string[]
}

function normalize(s: string): string {
  return String(s ?? '').toLowerCase().trim()
}

function uniqPush(arr: string[], value: string): void {
  if (!arr.includes(value)) arr.push(value)
}

export function detectProductPatterns(
  ingredients: string[],
  nutrition?: object
): ProductPatternDetection {
  const sugarSources: string[] = []
  const emulsifiers: string[] = []
  const modifiedOils: string[] = []
  const proteinIsolates: string[] = []
  const fiberAdditives: string[] = []

  for (const raw of ingredients) {
    const t = normalize(raw)
    if (!t) continue

    // Sugars / syrups / concentrates / maltodextrin
    if (
      /\bsugar\b|\bsyrup\b|\bmaltodextrin\b|\bjuice concentrate\b|\bglucose\b|\bfructose\b|\bhoney\b|\bmolasses\b/.test(
        t
      )
    ) {
      uniqPush(sugarSources, raw.trim())
    }

    // Emulsifiers
    if (/\blecithin\b|\bpgpr\b|\bpolyglycerol polyricinoleate\b|\bmono-?\s*and\s*diglycerides\b|\bemulsifier\b/.test(t)) {
      uniqPush(emulsifiers, raw.trim())
    }

    // Modified / hydrogenated oils
    if (
      /\bmodified\b.*\boil\b|\bhydrogenated\b.*\boil\b|\bpartially hydrogenated\b|\binteresterified\b.*\boil\b/.test(
        t
      )
    ) {
      uniqPush(modifiedOils, raw.trim())
    }

    // Protein isolates
    if (/\bprotein isolate\b|\bprotein concentrate\b|\bisolated protein\b/.test(t)) {
      uniqPush(proteinIsolates, raw.trim())
    }

    // Added fibers
    if (
      /\binulin\b|\bchicory root fiber\b|\bjerusalem artichoke fiber\b|\bfiber\b|\bsoluble corn fiber\b|\bpolydextrose\b/.test(
        t
      )
    ) {
      uniqPush(fiberAdditives, raw.trim())
    }
  }

  const sugarCount = sugarSources.length
  const hasStackedSugars = sugarCount >= 2
  const hasEmulsifiers = emulsifiers.length > 0
  const hasModifiedOils = modifiedOils.length > 0
  const hasProteinIsolates = proteinIsolates.length > 0
  const hasFiberAdditives = fiberAdditives.length > 0

  const productPatternSummary: string[] = []
  if (hasStackedSugars) productPatternSummary.push('Stacked sugar system detected.')
  if (hasEmulsifiers) productPatternSummary.push('Texture engineering via emulsifiers detected.')
  if (hasModifiedOils) productPatternSummary.push('Shelf-stability oils/fats detected.')
  if (hasProteinIsolates || hasFiberAdditives) {
    productPatternSummary.push('Functional nutrition positioning (protein/fiber additives) detected.')
  }

  const saturatedFatHigh = (() => {
    if (!nutrition || typeof nutrition !== 'object') return false
    const n = nutrition as Record<string, unknown>
    const v = n['saturated-fat_100g']
    return typeof v === 'number' && v >= 10
  })()

  const likelyUltraProcessed =
    (hasStackedSugars ? 1 : 0) +
      (hasEmulsifiers ? 1 : 0) +
      (hasModifiedOils ? 1 : 0) +
      (hasProteinIsolates ? 1 : 0) +
      (hasFiberAdditives ? 1 : 0) >=
      2 || (hasStackedSugars && hasEmulsifiers) || (hasModifiedOils && saturatedFatHigh)

  if (likelyUltraProcessed) {
    productPatternSummary.push('Likely ultra-processed formulation pattern.')
  }

  return {
    sugarCount,
    sugarSources,
    hasStackedSugars,
    hasEmulsifiers,
    emulsifiers,
    hasModifiedOils,
    modifiedOils,
    hasProteinIsolates,
    proteinIsolates,
    hasFiberAdditives,
    fiberAdditives,
    likelyUltraProcessed,
    productPatternSummary,
  }
}

