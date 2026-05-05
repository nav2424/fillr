import type { ProductIngredientAnalysisResponse, IngredientAnalysisItem } from '../services/openaiIngredientAnalysisPrompt'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { applyDeterministicRatings } = require('./ingredientMatcher.js') as {
  applyDeterministicRatings: (items: IngredientAnalysisItem[]) => IngredientAnalysisItem[]
}

export type IngredientValidationResult = {
  failedRowNames: string[]
  hasMissingOrDuplicateRows: boolean
  hasOrderMismatch: boolean
  hasRequiredFieldGaps: boolean
  hasFixedRatingMismatch: boolean
  hasPositiveVerdictConflict: boolean
  productFieldsMissing: boolean
  isValid: boolean
}

function isBlank(s: unknown): boolean {
  return !String(s ?? '').trim()
}

export function validateIngredientAnalysisOutput(
  originalIngredients: string[],
  parsed: ProductIngredientAnalysisResponse
): IngredientValidationResult {
  const rows = parsed.ingredients ?? []
  const failed = new Set<string>()
  const hasMissingOrDuplicateRows = rows.length !== originalIngredients.length

  const hasOrderMismatch = rows.some((r, i) => String(r?.name ?? '').trim() !== String(originalIngredients[i] ?? '').trim())
  if (hasMissingOrDuplicateRows || hasOrderMismatch) {
    for (const name of originalIngredients) failed.add(name)
  }

  let hasRequiredFieldGaps = false
  const requiredKeys: (keyof IngredientAnalysisItem)[] = [
    'name',
    'headline',
    'labelDecoder',
    'whatItIs',
    'whatItDoes',
    'bodyEffect',
    'funFact',
    'whyItMattersYou',
    'rating',
    'ratingReason',
  ]
  for (const row of rows) {
    const bad = requiredKeys.some((k) => isBlank(row[k]))
    if (bad) {
      hasRequiredFieldGaps = true
      failed.add(String(row.name ?? ''))
    }
  }

  let hasFixedRatingMismatch = false
  try {
    const corrected = applyDeterministicRatings(
      rows.map((r) => ({ name: r.name, rating: r.rating })) as IngredientAnalysisItem[]
    )
    for (let i = 0; i < rows.length; i++) {
      const expected = String(corrected[i]?.rating ?? '')
      const got = String(rows[i]?.rating ?? '')
      if (expected && got && expected !== got) {
        hasFixedRatingMismatch = true
        failed.add(String(rows[i]?.name ?? ''))
      }
    }
  } catch {
    // no-op; keep validation resilient
  }

  const hasRisk = rows.some((r) => r.rating === 'concerning' || r.rating === 'avoid')
  const verdict = String(parsed.productVerdict ?? '').toLowerCase()
  const positiveWords = /\b(clean|wholesome|great|excellent|very healthy|simple and healthy)\b/i
  const hasPositiveVerdictConflict = hasRisk && positiveWords.test(verdict)

  const pa = parsed.productAnalysis
  const productFieldsMissing =
    !pa ||
    isBlank(pa.viralHook) ||
    isBlank(pa.bottomLine) ||
    isBlank(pa.ingredientOrderInsight) ||
    !Array.isArray(pa.sugarSources)

  const isValid =
    !hasMissingOrDuplicateRows &&
    !hasOrderMismatch &&
    !hasRequiredFieldGaps &&
    !hasFixedRatingMismatch &&
    !hasPositiveVerdictConflict

  return {
    failedRowNames: [...failed].filter(Boolean),
    hasMissingOrDuplicateRows,
    hasOrderMismatch,
    hasRequiredFieldGaps,
    hasFixedRatingMismatch,
    hasPositiveVerdictConflict,
    productFieldsMissing,
    isValid,
  }
}

